/**
 * Gut vs Graph benchmark. Runs every case in src/lib/benchmark/cases.ts through the real pipeline,
 * then scores Undercard's openers and the LLM-only picks with the one rule in src/lib/benchmark/score.ts.
 *
 *   pnpm benchmark            real run: needs QLOO_API_KEY and an LLM key (about 2 LLM calls per case)
 *   pnpm benchmark --dry-run  mock data, proves the harness works; prints no result worth quoting
 *
 * Per-case detail contains Qloo data, so it is written to data/benchmark-runs/ (gitignored) and only
 * aggregate scores are printed.
 */
import "./load-env.mts";
import { mkdirSync, writeFileSync } from "node:fs";
import { CASES } from "@/lib/benchmark/cases";
import { RULE, scorePicks } from "@/lib/benchmark/score";
import { env, modes } from "@/lib/env";
import { buildBrief } from "@/lib/pipeline";
import { getQloo } from "@/lib/qloo";
import { roomCeiling } from "@/lib/size";

const dry = process.argv.includes("--dry-run");
const m = modes();
if (!dry && (m.qloo !== "live" || env.llm().name === "mock")) {
  console.log("Not running: a real benchmark needs QLOO_API_KEY and an LLM key in the environment.");
  console.log("Use --dry-run to exercise the harness on mock data.");
  process.exit(1);
}
if (dry && (m.qloo === "live" || env.llm().name !== "mock")) {
  console.log("--dry-run is for mock data and spends no quota; unset QLOO_API_KEY and LLM keys first.");
  process.exit(1);
}

type Row = { case: (typeof CASES)[number]; headliner: string; llm: string; gutTemplated: boolean; graph: ReturnType<typeof scorePicks>; gut: ReturnType<typeof scorePicks> };
const rows: Row[] = [];
for (const c of CASES) {
  const brief = await buildBrief(c, () => {}, { autoPick: true });
  if (!brief) continue;
  const ruler = await getQloo().insights({ type: "urn:entity:artist", signalEntities: [brief.headliner.id], locationQuery: c.city, take: 50, popularityMax: roomCeiling(c.capacity) });
  const graph = scorePicks(brief.openers.map((o) => o.name), ruler, c.capacity);
  const gut = scorePicks(brief.gutCheck.llmOnly, ruler, c.capacity);
  rows.push({ case: c, headliner: brief.headliner.name, llm: brief.llm, gutTemplated: brief.trace.some((s) => s.label.startsWith("Gut check") && s.mocked), graph, gut });
  console.log(`${c.headliner} / ${c.city} / ${c.capacity}: graph ${graph.score.toFixed(1)}, gut ${gut.score.toFixed(1)}`);
}

const avg = (k: "graph" | "gut") => rows.reduce((s, r) => s + r[k].score, 0) / Math.max(1, rows.length);
const summary = { ranAt: new Date().toISOString(), mode: dry ? "dry-run (mock data, not a result)" : "live", rule: RULE, ruleVersion: 2, cases: rows.length, graph: Number(avg("graph").toFixed(3)), gut: Number(avg("gut").toFixed(3)), gutTemplatedCases: rows.filter((r) => r.gutTemplated).length };
mkdirSync("data/benchmark-runs", { recursive: true });
const file = `data/benchmark-runs/${summary.ranAt.replace(/[:.]/g, "-")}${dry ? "-dry" : ""}.json`;
writeFileSync(file, JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Per-case detail (contains Qloo data, gitignored): ${file}`);
