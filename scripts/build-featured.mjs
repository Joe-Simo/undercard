// Precompute featured briefs against a running dev server, then copy them into data/featured/.
// Usage: pnpm dev -p 3200 & pnpm featured   (BASE overrides the server URL)
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";

const base = process.env.BASE ?? "http://localhost:3200";
const slugs = [...readFileSync("src/lib/featured.ts", "utf8").matchAll(/slug: "([a-z0-9-]+)"/g)].map((m) => m[1]);
mkdirSync("data/featured", { recursive: true });
for (const slug of slugs) {
  const id = `f-${slug}`;
  rmSync(`.data/briefs/${id}.json`, { force: true });
  rmSync(`data/featured/${id}.json`, { force: true });
  const res = await fetch(`${base}/brief/${id}`);
  await res.text(); // the page streams; wait for the build to finish
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  copyFileSync(`.data/briefs/${id}.json`, `data/featured/${id}.json`);
  const b = JSON.parse(readFileSync(`data/featured/${id}.json`, "utf8"));
  const llm = b.trace.filter((s) => s.tool === "llm").map((s) => s.detail).join(" | ");
  console.log(`${id}: ${b.openers.length} openers; ${llm}`);
}
