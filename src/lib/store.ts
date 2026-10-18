import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import type { Brief } from "./types";

/**
 * Private, server-side storage. Qloo-derived data never enters the git repository.
 * 1. Featured briefs are precomputed into data/featured/ and shipped with the deployment.
 * 2. Every other brief (and every chat edit) goes to a private Vercel Blob store when
 *    BLOB_READ_WRITE_TOKEN is set, so a share link works on any server instance.
 * 3. Without a token, or if Blob fails, briefs fall back to memory plus a local JSON file
 *    (.data/ locally, /tmp on Vercel). The LLM response cache always stays local.
 */
const dir = process.env.UNDERCARD_DATA_DIR || (process.env.VERCEL ? "/tmp/undercard" : path.join(process.cwd(), ".data"));
const featuredDir = path.join(process.cwd(), "data", "featured");
const memory = new Map<string, unknown>();
const safe = (key: string) => /^[a-z0-9/-]{3,80}$/.test(key);
export const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN?.trim();

/** Local cache: memory plus a JSON file. Per server instance. */
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

/** Shared store: private Vercel Blob. Writes are Advanced Operations, so only briefs go here. */
async function blobPut(key: string, value: unknown) {
  const { put } = await import("@vercel/blob");
  await put(`${key}.json`, JSON.stringify(value), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
}

async function blobGet<T>(key: string): Promise<T | null> {
  const { get } = await import("@vercel/blob");
  // useCache: false reads from origin, so an edit saved on one instance is what the next request sees.
  const res = await get(`${key}.json`, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  return JSON.parse(await new Response(res.stream).text()) as T;
}

const idOk = (id: string) => /^[a-z0-9-]{4,60}$/.test(id);

export async function saveBrief(b: Brief) {
  const { tidy } = await import("./llm");
  const key = `briefs/${b.id}`;
  const value = tidy(b);
  await kvSet(key, value);
  if (blobEnabled()) await blobPut(key, value).catch((err) => console.error(`blob put ${key} failed, kept locally:`, err instanceof Error ? err.message : err));
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

async function loadBrief(id: string): Promise<Brief | null> {
  if (!idOk(id)) return null;
  // Featured briefs never change in place (edits fork a new brief), so the shipped copy wins and costs no Blob read.
  const shipped = await staticFeatured(id);
  if (shipped) return shipped;
  const key = `briefs/${id}`;
  if (blobEnabled()) {
    const shared = await blobGet<Brief>(key).catch((err) => { console.error(`blob get ${key} failed:`, err instanceof Error ? err.message : err); return null; });
    if (shared) return shared;
  }
  return kvGet<Brief>(key);
}

/** One read per request, even when metadata and the page both ask for the same brief. */
export const getBrief = cache(loadBrief);
