import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import type { TraceStep } from "@/lib/types";

export function TraceList({ steps, compact }: { steps: TraceStep[]; compact?: boolean }) {
  return (
    <ol className="space-y-1 text-sm">
      {steps.map((s) => (
        <li key={s.id} className="flex items-center gap-2">
          {s.status === "running" ? <Loader2 className="size-3.5 shrink-0 animate-spin text-brand" /> : s.status === "error" ? <CircleAlert className="size-3.5 shrink-0 text-rose-400" /> : <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />}
          <span className={compact ? "truncate" : undefined}>{s.label}</span>
          {s.endpoint && !compact && <code className="hidden rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">{s.endpoint}</code>}
          {s.mocked && <span className="text-[10px] text-amber-300">simulated</span>}
          {s.detail && <span className="ml-auto max-w-[45%] truncate text-xs text-muted-foreground">{s.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
