import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { nearestCity } from "./cities";
import { writeJson } from "./llm";
import { getQloo, type EntityType } from "./qloo";
import type { Brief, BriefEvent, Entity, OpenerPick, ShowInput, TraceStep } from "./types";

/** Capacity to Qloo popularity band (percentile). Small rooms need artists who are not yet huge. */
function sizeBand(capacity: number, popularity = 0.5): OpenerPick["sizeBand"] {
  const ideal = capacity <= 300 ? 0.55 : capacity <= 800 ? 0.68 : capacity <= 2500 ? 0.8 : 0.9;
  if (popularity > ideal + 0.15) return "too big";
  if (popularity > ideal + 0.05) return "stretch";
  if (popularity < ideal - 0.3) return "too small";
  return "right-size";
}

const Writeup = z.object({
  openers: z.array(z.object({ name: z.string(), rationale: z.string() })),
  social: z.string(),
  tagline: z.string(),
  adSummary: z.string(),
});

const GutCheck = z.object({ picks: z.array(z.string()).max(5) });

export async function buildBrief(input: ShowInput, emit: (e: BriefEvent) => void): Promise<Brief> {
  const qloo = getQloo();
  const mocked = qloo.name === "mock";
  const steps: TraceStep[] = [];
  async function step<T>(label: string, tool: TraceStep["tool"], endpoint: string | undefined, fn: () => Promise<T>, detail?: (v: T) => string): Promise<T> {
    const s: TraceStep = { id: randomUUID(), label, tool, endpoint, mocked: tool === "qloo" ? mocked : false, status: "running" };
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

  const [headliner] = await step(`Resolve "${input.headliner}"`, "qloo", "GET /search", () => qloo.searchEntity(input.headliner, "urn:entity:artist"), (r) => (r[0] ? `${r[0].name} (${r[0].id.slice(0, 12)})` : "No match"));
  if (!headliner) throw new Error(`Qloo could not find an artist called "${input.headliner}".`);
  const sig = [headliner.id];

  const local = await step(`Artists this audience loves in ${input.city}`, "qloo", "GET /v2/insights filter.type=artist + filter.location.query", () =>
    qloo.insights({ type: "urn:entity:artist", signalEntities: sig, locationQuery: input.city, take: 15 }),
    (r) => `${r.length} affinity-ranked artists`);

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

  const candidates = local.filter((e) => e.id !== headliner.id).slice(0, 10);
  const banded = candidates.map((e) => ({ ...e, sizeBand: sizeBand(input.capacity, e.popularity) }));
  const ordered = [...banded.filter((e) => e.sizeBand === "right-size"), ...banded.filter((e) => e.sizeBand === "stretch"), ...banded.filter((e) => e.sizeBand !== "right-size" && e.sizeBand !== "stretch")].slice(0, 5);

  const evidence = JSON.stringify({ headliner: headliner.name, city: input.city, capacity: input.capacity, openers: ordered.map((o) => ({ name: o.name, affinity: o.affinity, popularity: o.popularity, sizeBand: o.sizeBand })), places: places.map((p) => p.name), brands: brands.map((b) => b.name), podcasts: podcasts.map((p) => p.name), tv: tv.map((t) => t.name) });

  const writeup = await step("Write the show brief from Qloo evidence", "llm", undefined, () =>
    writeJson({
      system: "You are a talent buyer for independent venues. Write short, specific rationales and marketing copy. You may ONLY mention entities that appear in the evidence JSON. Never invent artists, places, or numbers.",
      prompt: evidence,
      schema: Writeup,
      mock: () => ({
        openers: ordered.map((o) => ({ name: o.name, rationale: `Ranks high with ${headliner.name}'s audience in ${input.city} (affinity ${Math.round((o.affinity ?? 0) * 100)}) and is ${o.sizeBand === "right-size" ? "the right size" : o.sizeBand} for a ${input.capacity}-cap room.` })),
        social: `${headliner.name} in ${input.city}, with ${ordered[0]?.name ?? "special guests"}. Pre-show at ${places[0]?.name ?? "a local favorite"}.`,
        tagline: `${headliner.name} + ${ordered[0]?.name ?? "friends"}: one night only.`,
        adSummary: `Lead with ${podcasts[0]?.name ?? "podcast"} and ${tv[0]?.name ?? "TV"} audiences; ask ${brands[0]?.name ?? "a brand partner"} about a sponsorship.`,
      }),
    }), (w) => `${w.mocked ? "Simulated" : w.model}, ${w.ms} ms`);

  const gut = await step("Gut check: ask the LLM alone (no Qloo)", "llm", undefined, () =>
    writeJson({
      system: "Suggest opening acts for a concert. Answer from general knowledge only.",
      prompt: `Headliner: ${headliner.name}. City: ${input.city}. Venue capacity: ${input.capacity}. Name 5 openers.`,
      schema: GutCheck,
      mock: () => ({ picks: ["(simulated) the most famous similar act", "(simulated) a stadium-size band", "(simulated) a generic genre pick"] }),
    }), (g) => `${g.value.picks.length} picks`);

  const rationale = new Map(writeup.value.openers.map((o) => [o.name, o.rationale]));
  const openers: OpenerPick[] = ordered.map((o) => ({ ...o, rationale: rationale.get(o.name) ?? "" }));

  const byCity = new Map<string, { city: string; lat: number; lng: number; affinity: number }>();
  for (const c of heat) {
    const n = nearestCity(c.lat, c.lng);
    if (n.distance > 1.5) continue;
    const prev = byCity.get(n.city);
    if (!prev || prev.affinity < c.affinity) byCity.set(n.city, { ...n, affinity: c.affinity });
  }
  const routing = [...byCity.values()].sort((a, b) => b.affinity - a.affinity).slice(0, 5).map((r) => ({ ...r, note: r.affinity > 0.75 ? "Strong pocket of this taste" : r.affinity > 0.5 ? "Solid secondary market" : "Weaker signal" }));

  const brief: Brief = {
    id: randomUUID().slice(0, 8),
    input,
    headliner,
    openers,
    routing,
    partners: { places: places as Entity[], brands },
    adPlan: { podcasts, tv, summary: writeup.value.adSummary },
    audience,
    copy: { social: writeup.value.social, tagline: writeup.value.tagline },
    gutCheck: { llmOnly: gut.value.picks, note: "Same question, no Qloo: famous names, no local signal, no sense of room size." },
    sample: mocked,
    createdAt: new Date().toISOString(),
  };
  emit({ type: "done", brief });
  return brief;
}
