import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { findCity, nearestCity } from "./cities";
import { env } from "./env";
import { writeJson } from "./llm";
import { getQloo, type EntityType } from "./qloo";
import { roomCeiling, sizeBand } from "./size";
import type { Brief, BriefEvent, Entity, OpenerPick, Overlap, ShowInput, SizeBand, TraceStep } from "./types";

export { sizeBand };

export function rankBySize<T extends Entity>(entities: T[], capacity: number) {
  const banded = entities.map((e) => ({ ...e, sizeBand: sizeBand(capacity, e.popularity) as SizeBand }));
  const order: SizeBand[] = ["right-size", "stretch", "too small", "too big"];
  return banded.sort((a, b) => order.indexOf(a.sizeBand) - order.indexOf(b.sizeBand) || (b.affinity ?? 0) - (a.affinity ?? 0));
}

/** Score audience overlap for each opener vs. the headliner. Failures degrade to "unknown" rather than breaking the brief. */
export async function overlapFor(headlinerId: string, ids: string[]): Promise<Map<string, Overlap>> {
  const qloo = getQloo();
  const out = new Map<string, Overlap>();
  await Promise.all(ids.map(async (id) => {
    try { out.set(id, await qloo.compare(headlinerId, id)); } catch { /* leave unknown */ }
  }));
  return out;
}

/** Shared tracer so the pipeline and follow-up chat log the same way. */
export function makeTracer(mocked: boolean, llmMocked: boolean, emit: (e: BriefEvent) => void) {
  const steps: TraceStep[] = [];
  async function step<T>(label: string, tool: TraceStep["tool"], endpoint: string | undefined, fn: () => Promise<T>, detail?: (v: T) => string): Promise<T> {
    const s: TraceStep = { id: randomUUID(), label, tool, endpoint, mocked: tool === "qloo" ? mocked : tool === "llm" ? llmMocked : false, status: "running" };
    steps.push(s);
    emit({ type: "step", step: { ...s } });
    const t = Date.now();
    try {
      const v = await fn();
      Object.assign(s, { status: "ok", ms: Date.now() - t, detail: detail?.(v) });
      emit({ type: "step", step: { ...s } });
      return v;
    } catch (err) {
      Object.assign(s, { status: "error", ms: Date.now() - t, detail: String(err).slice(0, 200) });
      emit({ type: "step", step: { ...s } });
      throw err;
    }
  }
  return { steps, step };
}

export function describeLlm(w: { mocked: boolean; fallback?: string; provider: string; model: string; ms: number; cached?: boolean }) {
  if (w.fallback) return `LLM unavailable (${w.fallback}), used template`;
  if (w.mocked) return "Templated";
  return `${w.provider} ${w.model.replace(/:free$/, "")}${w.cached ? " (cached)" : ""}, ${w.ms} ms`;
}

const Writeup = z.object({
  openers: z.array(z.object({ name: z.string(), rationale: z.string() })),
  social: z.string(),
  tagline: z.string(),
  adSummary: z.string(),
});

const GutCheck = z.object({ picks: z.array(z.string()).max(5) });

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Decide whether a search is clear enough to run. One exact name match wins (typing "Wednesday" should not
 * ask about "Wednesday 13"). Several exact matches, or several partial ones, mean we ask the user which one.
 */
export function resolveHeadliner(query: string, results: Entity[]): { pick?: Entity; candidates: Entity[] } {
  const q = norm(query);
  const plausible = results.filter((r) => { const n = norm(r.name); return !!n && (n === q || n.includes(q) || q.includes(n)); });
  const exact = plausible.filter((r) => norm(r.name) === q);
  if (exact.length === 1) return { pick: exact[0], candidates: [] };
  if (exact.length > 1) return { candidates: exact.slice(0, 4) };
  if (plausible.length === 1) return { pick: plausible[0], candidates: [] };
  // Nothing matched the name closely (often a typo): offer Qloo's best guesses instead of silently picking one.
  return { candidates: (plausible.length ? plausible : results).slice(0, 4) };
}

/**
 * Build a show brief. Returns null when the headliner is ambiguous: a "choose" event carries the candidates,
 * and the caller runs again with input.headlinerId set. Pass autoPick to take the best match instead.
 */
/** Qloo scores are 0..1; the buyer and the model both see them as whole numbers out of 100. */
const score100 = (x?: number) => (typeof x === "number" ? Math.round(x * 100) : undefined);

export async function buildBrief(input: ShowInput, emit: (e: BriefEvent) => void, opts: { id?: string; featured?: string; autoPick?: boolean } = {}): Promise<Brief | null> {
  const qloo = getQloo();
  const mocked = qloo.name === "mock";
  const llmCfg = env.llm();
  const { steps, step } = makeTracer(mocked, llmCfg.name === "mock", emit);

  const resolved = await step(`Resolve "${input.headliner}"`, "qloo", "GET /search", async () => {
    const results = await qloo.searchEntity(input.headliner, "urn:entity:artist");
    const chosen = input.headlinerId ? results.find((r) => r.id === input.headlinerId) : undefined;
    return { total: results.length, ...(chosen ? { pick: chosen, candidates: [] } : resolveHeadliner(input.headliner, results)) };
  }, (r) => r.pick ? `${r.pick.name} (${r.pick.id.slice(0, 12)})${r.total > 1 ? `, chosen from ${r.total} matches` : ""}` : r.candidates.length ? `${r.candidates.length} possible matches, asking which one` : "No match");
  if (!resolved.pick && resolved.candidates.length && !opts.autoPick) {
    emit({ type: "choose", query: input.headliner, candidates: resolved.candidates });
    return null;
  }
  const headliner = resolved.pick ?? resolved.candidates[0];
  if (!headliner) throw new Error(`Qloo has no artist called "${input.headliner}". Check the spelling or try their full name.`);
  input = { ...input, headlinerId: headliner.id };
  const sig = [headliner.id];

  const ceiling = roomCeiling(input.capacity);
  const [top, roomSized] = await Promise.all([
    step(`Artists this audience loves in ${input.city}`, "qloo", "GET /v2/insights filter.type=artist + signal.location.query", () =>
      qloo.insights({ type: "urn:entity:artist", signalEntities: sig, locationQuery: input.city, take: 15 }),
      (r) => `${r.length} affinity-ranked artists${r.locality ? `, Qloo matched ${r.locality}` : ""}`),
    ceiling === undefined ? Promise.resolve([] as Entity[]) :
      step(`Acts that fit a ${input.capacity.toLocaleString("en-US")}-cap room`, "qloo", `GET /v2/insights filter.type=artist + filter.popularity.max=${ceiling}`, () =>
        qloo.insights({ type: "urn:entity:artist", signalEntities: sig, locationQuery: input.city, take: 15, popularityMax: ceiling }),
        (r) => `${r.length} artists under popularity ${Math.round(ceiling * 100)}`),
  ]);
  const local = [...new Map([...roomSized, ...top].map((e) => [e.id, e])).values()];

  const heat = await step(`Where this taste concentrates`, "qloo", "GET /v2/insights filter.type=urn:heatmap", () =>
    qloo.heatmap({ signalEntities: sig, locationQuery: input.city, radiusMeters: 480_000 }), (r) => `${r.length} hotspots`);

  const cross = async (type: EntityType, label: string, loc?: string) =>
    step(label, "qloo", `GET /v2/insights filter.type=${type.split(":").pop()}`, () => qloo.insights({ type, signalEntities: sig, locationQuery: loc, take: 6 }), (r) => `${r.length} results`);
  const [places, brands, podcasts, tv] = await Promise.all([
    cross("urn:entity:place", `Local spots this crowd over-indexes on in ${input.city}`, input.city),
    cross("urn:entity:brand", "Brands for sponsorship"),
    cross("urn:entity:podcast", "Podcasts for ad buys"),
    cross("urn:entity:tv_show", "TV this audience watches"),
  ]);
  const audience = await step("Audience demographics", "qloo", "GET /v2/insights filter.type=urn:demographics", () => qloo.demographics(headliner.id), (a) => a.summary);

  const ranked = rankBySize(local.filter((e) => e.id !== headliner.id), input.capacity);
  const ordered = ranked.slice(0, 5);
  const bench = ranked.slice(5, 15);
  const overlaps = await step("Audience overlap: headliner vs. each opener", "qloo", "GET /v2/analysis/compare", () => overlapFor(headliner.id, ordered.map((o) => o.id)), (m) => `${m.size} of ${ordered.length} scored`);

  const evidence = JSON.stringify({ headliner: headliner.name, city: input.city, capacity: input.capacity, openers: ordered.map((o) => ({ name: o.name, affinity: score100(o.affinity), popularity: score100(o.popularity), sizeBand: o.sizeBand, overlap: score100(overlaps.get(o.id)?.score), sharedTags: overlaps.get(o.id)?.sharedTags })), places: places.map((p) => p.name), brands: brands.map((b) => b.name), podcasts: podcasts.map((p) => p.name), tv: tv.map((t) => t.name) });

  const writeup = await step("Write the show brief from Qloo evidence", "llm", undefined, () =>
    writeJson({
      system: "You are a talent buyer for independent venues. Write short, specific rationales and marketing copy in plain, fully punctuated sentences. You may ONLY mention entities that appear in the evidence JSON. Never invent artists, places, or numbers. Scores are 0 to 100, the scale the buyer sees. Each opener rationale is one sentence under 25 words that explains the fit from its shared tags and size band; the scores are already shown beside it, so do not repeat them, and do not call an act the highest or best unless the evidence shows it.",
      prompt: evidence,
      schema: Writeup,
      mock: () => ({
        openers: ordered.map((o) => ({ name: o.name, rationale: `Ranks high with ${headliner.name}'s audience in ${input.city} (affinity ${Math.round((o.affinity ?? 0) * 100)}) and is ${o.sizeBand === "right-size" ? "the right size" : o.sizeBand} for a ${input.capacity}-cap room.` })),
        social: `${headliner.name} in ${input.city}, with ${ordered[0]?.name ?? "special guests"}. Pre-show at ${places[0]?.name ?? "a local favorite"}.`,
        tagline: `${headliner.name} + ${ordered[0]?.name ?? "friends"}: one night only.`,
        adSummary: `Lead with ${podcasts[0]?.name ?? "podcast"} and ${tv[0]?.name ?? "TV"} audiences; ask ${brands[0]?.name ?? "a brand partner"} about a sponsorship.`,
      }),
    }), describeLlm);

  const gut = await step("Gut check: ask the LLM alone (no Qloo)", "llm", undefined, () =>
    writeJson({
      system: "Suggest opening acts for a concert. Answer from general knowledge only.",
      prompt: `Headliner: ${headliner.name}. City: ${input.city}. Venue capacity: ${input.capacity}. Name 5 openers.`,
      schema: GutCheck,
      mock: () => ({ picks: ["(simulated) the most famous similar act", "(simulated) a stadium-size band", "(simulated) a generic genre pick"] }),
    }), (g) => `${g.value.picks.length} picks, ${describeLlm(g)}`);

  const rationale = new Map(writeup.value.openers.map((o) => [o.name, o.rationale]));
  const openers: OpenerPick[] = ordered.map((o) => ({ ...o, overlap: overlaps.get(o.id)?.score, sharedTags: overlaps.get(o.id)?.sharedTags, rationale: rationale.get(o.name) ?? "" }));

  const byCity = new Map<string, { city: string; lat: number; lng: number; affinity: number }>();
  for (const c of heat) {
    const n = nearestCity(c.lat, c.lng);
    if (n.distance > 2 || n.city === findCity(input.city)?.city) continue;
    const prev = byCity.get(n.city);
    if (!prev || prev.affinity < c.affinity) byCity.set(n.city, { ...n, affinity: c.affinity });
  }
  const routing = [...byCity.values()].sort((a, b) => b.affinity - a.affinity).slice(0, 5).map((r) => ({ ...r, note: r.affinity > 0.75 ? "Strong pocket of this taste" : r.affinity > 0.5 ? "Solid secondary market" : "Weaker signal" }));

  const brief: Brief = {
    id: opts.id ?? randomUUID().slice(0, 8),
    featured: opts.featured,
    input,
    headliner,
    openers,
    routing,
    partners: { places: places as Entity[], brands },
    adPlan: { podcasts, tv, summary: writeup.value.adSummary },
    audience,
    copy: { social: writeup.value.social, tagline: writeup.value.tagline },
    gutCheck: { llmOnly: gut.value.picks, note: "Same question, asked without Qloo data. Compare the two lists side by side." },
    bench,
    center: (() => { const c = findCity(input.city); if (c) return { lat: c.lat, lng: c.lng }; const h = heat[0]; return h ? { lat: h.lat, lng: h.lng } : { lat: 39.5, lng: -96 }; })(),
    heat: heat.slice(0, 60).map((c) => ({ lat: c.lat, lng: c.lng, affinity: c.affinity })),
    trace: steps.map((s) => ({ ...s })),
    chat: [],
    llm: llmCfg.name === "mock" ? "template" : `${llmCfg.name}:${llmCfg.model}`,
    sample: mocked,
    createdAt: new Date().toISOString(),
  };
  emit({ type: "done", brief });
  return brief;
}
