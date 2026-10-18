import "server-only";
import { z } from "zod";
import { env } from "./env";

export interface LlmResult<T> {
  value: T;
  mocked: boolean;
  provider: string;
  model: string;
  ms: number;
}

const PROVIDER_LABEL: Record<string, string> = { groq: "Groq", github: "GitHub Models", gemini: "Gemini", mock: "Template" };

/**
 * One OpenAI-compatible chat call that must return JSON matching `schema`.
 * Uses `mock` with no key, and also degrades to `mock` if the provider fails, so a live demo never dead-ends.
 */
export async function writeJson<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; mock: () => T; maxTokens?: number }): Promise<LlmResult<T> & { fallback?: string }> {
  const started = Date.now();
  try {
    return await callProvider(opts);
  } catch (err) {
    console.error("[undercard] LLM failed, using template:", err);
    return { value: opts.schema.parse(opts.mock()), mocked: true, provider: PROVIDER_LABEL.mock, model: "template", ms: Date.now() - started, fallback: String(err).slice(0, 120) };
  }
}

async function callProvider<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; mock: () => T; maxTokens?: number }): Promise<LlmResult<T>> {
  const started = Date.now();
  const cfg = env.llm();
  if (cfg.name === "mock") {
    await new Promise((r) => setTimeout(r, 200));
    return { value: opts.schema.parse(opts.mock()), mocked: true, provider: PROVIDER_LABEL.mock, model: cfg.model, ms: Date.now() - started };
  }
  const messages = [
    { role: "system", content: `${opts.system}\nRespond with one JSON object matching this JSON Schema. No prose, no markdown.\n${JSON.stringify(z.toJSONSchema(opts.schema))}` },
    { role: "user", content: opts.prompt },
  ];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, temperature: 0.4, max_tokens: opts.maxTokens ?? 1600, response_format: { type: "json_object" }, messages }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, Number(res.headers.get("retry-after") ?? 2) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`${PROVIDER_LABEL[cfg.name]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { choices: { message: { content: string | null } }[] };
    const raw = (data.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
    try {
      const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
      return { value: opts.schema.parse(JSON.parse(json)), mocked: false, provider: PROVIDER_LABEL[cfg.name], model: cfg.model, ms: Date.now() - started };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Model output failed validation: ${String(lastErr).slice(0, 200)}`);
}
