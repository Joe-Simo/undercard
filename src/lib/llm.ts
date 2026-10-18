import "server-only";
import { z } from "zod";
import { env, modes } from "./env";

/** Minimal Nebius Token Factory chat client with a mock fallback (same pattern as Bidwell). */
export async function writeJson<T>(opts: { system: string; prompt: string; schema: z.ZodType<T>; mock: () => T }): Promise<{ value: T; mocked: boolean; model: string; ms: number }> {
  const started = Date.now();
  const model = env.model();
  if (modes().llm === "mock") {
    await new Promise((r) => setTimeout(r, 250));
    return { value: opts.schema.parse(opts.mock()), mocked: true, model, ms: Date.now() - started };
  }
  const res = await fetch(`${env.nebiusBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.nebiusKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${opts.system}\nRespond with one JSON object matching this schema, no prose:\n${JSON.stringify(z.toJSONSchema(opts.schema))}` },
        { role: "user", content: opts.prompt },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Token Factory ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = data.choices[0]?.message?.content ?? "{}";
  const json = raw.replace(/<think>[\s\S]*?<\/think>/g, "").match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  return { value: opts.schema.parse(JSON.parse(json)), mocked: false, model, ms: Date.now() - started };
}
