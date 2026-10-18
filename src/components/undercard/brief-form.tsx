"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BriefEvent, TraceStep } from "@/lib/types";

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
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l) as BriefEvent;
          if (ev.type === "step") setSteps((p) => { const i = p.findIndex((s) => s.id === ev.step.id); if (i < 0) return [...p, ev.step]; const n = p.slice(); n[i] = ev.step; return n; });
          if (ev.type === "error") toast.error(ev.message);
          if (ev.type === "done") router.push(`/brief/${ev.brief.id}`);
        }
      }
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
        <ol className="mt-4 space-y-1 border-t border-white/5 pt-3 text-sm">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              {s.status === "running" ? <Loader2 className="size-3.5 animate-spin text-brand" /> : <CheckCircle2 className="size-3.5 text-emerald-400" />}
              <span>{s.label}</span>
              {s.endpoint && <code className="hidden rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">{s.endpoint}</code>}
              {s.mocked && <span className="text-[10px] text-amber-300">simulated</span>}
              {s.detail && <span className="ml-auto truncate text-xs text-muted-foreground">{s.detail}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
