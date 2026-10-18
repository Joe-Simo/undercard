import Link from "next/link";
import { Header, ModeBanner } from "@/components/undercard/chrome";
import { BriefForm } from "@/components/undercard/brief-form";
import { modes } from "@/lib/env";
import { ArrowRight, Star } from "lucide-react";
import { FEATURED } from "@/lib/featured";
import { listBriefs } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const briefs = await listBriefs();
  return (
    <>
      <ModeBanner modes={modes()} />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(ellipse_at_center,oklch(0.74_0.18_40/0.25),transparent_60%)]" />
          <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20">
            <p className="text-sm font-medium text-brand">For independent promoters, talent buyers, and small venues</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              Book the undercard your city actually wants.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground text-pretty">
              One headliner and one city in. Out comes a show brief built on real taste data: openers who over-index locally and fit your room, where to route the tour, which bars and brands to partner with, and where to spend the ad money.
            </p>
            <div className="mt-10"><BriefForm /></div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground"><Star className="size-4 text-brand" /> Featured briefs</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {FEATURED.map((f) => (
              <Link key={f.slug} href={`/featured/${f.slug}`} prefetch={false} className="group rounded-xl border border-white/10 bg-gradient-to-br from-brand/10 to-transparent p-4 transition hover:border-brand/50">
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.blurb}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-brand">Open brief <ArrowRight className="size-3 transition group-hover:translate-x-0.5" /></p>
              </Link>
            ))}
          </div>
        </section>
        {briefs.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-20">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent briefs</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {briefs.map((b) => (
                <Link key={b.id} href={`/brief/${b.id}`} className="rounded-xl border border-white/10 bg-card p-4 transition hover:border-brand/50">
                  <p className="font-semibold">{b.headliner.name}</p>
                  <p className="text-sm text-muted-foreground">{b.input.city} · {b.input.capacity} cap</p>
                  <p className="mt-2 truncate text-xs text-muted-foreground">with {b.openers.slice(0, 2).map((o) => o.name).join(", ")}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
