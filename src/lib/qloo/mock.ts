import "server-only";
import type { AudienceShape, Entity } from "../types";
import type { EntityType, HeatCell, QlooClient } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Deterministic pseudo-random numbers so the same query always gives the same simulated answer. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Invented names. Mock mode never presents fake numbers attached to real artists or businesses.
const POOL: Record<string, string[]> = {
  "urn:entity:artist": ["The Prairie Lights", "Velvet Grain Elevator", "Hollis & the Long Drive", "Neon Cattle", "Juniper Static", "Low Tide Choir", "Marigold Engine", "The Quiet Rivals", "Saint Halcyon", "Copper Moth", "Dear Telescope", "Paper Lantern Union"],
  "urn:entity:brand": ["Sample Cold Brew Co.", "Sample Trail Outfitters", "Sample Vinyl Club", "Sample Hard Seltzer", "Sample Denim Works", "Sample Skate Supply"],
  "urn:entity:place": ["Sample Taproom", "Sample Taqueria", "Sample Record Shop", "Sample Late-Night Diner", "Sample Coffee Bar", "Sample Pizza Kitchen"],
  "urn:entity:podcast": ["Sample Indie Hour", "Sample Tour Diaries", "Sample Culture Desk", "Sample Midwest Mornings", "Sample Deep Cuts"],
  "urn:entity:tv_show": ["Sample Road Trip Drama", "Sample Kitchen Comedy", "Sample Small Town Mystery", "Sample Music Documentary Series"],
  "urn:entity:movie": ["Sample Coming-of-Age Film"],
  "urn:entity:destination": ["Sample City"],
};

const NEARBY: Record<string, { city: string; lat: number; lng: number }[]> = {
  default: [
    { city: "Kansas City, MO", lat: 39.0997, lng: -94.5786 },
    { city: "Omaha, NE", lat: 41.2565, lng: -95.9345 },
    { city: "Wichita, KS", lat: 37.6872, lng: -97.3301 },
    { city: "Columbia, MO", lat: 38.9517, lng: -92.3341 },
    { city: "Tulsa, OK", lat: 36.154, lng: -95.9928 },
    { city: "Des Moines, IA", lat: 41.5868, lng: -93.625 },
    { city: "St. Louis, MO", lat: 38.627, lng: -90.1994 },
    { city: "Lawrence, KS", lat: 38.9717, lng: -95.2353 },
  ],
};

export class MockQlooClient implements QlooClient {
  readonly name = "mock" as const;

  async searchEntity(query: string, type: EntityType): Promise<Entity[]> {
    await sleep(150);
    return [{ id: `mock-${slug(query)}`, name: query, type, popularity: 0.9, tags: ["simulated"] }];
  }

  async insights(opts: { type: EntityType; signalEntities: string[]; locationQuery?: string; take?: number; popularityMax?: number }): Promise<Entity[]> {
    await sleep(200 + Math.random() * 200);
    const rnd = seeded(`${opts.type}|${opts.signalEntities.join()}|${opts.locationQuery ?? ""}`);
    const pool = POOL[opts.type] ?? ["Sample entity"];
    return pool
      .map((name, i) => ({
        id: `mock-${slug(name)}`,
        name,
        type: opts.type,
        popularity: Math.round((0.35 + rnd() * 0.6) * 100) / 100,
        affinity: Math.round((0.95 - i * 0.05 - rnd() * 0.05) * 100) / 100,
        tags: ["simulated"],
      }))
      .filter((e) => opts.popularityMax == null || (e.popularity ?? 0) <= opts.popularityMax)
      .slice(0, opts.take ?? 10);
  }

  async heatmap(opts: { signalEntities: string[]; locationQuery: string }): Promise<HeatCell[]> {
    await sleep(250);
    const rnd = seeded(`heat|${opts.signalEntities.join()}|${opts.locationQuery}`);
    return NEARBY.default.map((c) => ({ lat: c.lat, lng: c.lng, affinity: Math.round((0.3 + rnd() * 0.7) * 100) / 100 }));
  }

  async demographics(entityId: string): Promise<AudienceShape> {
    await sleep(150);
    const rnd = seeded(`demo|${entityId}`);
    const age = ["24 and younger", "25 to 29", "30 to 34", "35 to 44", "45 to 54", "55 and older"].map((label) => ({ label, value: Math.round((rnd() * 2 - 1) * 100) / 100 }));
    const top = [...age].sort((a, b) => b.value - a.value)[0];
    return { age, gender: [{ label: "female", value: Math.round((rnd() - 0.5) * 100) / 100 }, { label: "male", value: Math.round((rnd() - 0.5) * 100) / 100 }], summary: `Simulated: over-indexes most with ages ${top.label}.` };
  }
}

export const MOCK_CITIES = NEARBY.default;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
