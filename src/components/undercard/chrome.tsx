import Link from "next/link";
import { FlaskConical } from "lucide-react";
import type { Mode } from "@/lib/types";

export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-brand to-brand-2 text-xs font-black text-background">U</span>
      <span className="text-lg">Undercard</span>
    </Link>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <span className="text-xs text-muted-foreground">Taste data by Qloo</span>
      </div>
    </header>
  );
}

export function ModeBanner({ modes }: { modes: { qloo: Mode; llm: Mode } }) {
  if (modes.qloo === "live" && modes.llm === "live") return null;
  return (
    <div className="border-b border-amber-400/20 bg-amber-400/10 text-amber-200">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-xs sm:text-sm">
        <FlaskConical className="size-4 shrink-0" />
        <span>
          <strong>Demo mode:</strong>{" "}
          {[modes.qloo === "mock" ? "Qloo results are simulated, with invented openers and partners (no QLOO_API_KEY yet)" : null, modes.llm === "mock" ? "writing is templated (no LLM key set)" : null].filter(Boolean).join("; ")}.
        </span>
      </div>
    </div>
  );
}
