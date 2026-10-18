import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Brief } from "./types";

/** Private server-side storage for briefs (Qloo data must never be committed to the public repo). */
const dir = process.env.UNDERCARD_DATA_DIR || (process.env.VERCEL ? "/tmp/undercard" : path.join(process.cwd(), ".data"));

export async function saveBrief(b: Brief) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${b.id}.json`), JSON.stringify(b));
}

export async function getBrief(id: string): Promise<Brief | null> {
  if (!/^[a-z0-9-]{4,40}$/.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, `${id}.json`), "utf8")) as Brief;
  } catch {
    return null;
  }
}

export async function listBriefs(limit = 6): Promise<Brief[]> {
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    const all = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), "utf8")) as Brief));
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  } catch {
    return [];
  }
}
