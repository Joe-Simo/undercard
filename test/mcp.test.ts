import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";

let id = 0;
async function rpc(method: string, params: unknown) {
  const res = await POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  }));
  const body = await res.text();
  const json = body.startsWith("{") ? body : body.split("\n").find((l) => l.startsWith("data: "))!.slice(6);
  return JSON.parse(json).result;
}
const call = async (name: string, args: unknown) => {
  const r = await rpc("tools/call", { name, arguments: args });
  return { isError: !!r.isError, data: r.isError ? r.content[0].text : JSON.parse(r.content[0].text) };
};

describe("MCP endpoint", () => {
  it("initializes and lists Undercard's tools", async () => {
    const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(init.serverInfo.name).toBe("undercard");
    const { tools } = await rpc("tools/list", {});
    expect(tools.map((t: { name: string }) => t.name)).toEqual(["build_show_brief", "get_show_brief", "ask_undercard", "list_featured_briefs"]);
  });

  it("asks which artist, builds the chosen one, then edits it", async () => {
    const first = await call("build_show_brief", { headliner: "Kings", city: "Nashville, TN", capacity: 800 });
    expect(first.data.status).toBe("needs_choice");
    expect(first.data.candidates).toHaveLength(2);

    const built = await call("build_show_brief", { headliner: "Kings", city: "Nashville, TN", capacity: 800, headliner_id: first.data.candidates[1].headliner_id });
    expect(built.data.status).toBe("ready");
    expect(built.data.headliner.name).toBe("Kings of Convenience");
    expect(built.data.sample_data).toBe(true);
    expect(built.data.openers.length).toBeGreaterThan(0);

    const fetched = await call("get_show_brief", { brief_id: built.data.brief_id });
    expect(fetched.data.openers).toEqual(built.data.openers);

    const swapped = await call("ask_undercard", { brief_id: built.data.brief_id, message: "swap opener 1" });
    expect(swapped.data.reply).toMatch(/^Swapped /);
    expect(swapped.data.brief.openers[0].name).not.toBe(built.data.openers[0].name);
  });

  it("reports unknown briefs as tool errors", async () => {
    const missing = await call("get_show_brief", { brief_id: "nope-nope" });
    expect(missing.isError).toBe(true);
  });
});
