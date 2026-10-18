import { createMcpHandler, getPublicOrigin } from "mcp-handler";
import { z } from "zod";
import { briefForAgents } from "@/lib/agent-view";
import { runChat } from "@/lib/chat";
import { FEATURED, featuredId, getOrBuildFeatured } from "@/lib/featured";
import { buildBrief } from "@/lib/pipeline";
import { clientKey, spend } from "@/lib/ratelimit";
import { getBrief, saveBrief } from "@/lib/store";
import type { Brief, BriefEvent } from "@/lib/types";

export const maxDuration = 120;

/**
 * Undercard as an MCP server (Streamable HTTP), so any agent can book an undercard with Qloo taste data:
 * Claude, Cursor, ChatGPT, or your own. Same pipeline and limits as the web app.
 */
const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (message: string) => ({ ...text(message), isError: true });
const originOf = (req?: Request) => (req ? getPublicOrigin(req) : process.env.UNDERCARD_PUBLIC_URL ?? "http://localhost:3000");
const keyOf = (req?: Request) => (req ? clientKey(req) : "mcp");

async function loadBrief(id: string): Promise<Brief | null> {
  return (await getBrief(id)) ?? (id.startsWith("f-") ? await getOrBuildFeatured(id.slice(2)) : null);
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "build_show_brief",
      {
        title: "Build a show brief",
        description:
          "Plan a concert's undercard with Qloo taste data. Give one headliner, one city, and the venue capacity. Returns ranked openers who over-index with the headliner's audience in that city and fit the room, nearby routing stops from the Qloo heatmap, local bar and restaurant partners, sponsor brands, podcast and TV ad buys, the audience's demographic shape, and draft copy. If the name matches several artists, it returns status needs_choice with candidates; call again with the chosen headliner_id. Takes 5 to 40 seconds.",
        inputSchema: z.object({
          headliner: z.string().trim().min(1).max(120).describe("Headlining artist, e.g. 'Japanese Breakfast'"),
          city: z.string().trim().min(2).max(80).describe("Show city, e.g. 'Lawrence, KS'"),
          capacity: z.number().int().min(50).max(100_000).describe("Venue capacity, e.g. 450"),
          headliner_id: z.string().regex(/^[\w:.-]{1,80}$/).optional().describe("Qloo entity id from a previous needs_choice result"),
        }),
        annotations: { readOnlyHint: false, openWorldHint: true, idempotentHint: false },
      },
      async ({ headliner, city, capacity, headliner_id }, ctx) => {
        const req = ctx.http?.req;
        const gate = await spend("brief", keyOf(req));
        if (!gate.ok) return fail(`${gate.limited.title} ${gate.limited.message} Use list_featured_briefs and get_show_brief meanwhile.`);
        let choice: Extract<BriefEvent, { type: "choose" }> | undefined;
        try {
          const brief = await buildBrief({ headliner, city, capacity, headlinerId: headliner_id }, (e) => { if (e.type === "choose") choice = e; });
          if (!brief) {
            gate.refund();
            return text({
              status: "needs_choice",
              message: `"${headliner}" matches more than one artist in Qloo. Ask the user which one, then call build_show_brief again with the same headliner text and the chosen headliner_id.`,
              candidates: (choice?.candidates ?? []).map((c) => ({ headliner_id: c.id, name: c.name, description: c.description ?? null })),
            });
          }
          await saveBrief(brief);
          return text({ status: "ready", ...briefForAgents(brief, originOf(req)) });
        } catch (err) {
          return fail(err instanceof Error ? err.message : String(err));
        }
      },
    );

    server.registerTool(
      "get_show_brief",
      {
        title: "Get a show brief",
        description: "Fetch a saved show brief by id (from build_show_brief or list_featured_briefs), including openers, routing, partners, ad plan, audience, copy, and recent follow-up chat.",
        inputSchema: z.object({ brief_id: z.string().regex(/^[a-z0-9-]{4,60}$/).describe("Brief id, e.g. 'f-khruangbin-nashville'") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ brief_id }, ctx) => {
        const brief = await loadBrief(brief_id);
        return brief ? text(briefForAgents(brief, originOf(ctx.http?.req))) : fail(`No brief with id "${brief_id}". Demo briefs expire; featured briefs (list_featured_briefs) are always available.`);
      },
    );

    server.registerTool(
      "ask_undercard",
      {
        title: "Ask Undercard about a brief",
        description:
          "Edit or question a brief in plain English, e.g. 'swap opener 2', 'go smaller and more local', 'what if Omaha, NE?', 'try a 1200-cap room', or 'why is the first pick on top?'. Every change is re-checked against Qloo. City or capacity changes create a new brief and return its new_brief_id.",
        inputSchema: z.object({
          brief_id: z.string().regex(/^[a-z0-9-]{4,60}$/),
          message: z.string().trim().min(1).max(500),
        }),
        annotations: { readOnlyHint: false, openWorldHint: true, idempotentHint: false },
      },
      async ({ brief_id, message }, ctx) => {
        const req = ctx.http?.req;
        const brief = await loadBrief(brief_id);
        if (!brief) return fail(`No brief with id "${brief_id}".`);
        const gate = await spend("chat", keyOf(req));
        if (!gate.ok) return fail(`${gate.limited.title} ${gate.limited.message}`);
        try {
          const result = await runChat(brief, message, () => {});
          await saveBrief(result.brief);
          const reply = result.brief.chat.at(-1)?.text ?? "";
          return text({ reply, ...(result.redirect ? { new_brief_id: result.brief.id } : {}), brief: briefForAgents(result.brief, originOf(req)) });
        } catch (err) {
          return fail(err instanceof Error ? err.message : String(err));
        }
      },
    );

    server.registerTool(
      "list_featured_briefs",
      {
        title: "List featured briefs",
        description: "Hand-picked example briefs that are always available and open instantly. Good for a first look before building a new one.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (_args, ctx) => {
        const origin = originOf(ctx.http?.req);
        return text(FEATURED.map((f) => ({ brief_id: featuredId(f.slug), title: f.title, venue: f.blurb, url: `${origin}/brief/${featuredId(f.slug)}` })));
      },
    );
  },
  {
    serverInfo: { name: "undercard", version: "0.2.0" },
    instructions: "Undercard plans concert lineups and marketing for independent promoters and venues using Qloo taste data. Start with build_show_brief (or list_featured_briefs), then refine with ask_undercard. Scores are 0 to 100 Qloo affinity. Results describe aggregate taste, not individuals.",
  },
);

export { handler as GET, handler as POST, handler as DELETE };
