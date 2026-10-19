import "server-only";
import { env } from "../env";
import type { AudienceShape, Entity, Overlap } from "../types";
import { qlooLocation } from "./locality";
import type { EntityType, HeatCell, QlooClient } from "./types";

type Json = Record<string, unknown>;

/**
 * Live Qloo client for the hackathon environment.
 * Docs: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide and
 * https://github.com/qloo/docs-public/tree/main/reference (parameters.md, available-parameters-by-entity-type.md).
 * GET only, key in X-Api-Key, base URL hackathon.api.qloo.com. Invalid params are silently ignored,
 * so every call here uses only documented parameters, and each one is listed in README "Qloo calls".
 *
 * Location: `filter.location.*` is documented only for places, destinations, and heatmaps. For
 * artists, brands, podcasts, and TV the documented way to localize taste is `signal.location.query`
 * (insights-with-location-use-case.md), so non-place types use that instead.
 * Responses are cached server-side (allowed by Qloo) and never written to the repository.
 */
export class LiveQlooClient implements QlooClient {
  readonly name = "qloo" as const;

  private async get(path: string, params: Record<string, string | number | undefined>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
    const call = () => fetch(`${env.qlooBaseUrl()}${path}?${qs}`, {
      headers: { "X-Api-Key": env.qlooKey()!, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      next: { revalidate: 60 * 60 * 24 },
    });
    let res = await call();
    // A burst of parallel calls can briefly hit the rate limit; one short retry covers it.
    for (let i = 0; i < 2 && (res.status === 429 || res.status >= 500); i++) {
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
      res = await call();
    }
    if (!res.ok) throw new Error(`Qloo ${res.status} on ${path}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return (await res.json()) as Json;
  }

  async searchEntity(query: string, type: EntityType) {
    const data = await this.get("/search", { query, types: type, take: 5 });
    return ((data.results as Json[]) ?? []).map(toEntity);
  }

  async insights(opts: { type: EntityType; signalEntities: string[]; locationQuery?: string; take?: number; popularityMax?: number; popularityMin?: number }) {
    const data = await this.get("/v2/insights", {
      "filter.type": opts.type,
      "signal.interests.entities": opts.signalEntities.join(","),
      [opts.type === "urn:entity:place" || opts.type === "urn:entity:destination" ? "filter.location.query" : "signal.location.query"]: qlooLocation(opts.locationQuery),
      "filter.popularity.max": opts.popularityMax,
      "filter.popularity.min": opts.popularityMin,
      take: opts.take ?? 10,
    });
    const results = data.results as Json | undefined;
    // Qloo echoes the locality it matched; keep its full name so the trace can show where "this city" landed.
    const loc = ((data.query as Json | undefined)?.localities as Json | undefined) ?? {};
    const matched = ((loc.signal ?? loc.filter) as Json | undefined)?.disambiguation;
    return Object.assign(((results?.entities as Json[]) ?? []).map(toEntity), { locality: typeof matched === "string" ? matched : undefined });
  }

  async heatmap(opts: { signalEntities: string[]; locationQuery: string; radiusMeters?: number }) {
    const data = await this.get("/v2/insights", {
      "filter.type": "urn:heatmap",
      "signal.interests.entities": opts.signalEntities.join(","),
      "filter.location.query": qlooLocation(opts.locationQuery),
      "filter.location.radius": opts.radiusMeters,
    });
    const cells = ((data.results as Json | undefined)?.heatmap as Json[]) ?? [];
    return cells.map((c): HeatCell => {
      const loc = (c.location ?? {}) as Json;
      const q = (c.query ?? {}) as Json;
      return { lat: Number(loc.latitude), lng: Number(loc.longitude), affinity: Number(q.affinity ?? 0), popularity: Number(q.popularity ?? 0) };
    });
  }

  /**
   * Shared taste between two entities: GET /v2/analysis/compare with the documented
   * `a.signal.interests.entities` and `b.signal.interests.entities` (reference/analysis-compare.md).
   * Verified live on the hackathon server (Oct 19): results.tags is the shared tags, sorted by
   * query.score; results.a and results.b hold the tags only one side has. The score here is the mean
   * query.score of the top 10 shared tags.
   */
  async compare(a: string, b: string): Promise<Overlap> {
    const data = await this.get("/v2/analysis/compare", {
      "a.signal.interests.entities": a,
      "b.signal.interests.entities": b,
    });
    const results = (data.results ?? data) as Json;
    const tags = ((results.tags as Json[]) ?? (results.entities as Json[]) ?? []).slice(0, 10);
    const shared = tags.map((t) => String(t.name ?? "")).filter(Boolean);
    const scoreOf = (t: Json) => { const q = (t.query ?? {}) as Json; return Number(q.affinity ?? q.score ?? t.score ?? NaN); };
    const scores = tags.map(scoreOf).filter((n) => Number.isFinite(n));
    const score = scores.length ? Math.max(0, Math.min(1, scores.reduce((x, y) => x + y, 0) / scores.length)) : shared.length / 10;
    return { score, sharedTags: shared.slice(0, 5) };
  }

  async demographics(entityId: string): Promise<AudienceShape> {
    const data = await this.get("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": entityId });
    const row = (((data.results as Json | undefined)?.demographics as Json[]) ?? [])[0];
    const q = (row?.query ?? {}) as Json;
    const toList = (o: unknown) => Object.entries((o ?? {}) as Record<string, number>).map(([label, value]) => ({ label: label.replace(/_/g, " "), value: Number(value) }));
    const age = toList(q.age);
    const gender = toList(q.gender);
    const top = [...age].sort((a, b) => b.value - a.value)[0];
    return { age, gender, summary: top ? `Over-indexes most with ages ${top.label}.` : "No demographic signal returned." };
  }
}

export function toEntity(r: Json): Entity {
  const props = (r.properties ?? {}) as Json;
  const q = (r.query ?? {}) as Json;
  const img = (props.image as Json | undefined)?.url as string | undefined;
  return {
    id: String(r.entity_id ?? r.id ?? ""),
    name: String(r.name ?? "Unknown"),
    type: String((r.types as string[] | undefined)?.[0] ?? r.subtype ?? ""),
    popularity: typeof r.popularity === "number" ? r.popularity : undefined,
    affinity: typeof q.affinity === "number" ? q.affinity : undefined,
    tags: ((r.tags as Json[] | undefined) ?? []).slice(0, 5).map((t) => String(t.name ?? "")).filter(Boolean),
    image: img,
    address: props.address as string | undefined,
    // Field names vary by entity type, so take the first short human-readable line that exists:
    // top-level `disambiguation` (skipped when it only repeats the name, as the hackathon server does), then the English entry of `properties.short_descriptions`
    // (an array of { value, languages } in Qloo's samples), then a plain description.
    description: firstString(r.disambiguation !== r.name ? r.disambiguation : undefined, englishShort(props.short_descriptions), props.short_description, props.description)?.slice(0, 140),
  };
}

export function englishShort(list: unknown) {
  if (!Array.isArray(list)) return undefined;
  const rows = list as { value?: unknown; languages?: unknown }[];
  return (rows.find((d) => Array.isArray(d.languages) && d.languages.includes("en")) ?? rows[0])?.value;
}

function firstString(...values: unknown[]) {
  return values.find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim();
}
