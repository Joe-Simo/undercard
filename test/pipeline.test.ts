import { describe, expect, it } from "vitest";
import { modes } from "@/lib/env";
import { buildBrief, resolveHeadliner, sizeBand } from "@/lib/pipeline";
import { getBrief } from "@/lib/store";
import type { BriefEvent, Entity } from "@/lib/types";

describe("brief pipeline (demo mode)", () => {
  it("runs with Qloo and the LLM mocked", () => {
    expect(modes()).toEqual({ qloo: "mock", llm: "mock", llmProvider: "mock" });
  });

  it("builds a complete brief from one headliner and one city", async () => {
    const events: BriefEvent[] = [];
    const brief = await buildBrief({ headliner: "Khruangbin", city: "Nashville", capacity: 500 }, (e) => events.push(e));
    if (!brief) throw new Error("expected a brief");

    expect(brief.openers.length).toBeGreaterThan(0);
    expect(brief.partners.places.length).toBeGreaterThan(0);
    expect(brief.routing.length).toBeGreaterThan(0);
    expect(brief.copy.tagline).toBeTruthy();
    expect(brief.trace.every((s) => s.status === "ok")).toBe(true);
    expect(events.some((e) => e.type === "step")).toBe(true);
    expect(JSON.stringify(brief)).not.toContain("\u2014");
  });

  it("asks which one when a name matches several artists, then builds the one picked", async () => {
    const events: BriefEvent[] = [];
    expect(await buildBrief({ headliner: "Nirvana", city: "Seattle", capacity: 400 }, (e) => events.push(e))).toBeNull();
    const choose = events.find((e) => e.type === "choose");
    if (choose?.type !== "choose") throw new Error("expected a choose event");
    expect(choose.candidates.map((c) => c.description)).toEqual(["Grunge band from Aberdeen, WA", "Psychedelic pop duo from London"]);

    const picked = await buildBrief({ headliner: "Nirvana", headlinerId: choose.candidates[1].id, city: "Seattle", capacity: 400 }, () => {});
    expect(picked?.headliner.id).toBe(choose.candidates[1].id);
    expect(picked?.input.headlinerId).toBe(choose.candidates[1].id);
  });

  it("resolves a single exact match without asking", () => {
    const e = (id: string, name: string): Entity => ({ id, name, type: "urn:entity:artist" });
    expect(resolveHeadliner("wednesday", [e("a", "Wednesday"), e("b", "Wednesday 13")]).pick?.id).toBe("a");
    expect(resolveHeadliner("The National", [e("a", "The National")]).pick?.id).toBe("a");
    expect(resolveHeadliner("big", [e("a", "Big Thief"), e("b", "Big Star")]).candidates).toHaveLength(2);
    expect(resolveHeadliner("japanse brekfast", [e("a", "Japanese Breakfast")]).candidates).toHaveLength(1);
  });

  it("matches popularity to room size", () => {
    expect(sizeBand(200, 0.55)).toBe("right-size");
    expect(sizeBand(200, 0.95)).toBe("too big");
  });

  it("returns null for unknown brief ids", async () => {
    expect(await getBrief("does-not-exist")).toBeNull();
  });
});

describe("chat on a featured brief", () => {
  it("forks a new brief so the featured one stays as shipped", async () => {
    const { runChat } = await import("@/lib/chat");
    const featured = await buildBrief({ headliner: "Khruangbin", city: "Nashville", capacity: 2500 }, () => {}, { id: "f-test-featured", featured: "Test", autoPick: true });
    if (!featured) throw new Error("expected a brief");
    const result = await runChat(featured, "go smaller", () => {});
    expect(result.brief.id).not.toBe("f-test-featured");
    expect(result.brief.featured).toBeUndefined();
    expect(result.redirect).toBe(`/brief/${result.brief.id}`);
    expect(featured.featured).toBe("Test");
    expect(featured.chat).toHaveLength(0);
  });
});
