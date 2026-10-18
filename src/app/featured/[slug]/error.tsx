"use client";

import { useEffect } from "react";
import { StatePage } from "@/components/undercard/state-page";

export default function FeaturedError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <StatePage eyebrow="Something went wrong" title="This featured brief could not load." body="Something failed while loading it. Try again in a moment, or open another featured brief.">
      <button type="button" onClick={() => retry()} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">Try again</button>
    </StatePage>
  );
}
