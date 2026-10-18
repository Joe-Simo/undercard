import "server-only";
import { CITIES, findCity } from "../cities";
import type { AudienceShape, Entity, Overlap } from "../types";
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

/**
 * Search fixtures for names that match more than one artist, so the "Which one?" step can be built and
 * tested before the key arrives. Names and descriptions are real and factual; no numbers are attached.
 */
const AMBIGUOUS: Record<string, { id: string; name: string; description: string }[]> = {
  nirvana: [
    { id: "mock-nirvana-aberdeen", name: "Nirvana", description: "Grunge band from Aberdeen, WA" },
    { id: "mock-nirvana-london", name: "Nirvana", description: "Psychedelic pop duo from London" },
  ],
  big: [
    { id: "mock-big-thief", name: "Big Thief", description: "Indie folk band from Brooklyn, NY" },
    { id: "mock-big-star", name: "Big Star", description: "Power pop band from Memphis, TN" },
    { id: "mock-big-boi", name: "Big Boi", description: "Rapper from Atlanta, GA" },
  ],
  kings: [
    { id: "mock-kings-of-leon", name: "Kings of Leon", description: "Rock band from Nashville, TN" },
    { id: "mock-kings-of-convenience", name: "Kings of Convenience", description: "Indie folk duo from Bergen, Norway" },
  ],
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
    const fixture = AMBIGUOUS[query.trim().toLowerCase()];
    if (fixture) return fixture.map((f) => ({ ...f, type, tags: ["simulated"] }));
    return [{ id: `mock-${slug(query)}`, name: query.trim(), type, popularity: 0.9, tags: ["simulated"] }];
  }

  async insights(opts: { type: EntityType; signalEntities: string[]; locationQuery?: string; take?: number; popularityMax?: number; popularityMin?: number }): Promise<Entity[]> {
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
      .filter((e) => opts.popularityMin == null || (e.popularity ?? 0) >= opts.popularityMin)
      .slice(0, opts.take ?? 10);
  }

  async heatmap(opts: { signalEntities: string[]; locationQuery: string }): Promise<HeatCell[]> {
    await sleep(250);
    const rnd = seeded(`heat|${opts.signalEntities.join()}|${opts.locationQuery}`);
    const home = findCity(opts.locationQuery) ?? { lat: 38.97, lng: -95.24 };
    const near = CITIES.filter((c) => Math.hypot(c[1] - home.lat, c[2] - home.lng) < 5.5);
    const cells: HeatCell[] = [];
    for (const c of near) {
      const base = 0.3 + rnd() * 0.7;
      for (let i = 0; i < 5; i++) cells.push({ lat: c[1] + (rnd() - 0.5) * 0.5, lng: c[2] + (rnd() - 0.5) * 0.5, affinity: Math.round(Math.max(0.1, base - i * 0.08) * 100) / 100 });
    }
    return cells.sort((a, b) => b.affinity - a.affinity);
  }

  async compare(a: string, b: string): Promise<Overlap> {
    await sleep(120);
    const rnd = seeded(`cmp|${a}|${b}`);
    const tags = ["dream pop", "indie rock", "lo-fi", "synth", "folk", "garage", "shoegaze", "alt country"];
    const shared = tags.filter(() => rnd() > 0.6).slice(0, 4);
    return { score: Math.round((0.35 + rnd() * 0.55) * 100) / 100, sharedTags: shared.length ? shared : ["indie rock"] };
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
