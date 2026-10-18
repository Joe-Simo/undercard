import Link from "next/link";
import { Header } from "./chrome";

/** Shared layout for not-found and error screens, so dead ends still look like Undercard and offer a way forward. */
export function StatePage({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-24">
        <p className="text-sm font-medium text-brand">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="text-muted-foreground text-pretty">{body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {children}
          <Link href="/" className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium transition hover:border-brand/50">Build a new brief</Link>
        </div>
      </main>
    </>
  );
}
