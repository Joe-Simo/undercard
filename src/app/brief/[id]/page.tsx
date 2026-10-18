import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Megaphone, Mic2, Route, Store, Tv, Users } from "lucide-react";
import { BriefActions } from "@/components/undercard/brief-actions";
import { BriefChat } from "@/components/undercard/brief-chat";
import { RouteMap } from "@/components/undercard/route-map";
import { TraceList } from "@/components/undercard/trace-list";
import { Header, ModeBanner } from "@/components/undercard/chrome";
import { GutVsGraph } from "@/components/undercard/gut-vs-graph";
import { modes } from "@/lib/env";
import { getOrBuildFeatured } from "@/lib/featured";
import { getBrief } from "@/lib/store";
import type { Brief, Entity } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAND: Record<string, string> = {
  "right-size": "bg-emerald-400/15 text-emerald-300 print:text-emerald-800",
  stretch: "bg-amber-400/15 text-amber-200 print:text-amber-800",
  "too big": "bg-rose-400/15 text-rose-300 print:text-rose-800",
  "too small": "bg-slate-400/15 text-slate-300 print:text-slate-700",
};

const titleOf = (b: Brief) => `${b.headliner.name} in ${b.input.city}`;

export async function generateMetadata(props: PageProps<"/brief/[id]">): Promise<Metadata> {
  const b = await getBrief((await props.params).id);
  if (!b) return { title: "Show brief | Undercard" };
  // The title doubles as the default file name when the brief is saved as a PDF.
  const title = `${titleOf(b)}: Undercard show brief`;
  const description = `Openers, routing, partners, and ad plan for a ${b.input.capacity}-cap room, built on Qloo taste data${b.sample ? " (simulated sample data)" : ""}.`;
  return { title, description, openGraph: { title, description, type: "article" } };
}

export default async function BriefPage(props: PageProps<"/brief/[id]">) {
  const { id } = await props.params;
  const b = (await getBrief(id)) ?? (id.startsWith("f-") ? await getOrBuildFeatured(id.slice(2)) : null);
  if (!b) notFound();
  const qlooSteps = b.trace?.filter((s) => s.tool === "qloo").length ?? 0;
  return (
    <>
      <div className="print:hidden"><ModeBanner modes={modes()} /></div>
      <div className="contents print:hidden"><Header /></div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <p className="hidden text-xs uppercase tracking-wider text-muted-foreground print:block">Undercard show brief · Taste data by Qloo · {new Date(b.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })}</p>
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> New brief</Link>
          <BriefActions path={`/brief/${b.id}`} title={`${titleOf(b)}: Undercard show brief`} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 print:mt-2">
          <div className="min-w-0">
            <p className="text-sm text-brand">{b.featured ? "Featured brief" : "Show brief"}{b.sample ? " · simulated sample data" : ""}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance md:text-4xl">{b.headliner.name}</h1>
            <p className="mt-1 text-muted-foreground">{b.headliner.description ? `${b.headliner.description} · ` : ""}{b.input.city} · {b.input.capacity.toLocaleString("en-US")}-cap room</p>
          </div>
          {b.copy.tagline && <blockquote className="max-w-md rounded-xl border border-border bg-card px-4 py-3 text-sm italic">&ldquo;{b.copy.tagline}&rdquo;</blockquote>}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr] print:mt-5 print:block print:space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Mic2 className="size-4 text-brand" /> Recommended undercard</h2>
            {b.openers.length ? (
              <ol className="mt-4 space-y-3">
                {b.openers.map((o, i) => (
                  <li key={o.id} className="flex gap-4 rounded-xl bg-surface p-4 print:p-3">
                    <span className="text-2xl font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{o.name}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", BAND[o.sizeBand])}>{o.sizeBand}</span>
                      </div>
                      {o.rationale && <p className="mt-1 text-sm text-muted-foreground">{o.rationale}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                        <Meter label="Local affinity" v={o.affinity} />
                        <Meter label="Audience overlap" v={o.overlap} />
                        <Meter label="Popularity" v={o.popularity} />
                      </div>
                      {!!o.sharedTags?.length && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {o.sharedTags.map((t) => <span key={t} className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">{t}</span>)}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>Qloo returned no artists for this audience in {b.input.city}. Try a larger nearby city, or ask Undercard to go bigger.</Empty>
            )}
          </section>
          <div className="space-y-6">
            <div className="print:hidden">
              <BriefChat key={`${b.id}-${b.chat?.length ?? 0}`} briefId={b.id} initial={b.chat ?? []} openers={b.openers.map((o) => o.name)} />
            </div>
            <GutVsGraph brief={b} />
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 print:mt-5">
          <h2 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand" /> Where this taste lives</h2>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.6fr_1fr] print:grid-cols-[1.4fr_1fr]">
            {b.center ? <RouteMap brief={{ center: b.center, heat: b.heat ?? [], routing: b.routing, input: b.input }} /> : <div />}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Route className="size-4 text-brand" /> Suggested routing</h3>
              {b.routing.length ? (
                <ul className="mt-3 space-y-2">
                  {b.routing.map((r) => (
                    <li key={r.city} className="text-sm">
                      <div className="flex justify-between gap-2"><span>{r.city}</span><span className="tabular-nums text-muted-foreground">{Math.round(r.affinity * 100)}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${r.affinity * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No nearby city stood out in the heatmap. This audience may be concentrated in {b.input.city} itself.</Empty>
              )}
              <p className="mt-3 text-xs text-muted-foreground">From the Qloo heatmap of this headliner&apos;s audience within about 300 miles. Brighter means stronger affinity.</p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4 print:mt-5 print:grid-cols-2 print:gap-4">
          <EntityList icon={<Store className="size-4 text-brand" />} title="Pre-show partners" items={b.partners.places} />
          <EntityList icon={<Megaphone className="size-4 text-brand" />} title="Sponsor shortlist" items={b.partners.brands} />
          <EntityList icon={<Mic2 className="size-4 text-brand" />} title="Podcast ad buys" items={b.adPlan.podcasts} />
          <EntityList icon={<Tv className="size-4 text-brand" />} title="TV this crowd watches" items={b.adPlan.tv} />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2 print:mt-5 print:grid-cols-2 print:gap-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-brand" /> Audience shape</h2>
            <p className="mt-1 text-sm text-muted-foreground">{b.audience.summary}</p>
            <div className="mt-4 space-y-1.5">
              {b.audience.age.map((a) => (
                <div key={a.label} className="grid grid-cols-[110px_1fr] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{a.label}</span>
                  <div className="relative h-2 rounded-full bg-surface">
                    <div className={cn("absolute top-0 h-2 rounded-full", a.value >= 0 ? "left-1/2 bg-brand" : "right-1/2 bg-slate-500")} style={{ width: `${Math.min(Math.abs(a.value), 1) * 50}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Ad plan and copy</h2>
            {b.adPlan.summary && <p className="mt-2 text-sm">{b.adPlan.summary}</p>}
            {b.copy.social && (
              <>
                <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Social post</p>
                <p className="mt-1 rounded-lg bg-surface p-3 text-sm">{b.copy.social}</p>
              </>
            )}
          </section>
        </div>
        {!!b.trace?.length && (
          <details className="mt-6 rounded-2xl border border-border bg-card p-5 print:hidden">
            <summary className="cursor-pointer text-sm font-semibold">How this brief was built ({b.trace.length} steps, writing by {b.llm === "template" ? "templates" : b.llm})</summary>
            <div className="mt-3"><TraceList steps={b.trace} /></div>
          </details>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground print:mt-5 print:text-left">
          <span className="hidden print:inline">Built from {qlooSteps} Qloo API steps{b.sample ? " (simulated in demo mode)" : ""}. </span>
          Qloo results describe aggregate taste affinities, not predictions about any individual.
        </p>
      </main>
    </>
  );
}

function Meter({ label, v }: { label: string; v?: number }) {
  return <span>{label} <strong className="text-foreground">{v == null ? "n/a" : Math.round(v * 100)}</strong></span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</p>;
}

function EntityList({ icon, title, items }: { icon: React.ReactNode; title: string; items: Entity[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.slice(0, 5).map((e) => (
          <li key={e.id} className="flex justify-between gap-2"><span className="truncate">{e.name}</span>{e.affinity != null && <span className="tabular-nums text-muted-foreground">{Math.round(e.affinity * 100)}</span>}</li>
        ))}
        {!items.length && <li className="text-muted-foreground">Nothing over-indexes strongly here yet.</li>}
      </ul>
    </section>
  );
}
