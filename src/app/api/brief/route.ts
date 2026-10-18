import { z } from "zod";
import { modes } from "@/lib/env";
import { buildBrief } from "@/lib/pipeline";
import { allow, clientKey } from "@/lib/ratelimit";
import { saveBrief } from "@/lib/store";
import type { BriefEvent } from "@/lib/types";

export const maxDuration = 120;

const Body = z.object({
  headliner: z.string().min(1).max(120),
  city: z.string().min(2).max(80),
  capacity: z.coerce.number().int().min(50).max(100_000),
  date: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Headliner, city, and capacity are required." }, { status: 400 });
  if (modes().qloo === "live" && !allow(`brief:${clientKey(req)}`, 6, 10 * 60_000)) return Response.json({ error: "Demo limit reached. Try a featured brief." }, { status: 429 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: BriefEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const brief = await buildBrief(parsed.data, emit);
        await saveBrief(brief);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
