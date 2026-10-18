"use client";

import { useEffect } from "react";
import { StatePage } from "@/components/undercard/state-page";

export default function BriefError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <StatePage eyebrow="Something went wrong" title="This brief could not load." body="Something failed while loading it. Try again in a moment.">
      <button type="button" onClick={() => retry()} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90">Try again</button>
    </StatePage>
  );
}
