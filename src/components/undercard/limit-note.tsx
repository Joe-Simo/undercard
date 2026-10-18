import Link from "next/link";
import { ArrowRight, Moon } from "lucide-react";

export type LimitInfo = { limited: { reason: "visitor" | "global"; title: string; message: string }; featured?: { slug: string; title: string; blurb: string }[] };

/** A calm pause, not an error: say what happened, then offer something good to open instead. */
export function LimitNote({ info, compact = false }: { info: LimitInfo; compact?: boolean }) {
  return (
    <div role="status" className={compact ? "rounded-xl bg-surface px-3 py-2.5" : "mt-4 border-t border-border pt-4"}>
      <p className="flex items-center gap-2 text-sm font-medium"><Moon className="size-4 shrink-0 text-brand" /> {info.limited.title}</p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">{info.limited.message}</p>
      {!!info.featured?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {info.featured.map((f) => (
            <Link key={f.slug} href={`/featured/${f.slug}`} prefetch={false}
              className="group w-full rounded-xl border border-border bg-surface px-3 py-2 transition sm:w-auto hover:border-brand/60 hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand">
              <span className="flex items-center gap-1 text-sm font-semibold">{f.title} <ArrowRight className="size-3 text-brand transition group-hover:translate-x-0.5" /></span>
              <span className="block text-xs text-muted-foreground">{f.blurb}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
