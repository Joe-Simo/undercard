import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "./env";
import { writeJson } from "./llm";
import { buildBrief, makeTracer, overlapFor, rankBySize } from "./pipeline";
import { getQloo } from "./qloo";
import type { Brief, BriefEvent, ChatMessage, OpenerPick } from "./types";

const Plan = z.object({
  action: z.enum(["swap_opener", "smaller", "bigger", "change_city", "change_capacity", "answer"]),
  opener: z.number().int().min(1).max(5).optional().describe("1-based opener slot for swap_opener"),
  city: z.string().optional().describe("New city for change_city, e.g. 'Omaha, NE'"),
  capacity: z.number().int().optional().describe("New capacity for change_capacity"),
  reply: z.string().describe("Short reply to the user. For 'answer', the full grounded answer."),
});
type Plan = z.infer<typeof Plan>;

/** Deterministic intent parser used when no LLM key is configured. */
function mockPlan(message: string, brief: Brief): Plan {
  const m = message.toLowerCase();
  const slot = m.match(/(?:opener|slot|#)\s*(\d)/)?.[1] ?? m.match(/\b(first|second|third|fourth|fifth)\b/)?.[1];
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
  if (/swap|replace|drop|swap out|instead of/.test(m)) {
    const named = brief.openers.findIndex((o) => m.includes(o.name.toLowerCase()));
    const n = named >= 0 ? named + 1 : slot ? Number(words[slot] ?? slot) : 1;
    return { action: "swap_opener", opener: Math.min(Math.max(n, 1), brief.openers.length), reply: "" };
  }
  const cap = m.match(/(\d[\d,]{1,6})\s*(?:-?cap|capacity|seats|room|people)/)?.[1];
  if (cap) return { action: "change_capacity", capacity: Number(cap.replace(/,/g, "")), reply: "" };
  const city = message.match(/(?:[Ww]hat if|[Hh]ow about|[Tt]ry|[Mm]ove (?:it )?to|in)\s+([A-Z][a-zA-Z. ]+(?:,\s*[A-Z]{2})?)/)?.[1];
  if (city && city.trim().toLowerCase() !== brief.input.city.toLowerCase()) return { action: "change_city", city: city.trim(), reply: "" };
  if (/smaller|indie|niche|less known|deeper|obscure|cheaper/.test(m)) return { action: "smaller", reply: "" };
  if (/bigger|bigger names|more famous|draw|larger/.test(m)) return { action: "bigger", reply: "" };
  const top = brief.openers[0];
  return { action: "answer", reply: top ? `${top.name} leads because it has the strongest affinity with ${brief.headliner.name}'s audience in ${brief.input.city} and fits a ${brief.input.capacity}-cap room. Ask me to swap an opener, go smaller or bigger, or try another city.` : "Ask me to swap an opener, go smaller or bigger, or try another city." };
}

export interface ChatResult {
  brief: Brief;
  redirect?: string;
}

export async function runChat(brief: Brief, message: string, emit: (e: BriefEvent) => void): Promise<ChatResult> {
  const qloo = getQloo();
  const llm = env.llm();
  const { steps, step } = makeTracer(qloo.name === "mock", llm.name === "mock", emit);
  const summary = JSON.stringify({
    input: brief.input,
    headliner: brief.headliner.name,
    openers: brief.openers.map((o, i) => ({ slot: i + 1, name: o.name, affinity: o.affinity, sizeBand: o.sizeBand, overlap: o.overlap })),
    routing: brief.routing.map((r) => r.city),
    places: brief.partners.places.map((p) => p.name),
    brands: brief.partners.brands.map((b) => b.name),
    podcasts: brief.adPlan.podcasts.map((p) => p.name),
    audience: brief.audience.summary,
  });

  const plan = await step("Plan the edit", "llm", undefined, () =>
    writeJson({
      system: "You are Undercard, a talent-buying agent. Decide which single action fulfils the user's request about this show brief. Tools: swap_opener (replace one opener with the next best Qloo candidate), smaller (re-rank toward less famous acts), bigger (toward bigger draws), change_city, change_capacity, answer (answer a question using ONLY the brief JSON; never invent names or numbers).",
      prompt: `Brief: ${summary}\nUser: ${message}`,
      schema: Plan,
      mock: () => mockPlan(message, brief),
      maxTokens: 600,
    }), (r) => r.value.action).then((r) => r.value);

  const next: Brief = structuredClone(brief);
  next.bench ??= [];
  let reply = plan.reply;
  let redirect: string | undefined;

  const rescore = async (openers: (Omit<OpenerPick, "rationale"> & { rationale?: string })[]) => {
    const ov = await step("Audience overlap for new picks", "qloo", "GET /v2/insights/compare", () => overlapFor(brief.headliner.id, openers.map((o) => o.id)), (m) => `${m.size} scored`);
    return openers.map((o) => ({ ...o, overlap: ov.get(o.id)?.score ?? o.overlap, sharedTags: ov.get(o.id)?.sharedTags ?? o.sharedTags, rationale: o.rationale || `Strong affinity with ${brief.headliner.name}'s audience in ${brief.input.city} (affinity ${Math.round((o.affinity ?? 0) * 100)}), ${o.sizeBand} for a ${brief.input.capacity}-cap room.` }));
  };

  if (plan.action === "swap_opener") {
    const idx = Math.min(Math.max((plan.opener ?? 1) - 1, 0), next.openers.length - 1);
    const out = next.openers[idx];
    const inn = next.bench.shift();
    if (!out || !inn) reply = "There are no more ranked candidates on the bench for this room. Try going smaller or bigger.";
    else {
      const [scored] = await rescore([inn]);
      next.openers[idx] = scored;
      reply = `Swapped ${out.name} for ${scored.name}, the next best Qloo match that fits the room.${reply ? ` ${reply}` : ""}`;
    }
  } else if (plan.action === "smaller" || plan.action === "bigger") {
    const ideal = brief.input.capacity <= 300 ? 0.55 : brief.input.capacity <= 800 ? 0.68 : brief.input.capacity <= 2500 ? 0.8 : 0.9;
    const found = await step(plan.action === "smaller" ? "Re-query for less famous acts" : "Re-query for bigger draws", "qloo", `GET /v2/insights filter.popularity.${plan.action === "smaller" ? "max" : "min"}`, () =>
      qloo.insights({ type: "urn:entity:artist", signalEntities: [brief.headliner.id], locationQuery: brief.input.city, take: 15, ...(plan.action === "smaller" ? { popularityMax: ideal - 0.05 } : { popularityMin: ideal }) }), (r) => `${r.length} artists`);
    const ranked = rankBySize(found.filter((e) => e.id !== brief.headliner.id), brief.input.capacity);
    if (!ranked.length) reply = "Qloo returned no artists in that band for this city.";
    else {
      next.openers = await rescore(ranked.slice(0, 5));
      next.bench = ranked.slice(5, 15);
      reply = `Re-ranked toward ${plan.action === "smaller" ? "smaller, more local" : "bigger"} acts. New top pick: ${next.openers[0].name}.`;
    }
  } else if (plan.action === "change_city" || plan.action === "change_capacity") {
    const input = { ...brief.input, ...(plan.action === "change_city" && plan.city ? { city: plan.city } : {}), ...(plan.action === "change_capacity" && plan.capacity ? { capacity: plan.capacity } : {}) };
    const fresh = await buildBrief(input, emit);
    fresh.chat = [...(brief.chat ?? []), { role: "user", text: message, at: new Date().toISOString() }, { role: "assistant", text: `Built a new brief for ${input.headliner} in ${input.city} at ${input.capacity} cap.`, meta: `from brief ${brief.id}`, at: new Date().toISOString() }];
    redirect = `/brief/${fresh.id}`;
    return { brief: fresh, redirect };
  }

  const msgs: ChatMessage[] = [
    { role: "user", text: message, at: new Date().toISOString() },
    { role: "assistant", text: reply || "Done.", meta: `${steps.length} steps`, at: new Date().toISOString() },
  ];
  next.chat = [...(brief.chat ?? []), ...msgs];
  next.trace = [...(brief.trace ?? []), ...steps.map((s) => ({ ...s, id: randomUUID() }))];
  return { brief: next, redirect };
}
