import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Brief } from "@/lib/types";

// A stand-in for the private Blob store, shared by every simulated server instance.
const blob = vi.hoisted(() => ({ files: new Map<string, string>(), fail: false, puts: 0, gets: 0 }));
vi.mock("@vercel/blob", () => ({
  put: async (pathname: string, body: string, opts: { access: string; allowOverwrite?: boolean }) => {
    if (blob.fail) throw new Error("blob down");
    expect(opts.access).toBe("private");
    blob.puts++;
    blob.files.set(pathname, body);
    return { pathname };
  },
  get: async (pathname: string, opts: { access: string; useCache?: boolean }) => {
    if (blob.fail) throw new Error("blob down");
    expect(opts).toMatchObject({ access: "private", useCache: false });
    blob.gets++;
    const body = blob.files.get(pathname);
    return body === undefined ? null : { statusCode: 200, stream: new Response(body).body };
  },
}));

/** A fresh module graph and scratch dir: what a second Vercel instance looks like. */
async function instance() {
  vi.resetModules();
  process.env.UNDERCARD_DATA_DIR = path.join(os.tmpdir(), `undercard-store-${process.pid}-${Math.random().toString(36).slice(2)}`);
  return import("@/lib/store");
}

const brief = (id: string, extra: Partial<Brief> = {}) => ({ id, headliner: { id: "h", name: "Wednesday" }, input: { headliner: "Wednesday", city: "Asheville, NC", capacity: 350 }, openers: [], chat: [], ...extra }) as unknown as Brief;

describe("brief storage", () => {
  beforeEach(() => { blob.files.clear(); blob.fail = false; blob.puts = 0; blob.gets = 0; });
  afterEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN; });

  it("stays local and never touches Blob without a token", async () => {
    const a = await instance();
    await a.saveBrief(brief("local-1"));
    expect((await a.getBrief("local-1"))?.id).toBe("local-1");
    expect(blob.puts + blob.gets).toBe(0);
    const b = await instance();
    expect(await b.getBrief("local-1")).toBeNull();
  });

  it("shares briefs and edits across instances through Blob", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const a = await instance();
    expect(a.blobEnabled()).toBe(true);
    await a.saveBrief(brief("share-1"));
    expect(blob.files.has("briefs/share-1.json")).toBe(true);

    const b = await instance();
    expect((await b.getBrief("share-1"))?.headliner.name).toBe("Wednesday");
    await b.saveBrief(brief("share-1", { chat: [{ role: "user", text: "go smaller", at: "now" }] }));

    // Instance A still has the old copy in memory, but reads the edit from Blob.
    expect((await a.getBrief("share-1"))?.chat).toHaveLength(1);
  });

  it("falls back to the local copy when Blob is down", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const a = await instance();
    blob.fail = true;
    await a.saveBrief(brief("down-1"));
    expect((await a.getBrief("down-1"))?.id).toBe("down-1");
  });

  it("rejects malformed ids without a Blob read", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const a = await instance();
    expect(await a.getBrief("../etc/passwd")).toBeNull();
    expect(blob.gets).toBe(0);
  });
});
