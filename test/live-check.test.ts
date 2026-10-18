import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runLiveCheck } from "@/lib/qloo/live-check";

/**
 * A fake Qloo that answers with the response shapes in Qloo's public reference (invented values,
 * no real Qloo data). `quirks` turns on the failure modes the live check exists to catch.
 */
const quirks = { ignorePopularity: false, ignoreLocation: false, compareShape: "tags" as "tags" | "unknown" };
const artist = (i: number, pop: number, local: boolean) => ({ entity_id: `A${i}`, name: `Fixture Act ${i}`, popularity: pop, query: { affinity: local ? 1 - i / 40 : 0.5 - i / 80 }, properties: {}, tags: [] });

function handle(url: URL) {
  const p = url.searchParams;
  if (url.pathname === "/search") {
    const q = p.get("query") ?? "";
    const n = q === "Nirvana" ? 2 : 1;
    return { results: Array.from({ length: n }, (_, i) => ({ entity_id: `S${q}${i}`, name: q, popularity: 0.9, disambiguation: `Fixture description ${i}`, properties: { short_descriptions: [{ value: "fixture", languages: ["en"] }] } })) };
  }
  if (url.pathname === "/v2/analysis/compare")
    return quirks.compareShape === "tags" ? { success: true, results: { tags: [{ name: "Fixture Tag", query: { affinity: 0.7 } }, { name: "Other Tag", query: { affinity: 0.5 } }] } } : { success: true, results: { something: { else: 1 } } };
  if (url.pathname !== "/v2/insights") return null;
  const type = p.get("filter.type");
  if (type === "urn:heatmap") return { success: true, results: { heatmap: [1, 2, 3].map((i) => ({ location: { latitude: 36 + i / 10, longitude: -86.7, geohash: "dn6m" }, query: { affinity: i / 4, affinity_rank: 0.5, popularity: 0.5 } })) } };
  if (type === "urn:demographics") return { success: true, results: { demographics: [{ entity_id: "x", query: { age: { "25_to_29": 0.4, "30_to_34": 0.1 }, gender: { male: 0.1, female: -0.1 } } }] } };
  if (type === "urn:entity:artist") {
    const local = !quirks.ignoreLocation && !!p.get("signal.location.query");
    let rows = Array.from({ length: 15 }, (_, i) => artist(local ? 14 - i : i, 0.3 + i * 0.045, local));
    const max = Number(p.get("filter.popularity.max") ?? NaN), min = Number(p.get("filter.popularity.min") ?? NaN);
    if (!quirks.ignorePopularity) rows = rows.filter((r) => !(r.popularity > max) && !(r.popularity < min));
    return { success: true, results: { entities: rows } };
  }
  return { success: true, results: { entities: [1, 2].map((i) => ({ entity_id: `E${i}`, name: `Fixture ${type} ${i}`, popularity: 0.5, query: { affinity: 0.6 }, properties: { address: "1 Fixture St" } })) } };
}

let server: Server;
beforeAll(async () => {
  server = createServer((req, res) => {
    const body = req.headers["x-api-key"] === "fixture-key" ? handle(new URL(req.url ?? "/", "http://x")) : null;
    res.writeHead(body ? 200 : 404, { "Content-Type": "application/json" }).end(JSON.stringify(body ?? { error: "not found" }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.QLOO_API_KEY = "fixture-key";
  process.env.QLOO_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); delete process.env.QLOO_API_KEY; delete process.env.QLOO_BASE_URL; });

describe("pnpm live-check", () => {
  it("passes every check against documented response shapes", async () => {
    Object.assign(quirks, { ignorePopularity: false, ignoreLocation: false, compareShape: "tags" });
    const checks = await runLiveCheck();
    const notPass = checks.filter((c) => c.status !== "pass").map((c) => c.name);
    // The only expected warning: the fake runs on localhost, not hackathon.api.qloo.com.
    expect(notPass).toEqual(["Base URL"]);
    expect(checks.length).toBeGreaterThanOrEqual(16);
  });

  it("catches ignored filters and an unknown compare shape", async () => {
    Object.assign(quirks, { ignorePopularity: true, ignoreLocation: true, compareShape: "unknown" });
    const status = Object.fromEntries((await runLiveCheck()).map((c) => [c.name, c.status]));
    expect(status["filter.popularity.max"]).toBe("fail");
    expect(status["filter.popularity.min"]).toBe("fail");
    expect(status["Location changes the ranking"]).toBe("warn");
    expect(status["GET /v2/analysis/compare"]).toBe("fail");
    expect(status["Overlap (client)"]).toBe("fail");
  });
});

describe("live client field parsing", () => {
  it("reads the description from disambiguation, then English short_descriptions", async () => {
    const { toEntity } = await import("@/lib/qloo/live");
    expect(toEntity({ entity_id: "1", name: "A", disambiguation: "Band from Ohio" }).description).toBe("Band from Ohio");
    expect(toEntity({ entity_id: "1", name: "A", properties: { short_descriptions: [{ value: "banda", languages: ["es"] }, { value: "American band", languages: ["en"] }] } }).description).toBe("American band");
    expect(toEntity({ entity_id: "1", name: "A", popularity: 0.4, query: { affinity: 0.8 } })).toMatchObject({ popularity: 0.4, affinity: 0.8, description: undefined });
  });
});
