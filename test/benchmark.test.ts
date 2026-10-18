import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CASES } from "@/lib/benchmark/cases";
import { scorePicks } from "@/lib/benchmark/score";

describe("Gut vs Graph scoring rule", () => {
  const ruler = [
    { id: "1", name: "The Room Fits", type: "artist", popularity: 0.6 },
    { id: "2", name: "Arena Giant", type: "artist", popularity: 0.99 },
  ];
  it("counts only picks that are local to Qloo's list and sized for the room", () => {
    const r = scorePicks(["room fits", "Arena Giant", "Not In Qloo"], ruler, 300);
    expect(r.detail.map((d) => d.counts)).toEqual([true, false, false]);
    expect(r.score).toBeCloseTo(0.2);
  });
  it("uses a fixed set of real cases", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("Qloo data stays out of git", () => {
  it("tracks no featured briefs, local data, or benchmark runs", () => {
    const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n");
    expect(tracked.filter((f) => /^(data\/featured|data\/benchmark-runs|\.data)\//.test(f))).toEqual([]);
  });
});
