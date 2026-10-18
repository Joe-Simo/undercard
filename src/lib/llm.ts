import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
import { kvGet, kvSet } from "./store";

export interface LlmResult<T> {
  value: T;
  mocked: boolean;
  provider: string;
  model: string;
  ms: number;
  cached?: boolean;
  fallback?: string;
}

const PROVIDER_LABEL: Record<string, string> = { openrouter: "OpenRouter", groq: "Groq", github: "GitHub Models", gemini: "Gemini", mock: "Template" };

/** When the free daily quota is spent, skip the provider until the next UTC day instead of burning time on retries. */
let exhaustedUntil = 0;
const nextUtcMidnight = () => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return d.getTime(); };

class QuotaError extends Error {}
class RetryableError extends Error {
  constructor(message: string, public retryAfterMs?: number) { super(message); }
}

/** House style: no em or en dashes, plain hyphens, in anything a model writes. */
export function tidy<T>(v: T): T {
  if (typeof v === "string") return v.replace(/\s*\u2014\s*/g, ", ").replace(/[\u2010\u2011\u2012\u2013]/g, "-").replace(/\u00a0/g, " ") as T;
  if (Array.isArray(v)) return v.map(tidy) as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)])) as T;
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One OpenAI-compatible chat call that must return JSON matching `schema`.
 * Order of defenses: cache (identical prompts never spend quota twice), retry with backoff,
 * fallback models, then the deterministic template so a live demo never dead-ends.
 */
export async function writeJson<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; mock: () => T; maxTokens?: number; cacheKey?: string }): Promise<LlmResult<T>> {
  const started = Date.now();
  const cfg = env.llm();
  const template = (fallback?: string): LlmResult<T> => ({ value: opts.schema.parse(opts.mock()), mocked: true, provider: PROVIDER_LABEL.mock, model: "template", ms: Date.now() - started, fallback });
  if (cfg.name === "mock") {
    await sleep(150);
    return template();
  }
  if (Date.now() < exhaustedUntil) return template("free daily quota used up");

  const hash = createHash("sha256").update(JSON.stringify([cfg.name, opts.cacheKey ?? "", opts.system, opts.prompt])).digest("hex").slice(0, 32);
  const hit = await kvGet<{ value: unknown; model: string }>(`llm/${hash}`).catch(() => null);
  if (hit) {
    const parsed = opts.schema.safeParse(hit.value);
    if (parsed.success) return { value: parsed.data, mocked: false, provider: PROVIDER_LABEL[cfg.name], model: hit.model, ms: Date.now() - started, cached: true };
  }

  const models = [cfg.model, ...cfg.fallbacks];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    // Rotate the primary on retries so an upstream-throttled model does not block the whole request.
    const order = [...models.slice(attempt % models.length), ...models.slice(0, attempt % models.length)];
    try {
      const out = await callOnce(cfg, order, opts);
      await kvSet(`llm/${hash}`, { value: out.value, model: out.model }).catch(() => {});
      return { value: out.value, mocked: false, provider: PROVIDER_LABEL[cfg.name], model: out.model, ms: Date.now() - started };
    } catch (err) {
      lastErr = err;
      if (err instanceof QuotaError) {
        exhaustedUntil = nextUtcMidnight();
        break;
      }
      if (attempt < 2) {
        const base = err instanceof RetryableError && err.retryAfterMs ? Math.min(err.retryAfterMs, 8000) : 1200 * 2 ** attempt;
        await sleep(base + Math.random() * 400);
      }
    }
  }
  console.error("[undercard] LLM failed, using template:", String(lastErr).slice(0, 300));
  return template(String(lastErr instanceof Error ? lastErr.message : lastErr).slice(0, 120));
}

async function callOnce<T>(cfg: ReturnType<typeof env.llm>, models: string[], opts: { system: string; prompt: string; schema: z.ZodType<T>; maxTokens?: number }): Promise<{ value: T; model: string }> {
  const messages = [
    { role: "system", content: `${opts.system}\nRespond with one JSON object matching this JSON Schema. No prose, no markdown, no em dashes.\n${JSON.stringify(z.toJSONSchema(opts.schema))}` },
    { role: "user", content: opts.prompt },
  ];
  const isOpenRouter = cfg.name === "openrouter";
  const body: Record<string, unknown> = {
    model: models[0],
    temperature: 0.4,
    max_tokens: opts.maxTokens ?? 1600,
    response_format: { type: "json_object" },
    messages,
  };
  // OpenRouter routes to the next model in `models` if the first is down or throttled.
  if (isOpenRouter && models.length > 1) body.models = models.slice(0, 3);
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" };
  if (isOpenRouter) Object.assign(headers, { "HTTP-Referer": "https://github.com/Joe-Simo/undercard", "X-Title": "Undercard" });

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(50_000) });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429 && /per-day|daily|free-models-per-day/i.test(text)) throw new QuotaError(`${PROVIDER_LABEL[cfg.name]} daily free quota reached`);
    if (res.status === 429 || res.status >= 500 || res.status === 408) throw new RetryableError(`${PROVIDER_LABEL[cfg.name]} ${res.status}`, Number(res.headers.get("retry-after")) * 1000 || undefined);
    throw new Error(`${PROVIDER_LABEL[cfg.name]} ${res.status}: ${text.slice(0, 160)}`);
  }
  const data = JSON.parse(text) as { model?: string; error?: { message?: string; code?: number }; choices?: { message?: { content?: string | null } }[] };
  if (data.error) throw new RetryableError(`${PROVIDER_LABEL[cfg.name]} error: ${data.error.message ?? "unknown"}`);
  const raw = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new RetryableError("Model returned no JSON");
  const parsed = opts.schema.safeParse(tidy(JSON.parse(json)));
  if (!parsed.success) throw new RetryableError(`Model JSON failed validation: ${parsed.error.message.slice(0, 120)}`);
  return { value: parsed.data, model: data.model ?? models[0] };
}
