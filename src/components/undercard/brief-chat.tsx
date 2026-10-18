"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readNdjson } from "@/lib/ndjson";
import type { Brief, ChatMessage, TraceStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LimitNote, type LimitInfo } from "./limit-note";
import { TraceList } from "./trace-list";

type ChatEvent = { type: "step"; step: TraceStep } | { type: "chat"; brief: Brief; redirect?: string } | { type: "error"; message: string };

export function BriefChat({ briefId, initial, openers }: { briefId: string; initial: ChatMessage[]; openers: string[] }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState<LimitInfo | null>(null);
  const suggestions = [`Swap out ${openers[1] ?? "opener 2"}`, "Go smaller and more local", "What if Omaha, NE?", "Why is the first pick on top?"];

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setSteps([]);
    setMsgs((m) => [...m, { role: "user", text: message, at: new Date().toISOString() }]);
    setText("");
    try {
      const res = await fetch(`/api/brief/${briefId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.limited) { setLimit(data as LimitInfo); setMsgs((m) => m.slice(0, -1)); }
        else toast.error(data.error ?? "That edit did not go through. Try again in a moment.");
        return;
      }
      await readNdjson<ChatEvent>(res, (ev) => {
        if (ev.type === "step") setSteps((p) => { const i = p.findIndex((s) => s.id === ev.step.id); if (i < 0) return [...p, ev.step]; const n = p.slice(); n[i] = ev.step; return n; });
        if (ev.type === "error") toast.error(ev.message);
        if (ev.type === "chat") {
          if (ev.redirect) { router.push(ev.redirect); return; }
          setMsgs(ev.brief.chat);
          router.refresh();
        }
      });
    } catch {
      toast.error("Could not reach Undercard. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-brand" /> Ask Undercard</h2>
      <p className="mt-1 text-xs text-muted-foreground">Edit the brief in plain English. Every change is re-checked against Qloo.</p>
      <div className="mt-3 max-h-72 flex-1 space-y-2 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={cn("max-w-[90%] rounded-xl px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-brand/15" : "bg-surface")}>
            {m.text}
            {m.meta && <span className="mt-1 block text-[10px] text-muted-foreground">{m.meta}</span>}
          </div>
        ))}
        {limit && <LimitNote info={limit} compact />}
        {busy && steps.length > 0 && <div className="rounded-xl bg-surface p-2"><TraceList steps={steps} compact /></div>}
      </div>
      {!msgs.length && !limit && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-brand/50 hover:text-foreground">{s}</button>)}
        </div>
      )}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Swap opener 3, go bigger, try Denver..." disabled={busy || !!limit} />
        <Button type="submit" size="icon" disabled={busy || !!limit || !text.trim()} aria-label="Send">{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
      </form>
    </section>
  );
}
