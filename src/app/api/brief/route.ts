import { z } from "zod";
import { FEATURED } from "@/lib/featured";
import { buildBrief } from "@/lib/pipeline";
import { clientKey, spend } from "@/lib/ratelimit";
import { saveBrief } from "@/lib/store";
import type { BriefEvent } from "@/lib/types";

export const maxDuration = 120;

const Body = z.object({
  headliner: z.string().trim().min(1).max(120),
  headlinerId: z.string().regex(/^[\w:.-]{1,80}$/).optional(),
  city: z.string().trim().min(2).max(80),
  capacity: z.coerce.number().int().min(50).max(100_000),
  date: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a headliner, a city, and a capacity between 50 and 100,000." }, { status: 400 });
  const gate = await spend("brief", clientKey(req));
  if (!gate.ok) return Response.json({ limited: gate.limited, featured: FEATURED.map(({ slug, title, blurb }) => ({ slug, title, blurb })) }, { status: 429 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: BriefEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const brief = await buildBrief(parsed.data, emit);
        if (brief) await saveBrief(brief);
        else gate.refund();
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
