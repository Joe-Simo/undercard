import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/brief/route";
import { freshState, readAllowance, take } from "@/lib/ratelimit";

const lim = { brief: 3, chat: 8, llmCalls: 40 };

describe("daily allowance", () => {
  it("gives each visitor a few briefs, then a calm pause", () => {
    const s = freshState();
    for (let i = 0; i < 3; i++) expect(take(s, "brief", "a", lim).ok).toBe(true);
    const fourth = take(s, "brief", "a", lim);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.limited.reason).toBe("visitor");
      expect(fourth.limited.title + fourth.limited.message).not.toMatch(/error|exceeded|denied|\u2014/i);
    }
    expect(take(s, "brief", "b", lim).ok).toBe(true);
  });

  it("stops everyone once the shared daily LLM budget is spent", () => {
    const s = freshState();
    for (let i = 0; i < 20; i++) expect(take(s, "brief", `v${i}`, lim).ok).toBe(true);
    const next = take(s, "brief", "new", lim);
    expect(!next.ok && next.limited.reason).toBe("global");
  });

  it("refunds a brief that never reached the LLM", () => {
    const s = freshState();
    const g = take(s, "brief", "a", { ...lim, brief: 1 });
    if (g.ok) g.refund();
    expect(take(s, "brief", "a", { ...lim, brief: 1 }).ok).toBe(true);
  });

  it("returns the limit with featured briefs when a live provider is metered", async () => {
    process.env.OPENROUTER_API_KEY = "test-not-a-key";
    process.env.UNDERCARD_BRIEFS_PER_VISITOR = "0";
    try {
      const res = await POST(new Request("http://localhost/api/brief", { method: "POST", headers: { "Content-Type": "application/json", "x-real-ip": "203.0.113.9" }, body: JSON.stringify({ headliner: "Wednesday", city: "Asheville", capacity: 300 }) }));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.limited.reason).toBe("visitor");
      expect(body.featured.length).toBe(3);
    } finally {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.UNDERCARD_BRIEFS_PER_VISITOR;
    }
  });

  it("follows the visitor across server instances with a signed cookie", async () => {
    process.env.OPENROUTER_API_KEY = "test-not-a-key";
    process.env.UNDERCARD_BRIEFS_PER_VISITOR = "1";
    // No network in tests: the fake provider answers like a bad key, so the brief falls back to templates.
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 401 }));
    try {
      const body = JSON.stringify({ headliner: "Wednesday", city: "Asheville", capacity: 300 });
      const first = await POST(new Request("http://localhost/api/brief", { method: "POST", headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.1" }, body }));
      expect(first.status).toBe(200);
      await first.text();
      const cookie = first.headers.get("set-cookie")!.split(";")[0];
      expect(readAllowance(new Request("http://x", { headers: { cookie } })).brief).toBe(1);
      expect(readAllowance(new Request("http://x", { headers: { cookie: cookie.replace(/.$/, "x") } })).brief).toBe(0);
      const second = await POST(new Request("http://localhost/api/brief", { method: "POST", headers: { "Content-Type": "application/json", "x-real-ip": "198.51.100.2", cookie }, body }));
      expect(second.status).toBe(429);
    } finally {
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.UNDERCARD_BRIEFS_PER_VISITOR;
      vi.unstubAllGlobals();
    }
  });
});
