import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Brief } from "./types";

/**
 * Deliberately simple storage, private to the server:
 * 1. Featured briefs are precomputed into data/featured/ and shipped with the deployment (never committed).
 * 2. Everything else lives in memory plus a local JSON file (.data/ locally, /tmp on Vercel).
 * Qloo-derived data never enters the git repository.
 */
const dir = process.env.UNDERCARD_DATA_DIR || (process.env.VERCEL ? "/tmp/undercard" : path.join(process.cwd(), ".data"));
const featuredDir = path.join(process.cwd(), "data", "featured");
const memory = new Map<string, unknown>();
const safe = (key: string) => /^[a-z0-9/-]{3,80}$/.test(key);

export async function kvSet(key: string, value: unknown) {
  if (!safe(key)) throw new Error("bad key");
  memory.set(key, value);
  const file = path.join(dir, `${key}.json`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!safe(key)) return null;
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const value = JSON.parse(await fs.readFile(path.join(dir, `${key}.json`), "utf8")) as T;
    memory.set(key, value);
    return value;
  } catch {
    return null;
  }
}

const idOk = (id: string) => /^[a-z0-9-]{4,60}$/.test(id);

export async function saveBrief(b: Brief) {
  const { tidy } = await import("./llm");
  await kvSet(`briefs/${b.id}`, tidy(b));
}

/** A shipped, precomputed featured brief, if one exists for this id. */
async function staticFeatured(id: string): Promise<Brief | null> {
  if (!id.startsWith("f-")) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(featuredDir, `${id}.json`), "utf8")) as Brief;
  } catch {
    return null;
  }
}

export async function getBrief(id: string): Promise<Brief | null> {
  if (!idOk(id)) return null;
  return (await kvGet<Brief>(`briefs/${id}`)) ?? (await staticFeatured(id));
}

export async function listBriefs(limit = 6): Promise<Brief[]> {
  try {
    const files = (await fs.readdir(path.join(dir, "briefs"))).filter((f) => f.endsWith(".json") && !f.startsWith("f-"));
    const all = await Promise.all(files.map((f) => kvGet<Brief>(`briefs/${f.replace(/\.json$/, "")}`)));
    return all.filter((b): b is Brief => !!b && !b.featured).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  } catch {
    return [];
  }
}
