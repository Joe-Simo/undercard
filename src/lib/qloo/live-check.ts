import "server-only";
import { normName } from "../benchmark/score";
import { env } from "../env";
import type { Entity } from "../types";
import { resolveHeadliner } from "../pipeline";
import { englishShort, LiveQlooClient } from "./live";
import type { EntityType } from "./types";

/**
 * Key-day smoke test. Calls every documented Qloo endpoint Undercard uses, once, against the
 * configured base URL, and checks the exact fields the live client reads. Output is a list of
 * named checks with counts and field names only, never Qloo response values, so it is safe to
 * paste into notes. Run it with `pnpm live-check`.
 */
export type Status = "pass" | "warn" | "fail";
export type Check = { name: string; status: Status; detail: string };
type Json = Record<string, unknown>;

export const PROBE = { headliner: "Khruangbin", city: "Nashville, TN", ambiguous: "Nirvana", partial: "Bon Jov" } as const;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const share = <T>(xs: T[], ok: (x: T) => boolean) => (xs.length ? xs.filter(ok).length / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Keys and array lengths only, two levels deep: enough to fix a parser, no Qloo values. */
export function shapeOf(v: unknown, depth = 2): string {
  if (Array.isArray(v)) return `[${v.length}]${v.length && depth > 0 ? ` of ${shapeOf(v[0], depth - 1)}` : ""}`;
  if (v && typeof v === "object") return depth > 0 ? `{ ${Object.entries(v as Json).map(([k, x]) => `${k}: ${shapeOf(x, depth - 1)}`).join(", ")} }` : `{ ${Object.keys(v as Json).join(", ")} }`;
  return typeof v;
}

async function raw(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${env.qlooBaseUrl()}${path}?${qs}`, { headers: { "X-Api-Key": env.qlooKey() ?? "", Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  const body = await res.text();
  let json: Json | null = null;
  try { json = JSON.parse(body) as Json; } catch { /* not JSON */ }
  return { status: res.status, json, snippet: body.slice(0, 160) };
}

export async function runLiveCheck(log: (c: Check) => void = () => {}): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, status: Status, detail: string) => { const c = { name, status, detail }; checks.push(c); log(c); return c; };
  const attempt = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try { return await fn(); } catch (err) { add(name, "fail", err instanceof Error ? err.message.slice(0, 240) : String(err)); return undefined; }
  };

  if (!env.qlooKey()) { add("QLOO_API_KEY", "fail", "not set. Put it in .env.local (gitignored) and run again."); return checks; }
  const host = new URL(env.qlooBaseUrl()).host;
  add("Base URL", host === "hackathon.api.qloo.com" ? "pass" : "warn", host === "hackathon.api.qloo.com" ? host : `${host} (the hackathon key only works on hackathon.api.qloo.com)`);
  const qloo = new LiveQlooClient();

  // 1. GET /search: resolve the headliner, and the field the "Which one?" chips read.
  const search = await attempt("GET /search", () => raw("/search", { query: PROBE.headliner, types: "urn:entity:artist", take: 5 }));
  if (!search) return checks;
  const results = (search.json?.results as Json[] | undefined) ?? [];
  if (search.status !== 200 || !results.length) { add("GET /search", "fail", `HTTP ${search.status}, ${results.length} results. ${search.status === 200 ? "" : search.snippet}`); return checks; }
  const top = results[0];
  const missing = ["entity_id", "name"].filter((k) => typeof top[k] !== "string");
  add("GET /search", missing.length ? "fail" : "pass", missing.length ? `results[0] lacks ${missing.join(", ")}; shape ${shapeOf(top, 1)}` : `${results.length} results, entity_id and name present`);
  const props = (top.properties ?? {}) as Json;
  const source = typeof top.disambiguation === "string" && top.disambiguation !== top.name ? "disambiguation" : typeof englishShort(props.short_descriptions) === "string" ? "properties.short_descriptions" : typeof props.short_description === "string" ? "properties.short_description" : typeof props.description === "string" ? "properties.description" : null;
  add("Search description field", source ? "pass" : "warn", source ? `read from ${source}` : `none of disambiguation, properties.short_descriptions, properties.short_description, properties.description; "Which one?" chips will show names only. properties keys: ${Object.keys(props).join(", ") || "none"}`);

  const resolved = await attempt("Resolve headliner (client)", () => qloo.searchEntity(PROBE.headliner, "urn:entity:artist"));
  const headliner = resolved?.find((e) => normName(e.name) === normName(PROBE.headliner)) ?? resolved?.[0];
  if (!headliner?.id) { add("Resolve headliner (client)", "fail", "the client parsed no entity id from /search"); return checks; }
  add("Resolve headliner (client)", normName(headliner.name) === normName(PROBE.headliner) ? "pass" : "warn", normName(headliner.name) === normName(PROBE.headliner) ? "exact name match, id parsed" : "first result is not an exact name match; check the resolver");

  // A well-known name with namesakes should resolve to one artist; a partial name should ask "Which one?".
  const amb = await attempt("Which one? probe", () => qloo.searchEntity(PROBE.ambiguous, "urn:entity:artist"));
  if (amb) {
    const r = resolveHeadliner(PROBE.ambiguous, amb);
    add("Exact name resolves", r.pick ? "pass" : "warn", r.pick ? `"${PROBE.ambiguous}" resolves to one artist out of ${amb.length} results` : `"${PROBE.ambiguous}" asks Which one? with ${r.candidates.length} choices`);
  }
  const part = await attempt("Which one? probe", () => qloo.searchEntity(PROBE.partial, "urn:entity:artist"));
  if (part) {
    const r = resolveHeadliner(PROBE.partial, part);
    add("Which one? probe", !r.pick && r.candidates.length >= 2 ? "pass" : "warn", !r.pick ? `"${PROBE.partial}" offers ${r.candidates.length} choices, ${r.candidates.filter((e) => e.description).length} with a description` : `"${PROBE.partial}" resolved without asking`);
  }

  // 2. GET /v2/insights for artists in a city: the ranked bill.
  const sig = [headliner.id];
  const artistQuery = (extra: Partial<Parameters<LiveQlooClient["insights"]>[0]> = {}) => qloo.insights({ type: "urn:entity:artist", signalEntities: sig, locationQuery: PROBE.city, take: 15, ...extra });
  const local = await attempt("Local artists (insights)", () => artistQuery());
  let localIds: string[] = [];
  if (local) {
    localIds = local.map((e) => e.id);
    const aff = share(local, (e) => isNum(e.affinity));
    const pop = share(local, (e) => isNum(e.popularity));
    const ok = local.length > 0 && aff >= 0.8 && pop >= 0.8;
    add("Local artists (insights)", ok ? "pass" : "fail", `${local.length} artists; query.affinity on ${pct(aff)}, popularity on ${pct(pop)}${ok ? "" : ". Ranking and size bands need both"}`);
    if (!ok && local.length === 0) {
      const r = await raw("/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": headliner.id, "signal.location.query": PROBE.city, take: 3 });
      add("Local artists raw shape", "warn", `HTTP ${r.status} ${shapeOf(r.json)}`);
    }
  }
  const national = await attempt("Location changes the ranking", () => artistQuery({ locationQuery: undefined }));
  if (local && national) {
    const differ = local.filter((e, i) => national[i]?.id !== e.id).length;
    add("Location changes the ranking", differ > 0 ? "pass" : "warn", differ > 0 ? `${differ} of ${local.length} positions differ from the no-location query` : "identical to the no-location query: signal.location.query may be ignored for artists");
  }

  // 3. Popularity filters: "go smaller" and "go bigger" in Ask Undercard.
  for (const [label, extra, inBand] of [
    ["filter.popularity.max", { popularityMax: 0.6 }, (p: number) => p <= 0.6 + 1e-6],
    ["filter.popularity.min", { popularityMin: 0.9 }, (p: number) => p >= 0.9 - 1e-6],
  ] as const) {
    const rows = await attempt(label, () => artistQuery(extra));
    if (!rows) continue;
    const priced = rows.filter((e) => isNum(e.popularity));
    const inside = priced.filter((e) => inBand(e.popularity as number)).length;
    const status: Status = !rows.length ? "fail" : inside === priced.length && priced.length ? "pass" : "fail";
    add(label, status, !rows.length ? "no artists returned; the edit would come back empty" : `${inside} of ${priced.length} results inside the band${status === "fail" ? ": the filter looks ignored for artists, so filter client-side" : ""}`);
  }

  // 4. Overlap: GET /v2/analysis/compare (no published response schema, so report the shape).
  const opener = localIds.find((id) => id !== headliner.id);
  if (opener) {
    const r = await attempt("GET /v2/analysis/compare", () => raw("/v2/analysis/compare", { "a.signal.interests.entities": headliner.id, "b.signal.interests.entities": opener }));
    if (r) {
      const res = ((r.json?.results ?? r.json) ?? {}) as Json;
      const list = (Array.isArray(res.tags) ? res.tags : Array.isArray(res.entities) ? res.entities : []) as Json[];
      const scored = list.filter((t) => { const q = (t.query ?? {}) as Json; return isNum(q.affinity) || isNum(q.score) || isNum(t.score); }).length;
      const status: Status = r.status !== 200 ? "fail" : !list.length ? "fail" : scored ? "pass" : "warn";
      add("GET /v2/analysis/compare", status, r.status !== 200 ? `HTTP ${r.status}: ${r.snippet}` : `${list.length} shared items, ${scored} with a score the parser reads. Shape: ${shapeOf(r.json, 3)}`);
      const ov = await attempt("Overlap (client)", () => qloo.compare(headliner.id, opener));
      if (ov) add("Overlap (client)", ov.sharedTags.length && ov.score >= 0 && ov.score <= 1 ? "pass" : "fail", `score in range: ${ov.score >= 0 && ov.score <= 1}, ${ov.sharedTags.length} shared tags parsed`);
    }
  } else add("GET /v2/analysis/compare", "fail", "skipped: no local artist to compare against");

  // 5. Supporting notes.
  const heat = await attempt("Heatmap (urn:heatmap)", () => qloo.heatmap({ signalEntities: sig, locationQuery: PROBE.city, radiusMeters: 480_000 }));
  if (heat) {
    const good = share(heat, (c) => isNum(c.lat) && isNum(c.lng) && c.affinity >= 0 && c.affinity <= 1);
    add("Heatmap (urn:heatmap)", heat.length && good >= 0.9 ? "pass" : "fail", `${heat.length} cells, ${pct(good)} with location.latitude, location.longitude, query.affinity`);
  }
  const demo = await attempt("Demographics (urn:demographics)", () => qloo.demographics(headliner.id));
  if (demo) add("Demographics (urn:demographics)", demo.age.length ? "pass" : "fail", `${demo.age.length} age buckets, ${demo.gender.length} gender buckets`);
  const typed: [string, EntityType][] = [["Places near the venue", "urn:entity:place"], ["Brands", "urn:entity:brand"], ["Podcasts", "urn:entity:podcast"], ["TV shows", "urn:entity:tv_show"]];
  for (const [label, type] of typed) {
    const rows: Entity[] | undefined = await attempt(label, () => qloo.insights({ type, signalEntities: sig, locationQuery: PROBE.city, take: 6 }));
    if (rows) add(label, rows.length ? "pass" : "fail", `${rows.length} results via ${type === "urn:entity:place" ? "filter.location.query" : "signal.location.query"}${type === "urn:entity:place" ? `, ${rows.filter((p) => p.address).length} with properties.address` : ""}`);
  }
  return checks;
}
