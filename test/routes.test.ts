import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/brief/route";
import { GET } from "@/app/api/status/route";
import type { BriefEvent } from "@/lib/types";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

describe("api routes", () => {
  it("GET /api/status reports modes", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ modes: { qloo: "mock", llm: "mock", llmProvider: "mock" } });
  });

  it("POST /api/brief rejects a bad request", async () => {
    const res = await post({ city: "Nashville" });
    expect(res.status).toBe(400);
  });

  it("POST /api/brief streams steps and ends with a saved brief", async () => {
    const res = await post({ headliner: "Wednesday", city: "Asheville", capacity: 300 });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("ndjson");
    const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as BriefEvent);
    const last = events.at(-1);
    expect(last?.type).toBe("done");
    if (last?.type === "done") expect(last.brief.openers.length).toBeGreaterThan(0);
  });
});
