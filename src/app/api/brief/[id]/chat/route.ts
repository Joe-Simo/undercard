import { z } from "zod";
import { runChat } from "@/lib/chat";
import { clientKey, spend } from "@/lib/ratelimit";
import { getBrief, saveBrief } from "@/lib/store";
import type { BriefEvent } from "@/lib/types";

export const maxDuration = 120;

const Body = z.object({ message: z.string().trim().min(1).max(500) });

export async function POST(req: Request, ctx: RouteContext<"/api/brief/[id]/chat">) {
  const { id } = await ctx.params;
  const brief = await getBrief(id);
  if (!brief) return Response.json({ error: "Brief not found." }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say something first." }, { status: 400 });
  const gate = await spend("chat", clientKey(req), req);
  if (!gate.ok) return Response.json({ limited: gate.limited }, { status: 429 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: unknown) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const result = await runChat(brief, parsed.data.message, (e: BriefEvent) => { if (e.type === "step") send(e); });
        await saveBrief(result.brief);
        send({ type: "chat", brief: result.brief, redirect: result.redirect });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", ...(gate.cookie ? { "Set-Cookie": gate.cookie } : {}) } });
}
