import Link from "next/link";
import { Header, ModeBanner } from "@/components/undercard/chrome";
import { BriefForm } from "@/components/undercard/brief-form";
import { modes } from "@/lib/env";
import { ArrowRight, Star } from "lucide-react";
import { FEATURED } from "@/lib/featured";

export const dynamic = "force-dynamic";

export default async function Home() {
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
              One headliner, one city, one room. Undercard ranks the openers this audience already loves in your market, sized for your capacity, and shows the evidence behind every pick. Change the bill in plain English. Routing and promotion notes come along as supporting detail.
            </p>
            <div className="mt-10"><BriefForm /></div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground"><Star className="size-4 text-brand" /> Featured briefs</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {FEATURED.map((f) => (
              <Link key={f.slug} href={`/featured/${f.slug}`} prefetch={false} className="group rounded-xl border border-border bg-gradient-to-br from-brand/10 to-transparent p-4 transition hover:border-brand/50">
                <p className="font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.blurb}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-brand">Open brief <ArrowRight className="size-3 transition group-hover:translate-x-0.5" /></p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
