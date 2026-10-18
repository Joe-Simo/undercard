"use client";

import { useState } from "react";
import type { Brief } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GutVsGraph({ brief }: { brief: Brief }) {
  const [mode, setMode] = useState<"graph" | "gut">("graph");
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Gut vs Graph</h2>
        <div className="inline-flex rounded-full border border-white/10 p-0.5 text-sm">
          {(["graph", "gut"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded-full px-3 py-1 transition", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {m === "graph" ? "With Qloo" : "LLM alone"}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {(mode === "graph" ? brief.openers.map((o) => `${o.name} (affinity ${Math.round((o.affinity ?? 0) * 100)}, ${o.sizeBand})`) : brief.gutCheck.llmOnly).map((x) => (
          <li key={x} className="rounded-lg bg-white/5 px-3 py-2">{x}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{mode === "graph" ? "Ranked by what this headliner's audience in this city actually loves, filtered for room size." : brief.gutCheck.note}</p>
    </div>
  );
}
