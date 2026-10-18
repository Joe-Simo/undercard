/**
 * Key-day check. Once QLOO_API_KEY is in .env.local:
 *
 *   pnpm live-check                    every documented Qloo call once, then the Gut vs Graph benchmark
 *   pnpm live-check --skip-benchmark   Qloo checks only (no LLM quota)
 *
 * The Qloo checks cost about 14 Qloo requests and no LLM calls. The benchmark runs only when no
 * check fails, and costs about 2 LLM requests per case (12 cases) on the free OpenRouter tier.
 * Output holds counts and field names, never Qloo response values.
 */
import "./load-env.mts";
import { spawnSync } from "node:child_process";
import { runLiveCheck, type Check } from "@/lib/qloo/live-check";

const mark: Record<Check["status"], string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };
console.log(`Undercard live check, ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET\n`);
const checks = await runLiveCheck((c) => console.log(`${mark[c.status]}  ${c.name}: ${c.detail}`));
const count = (s: Check["status"]) => checks.filter((c) => c.status === s).length;
console.log(`\n${count("pass")} pass, ${count("warn")} warn, ${count("fail")} fail`);

if (count("fail")) {
  console.log("\nFix every FAIL before recapturing screenshots or deploying. Benchmark not run.");
  process.exit(1);
}
if (process.argv.includes("--skip-benchmark")) {
  console.log("\nBenchmark skipped (--skip-benchmark).");
  process.exit(0);
}
console.log("\nRunning the Gut vs Graph benchmark (pnpm benchmark)...\n");
const bench = spawnSync("pnpm", ["benchmark"], { stdio: "inherit", env: process.env });
console.log(bench.status === 0 ? "\nPASS  Benchmark finished. Quote only the printed summary; per-case detail stays in data/benchmark-runs/." : "\nFAIL  Benchmark did not finish.");
process.exit(bench.status ?? 1);
