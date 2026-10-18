import { describe, expect, it } from "vitest";
import { modes } from "@/lib/env";
import { buildBrief, sizeBand } from "@/lib/pipeline";
import { getBrief } from "@/lib/store";
import type { BriefEvent } from "@/lib/types";

describe("brief pipeline (demo mode)", () => {
  it("runs with Qloo and the LLM mocked", () => {
    expect(modes()).toEqual({ qloo: "mock", llm: "mock", llmProvider: "mock" });
  });

  it("builds a complete brief from one headliner and one city", async () => {
    const events: BriefEvent[] = [];
    const brief = await buildBrief({ headliner: "Khruangbin", city: "Nashville", capacity: 500 }, (e) => events.push(e));

    expect(brief.openers.length).toBeGreaterThan(0);
    expect(brief.partners.places.length).toBeGreaterThan(0);
    expect(brief.routing.length).toBeGreaterThan(0);
    expect(brief.copy.tagline).toBeTruthy();
    expect(brief.trace.every((s) => s.status === "ok")).toBe(true);
    expect(events.some((e) => e.type === "step")).toBe(true);
    expect(JSON.stringify(brief)).not.toContain("\u2014");
  });

  it("matches popularity to room size", () => {
    expect(sizeBand(200, 0.55)).toBe("right-size");
    expect(sizeBand(200, 0.95)).toBe("too big");
  });

  it("returns null for unknown brief ids", async () => {
    expect(await getBrief("does-not-exist")).toBeNull();
  });
});
