"use client";

import { useState } from "react";
import type { Brief } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GutVsGraph({ brief }: { brief: Brief }) {
  const [mode, setMode] = useState<"graph" | "gut">("graph");
  const graph = brief.openers.map((o) => `${o.name} (affinity ${Math.round((o.affinity ?? 0) * 100)}, ${o.sizeBand})`);
  const gut = brief.gutCheck.llmOnly;
  const graphNote = "Ranked by what this headliner's audience in this city actually loves, filtered for room size.";
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Gut vs Graph</h2>
        <div className="inline-flex rounded-full border border-border p-0.5 text-sm print:hidden" role="tablist" aria-label="Compare answers">
          {(["graph", "gut"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-full px-3 py-1 transition", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {m === "graph" ? "With Qloo" : "LLM alone"}
            </button>
          ))}
        </div>
      </div>
      <div className="print:hidden">
        <List items={mode === "graph" ? graph : gut} />
        <p className="mt-3 text-xs text-muted-foreground">{mode === "graph" ? graphNote : brief.gutCheck.note}</p>
      </div>
      {/* On paper both answers sit side by side, since there is no toggle to press. */}
      <div className="hidden gap-4 print:grid print:grid-cols-2">
        <div><p className="mt-3 text-xs font-semibold uppercase tracking-wider">With Qloo</p><List items={graph} /><p className="mt-2 text-xs text-muted-foreground">{graphNote}</p></div>
        <div><p className="mt-3 text-xs font-semibold uppercase tracking-wider">LLM alone</p><List items={gut} /><p className="mt-2 text-xs text-muted-foreground">{brief.gutCheck.note}</p></div>
      </div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <p className="mt-4 text-sm text-muted-foreground">No picks to compare.</p>;
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {items.map((x) => <li key={x} className="rounded-lg bg-surface px-3 py-2">{x}</li>)}
    </ul>
  );
}
