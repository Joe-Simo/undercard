"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readNdjson } from "@/lib/ndjson";
import type { BriefEvent, TraceStep } from "@/lib/types";
import { TraceList } from "./trace-list";

export function BriefForm() {
  const router = useRouter();
  const [form, setForm] = useState({ headliner: "", city: "Lawrence, KS", capacity: "450" });
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSteps([]);
    try {
      const res = await fetch("/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok || !res.body) return toast.error((await res.json().catch(() => ({}))).error ?? "Failed");
      await readNdjson<BriefEvent>(res, (ev) => {
        if (ev.type === "step") setSteps((p) => { const i = p.findIndex((s) => s.id === ev.step.id); if (i < 0) return [...p, ev.step]; const n = p.slice(); n[i] = ev.step; return n; });
        if (ev.type === "error") toast.error(ev.message);
        if (ev.type === "done") router.push(`/brief/${ev.brief.id}`);
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-card/80 p-5 shadow-2xl shadow-brand/5 backdrop-blur">
      <form onSubmit={go} className="grid gap-4 sm:grid-cols-[1.4fr_1fr_0.6fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="h">Headliner</Label>
          <Input id="h" required placeholder="Who's topping the bill?" value={form.headliner} onChange={(e) => setForm({ ...form, headliner: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c">City</Label>
          <Input id="c" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cap">Capacity</Label>
          <Input id="cap" type="number" min={50} required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </div>
        <Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />} Build brief</Button>
      </form>
      {steps.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3"><TraceList steps={steps} /></div>
      )}
    </div>
  );
}
