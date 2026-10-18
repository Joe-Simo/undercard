import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Megaphone, Mic2, Store, Tv, Users } from "lucide-react";
import { Header, ModeBanner } from "@/components/undercard/chrome";
import { GutVsGraph } from "@/components/undercard/gut-vs-graph";
import { modes } from "@/lib/env";
import { getBrief } from "@/lib/store";
import type { Entity } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAND: Record<string, string> = {
  "right-size": "bg-emerald-400/15 text-emerald-300",
  stretch: "bg-amber-400/15 text-amber-200",
  "too big": "bg-rose-400/15 text-rose-300",
  "too small": "bg-slate-400/15 text-slate-300",
};

export default async function BriefPage(props: PageProps<"/brief/[id]">) {
  const { id } = await props.params;
  const b = await getBrief(id);
  if (!b) notFound();
  return (
    <>
      <ModeBanner modes={modes()} />
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> New brief</Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-brand">Show brief{b.sample ? " · simulated data" : ""}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">{b.headliner.name}</h1>
            <p className="mt-1 text-muted-foreground">{b.input.city} · {b.input.capacity}-cap room</p>
          </div>
          <blockquote className="max-w-md rounded-xl border border-white/10 bg-card px-4 py-3 text-sm italic">&ldquo;{b.copy.tagline}&rdquo;</blockquote>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Mic2 className="size-4 text-brand" /> Recommended undercard</h2>
            <ol className="mt-4 space-y-3">
              {b.openers.map((o, i) => (
                <li key={o.id} className="flex gap-4 rounded-xl bg-white/[0.03] p-4">
                  <span className="text-2xl font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", BAND[o.sizeBand])}>{o.sizeBand}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{o.rationale}</p>
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground tabular-nums">
                      <Meter label="Local affinity" v={o.affinity} />
                      <Meter label="Popularity" v={o.popularity} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <div className="space-y-6">
            <GutVsGraph brief={b} />
            <section className="rounded-2xl border border-white/10 bg-card p-5">
              <h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand" /> Routing</h2>
              <ul className="mt-3 space-y-2">
                {b.routing.map((r) => (
                  <li key={r.city} className="text-sm">
                    <div className="flex justify-between"><span>{r.city}</span><span className="tabular-nums text-muted-foreground">{Math.round(r.affinity * 100)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${r.affinity * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">From the Qloo heatmap of this headliner&apos;s audience. Map view coming next.</p>
            </section>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <EntityList icon={<Store className="size-4 text-brand" />} title="Pre-show partners" items={b.partners.places} />
          <EntityList icon={<Megaphone className="size-4 text-brand" />} title="Sponsor shortlist" items={b.partners.brands} />
          <EntityList icon={<Mic2 className="size-4 text-brand" />} title="Podcast ad buys" items={b.adPlan.podcasts} />
          <EntityList icon={<Tv className="size-4 text-brand" />} title="TV this crowd watches" items={b.adPlan.tv} />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-brand" /> Audience shape</h2>
            <p className="mt-1 text-sm text-muted-foreground">{b.audience.summary}</p>
            <div className="mt-4 space-y-1.5">
              {b.audience.age.map((a) => (
                <div key={a.label} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{a.label}</span>
                  <div className="relative h-2 rounded-full bg-white/5">
                    <div className={cn("absolute top-0 h-2 rounded-full", a.value >= 0 ? "left-1/2 bg-brand" : "right-1/2 bg-slate-500")} style={{ width: `${Math.abs(a.value) * 50}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-card p-5">
            <h2 className="font-semibold">Ad plan and copy</h2>
            <p className="mt-2 text-sm">{b.adPlan.summary}</p>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Social post</p>
            <p className="mt-1 rounded-lg bg-white/5 p-3 text-sm">{b.copy.social}</p>
          </section>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">Qloo results describe aggregate taste affinities, not predictions about any individual.</p>
      </main>
    </>
  );
}

function Meter({ label, v }: { label: string; v?: number }) {
  return <span>{label} <strong className="text-foreground">{v == null ? "n/a" : Math.round(v * 100)}</strong></span>;
}

function EntityList({ icon, title, items }: { icon: React.ReactNode; title: string; items: Entity[] }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.slice(0, 5).map((e) => (
          <li key={e.id} className="flex justify-between gap-2"><span className="truncate">{e.name}</span>{e.affinity != null && <span className="tabular-nums text-muted-foreground">{Math.round(e.affinity * 100)}</span>}</li>
        ))}
        {!items.length && <li className="text-muted-foreground">No results</li>}
      </ul>
    </section>
  );
}
