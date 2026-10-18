import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Brief } from "./types";

/**
 * Private server-side storage. Qloo-derived data must never be committed to the public repo.
 * - Vercel Blob (private store) when BLOB_READ_WRITE_TOKEN is set: shared by every serverless instance.
 * - Local JSON files otherwise (.data/, gitignored).
 */
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const dir = process.env.UNDERCARD_DATA_DIR || (process.env.VERCEL ? "/tmp/undercard" : path.join(process.cwd(), ".data"));
const safe = (key: string) => /^[a-z0-9/-]{3,80}$/.test(key);

export async function kvSet(key: string, value: unknown) {
  if (!safe(key)) throw new Error("bad key");
  const body = JSON.stringify(value);
  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    await put(`${key}.json`, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
    return;
  }
  const file = path.join(dir, `${key}.json`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!safe(key)) return null;
  try {
    if (blobEnabled()) {
      const { get } = await import("@vercel/blob");
      const res = await get(`${key}.json`, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return JSON.parse(await new Response(res.stream).text()) as T;
    }
    return JSON.parse(await fs.readFile(path.join(dir, `${key}.json`), "utf8")) as T;
  } catch {
    return null;
  }
}

async function listKeys(prefix: string): Promise<{ key: string; at: number }[]> {
  if (blobEnabled()) {
    const { list } = await import("@vercel/blob");
    const out: { key: string; at: number }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      out.push(...page.blobs.map((b) => ({ key: b.pathname.replace(/\.json$/, ""), at: new Date(b.uploadedAt).getTime() })));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  }
  try {
    const d = path.join(dir, prefix);
    const files = (await fs.readdir(d)).filter((f) => f.endsWith(".json"));
    return Promise.all(files.map(async (f) => ({ key: `${prefix}${f.replace(/\.json$/, "")}`, at: (await fs.stat(path.join(d, f))).mtimeMs })));
  } catch {
    return [];
  }
}

const idOk = (id: string) => /^[a-z0-9-]{4,60}$/.test(id);

export async function saveBrief(b: Brief) {
  const { tidy } = await import("./llm");
  await kvSet(`briefs/${b.id}`, tidy(b));
}

export async function getBrief(id: string): Promise<Brief | null> {
  if (!idOk(id)) return null;
  return kvGet<Brief>(`briefs/${id}`);
}

export async function listBriefs(limit = 6): Promise<Brief[]> {
  try {
    const keys = (await listKeys("briefs/")).filter((k) => !k.key.startsWith("briefs/f-")).sort((a, b) => b.at - a.at).slice(0, limit);
    const all = await Promise.all(keys.map((k) => kvGet<Brief>(k.key)));
    return all.filter((b): b is Brief => !!b && !b.featured).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
