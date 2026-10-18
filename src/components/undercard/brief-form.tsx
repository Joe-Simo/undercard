"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CircleAlert, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readNdjson } from "@/lib/ndjson";
import type { BriefEvent, Entity, TraceStep } from "@/lib/types";
import { TraceList } from "./trace-list";

type Choice = { query: string; candidates: Entity[] };

export function BriefForm() {
  const router = useRouter();
  const headlinerRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ headliner: "", city: "Lawrence, KS", capacity: "450" });
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** headlinerId pins one artist; query must be the search that produced it so the server can find it again. */
  async function run(headlinerId?: string, query = form.headliner) {
    setBusy(true);
    setSteps([]);
    setChoice(null);
    setError(null);
    let finished = false;
    try {
      const res = await fetch("/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, headliner: query, headlinerId }) });
      if (!res.ok || !res.body) {
        setError((await res.json().catch(() => ({}))).error ?? "Something went wrong. Try again in a moment.");
        return;
      }
      await readNdjson<BriefEvent>(res, (ev) => {
        if (ev.type === "step") setSteps((p) => { const i = p.findIndex((s) => s.id === ev.step.id); if (i < 0) return [...p, ev.step]; const n = p.slice(); n[i] = ev.step; return n; });
        if (ev.type === "choose") { finished = true; setChoice({ query: ev.query, candidates: ev.candidates }); }
        if (ev.type === "error") { finished = true; setError(ev.message); }
        if (ev.type === "done") { finished = true; router.push(`/brief/${ev.brief.id}`); }
      });
      if (!finished) setError("The connection dropped before the brief finished. Try again.");
    } catch {
      setError("Could not reach Undercard. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function edit(patch: Partial<typeof form>) {
    setForm({ ...form, ...patch });
    if (choice && "headliner" in patch) setChoice(null);
    setError(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-2xl shadow-brand/5 backdrop-blur">
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="grid gap-4 sm:grid-cols-[1.4fr_1fr_0.6fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="h">Headliner</Label>
          <Input id="h" ref={headlinerRef} required autoComplete="off" placeholder="Who's topping the bill?" value={form.headliner} onChange={(e) => edit({ headliner: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c">City</Label>
          <Input id="c" required autoComplete="off" value={form.city} onChange={(e) => edit({ city: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cap">Capacity</Label>
          <Input id="cap" type="number" inputMode="numeric" min={50} max={100000} required value={form.capacity} onChange={(e) => edit({ capacity: e.target.value })} />
        </div>
        <Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />} {busy ? "Building" : "Build brief"}</Button>
      </form>

      {choice && (
        <div className="mt-4 border-t border-border pt-4" role="group" aria-labelledby="which-one">
          <p id="which-one" className="text-sm font-medium">{prompt(choice).title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{prompt(choice).hint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {choice.candidates.map((c) => (
              <button key={c.id} type="button" onClick={() => { run(c.id, choice.query); setForm((f) => ({ ...f, headliner: c.name })); }}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-left transition hover:border-brand/60 hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand">
                <span className="block text-sm font-semibold">{c.name}</span>
                {c.description && <span className="block text-xs text-muted-foreground">{c.description}</span>}
              </button>
            ))}
            <button type="button" onClick={() => { setChoice(null); headlinerRef.current?.focus(); headlinerRef.current?.select(); }}
              className="rounded-xl px-3 py-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              None of these
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm text-rose-300">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {steps.length > 0 && !choice && (
        <div className="mt-4 border-t border-border pt-3" aria-live="polite"><TraceList steps={steps} /></div>
      )}
    </div>
  );
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Homonyms get "Which Nirvana?"; near misses and typos get "Did you mean...?". */
function prompt({ query, candidates }: Choice) {
  if (candidates.every((c) => same(c.name, query))) return { title: `Which ${candidates[0]?.name ?? query}?`, hint: "Qloo knows more than one artist by that name. Pick the one you are booking." };
  if (candidates.length === 1) return { title: `Did you mean ${candidates[0].name}?`, hint: `No artist is called exactly "${query.trim()}" in Qloo.` };
  return { title: "Did you mean one of these?", hint: `No artist is called exactly "${query.trim()}" in Qloo.` };
}
