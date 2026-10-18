"use client";

import { useState } from "react";
import { Check, Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copy a share link and export the brief to PDF through the browser's print dialog (see the print styles). */
export function BriefActions({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", { description: "Anyone with the link can open this brief." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). The native share sheet is the next best thing.
      if (navigator.share) await navigator.share({ title, url }).catch(() => {});
      else toast.message("Copy this link", { description: url, duration: 10_000 });
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={copy} aria-live="polite">
        {copied ? <Check className="text-emerald-400" /> : <Link2 />} {copied ? "Copied" : "Copy link"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer /> Save as PDF
      </Button>
    </div>
  );
}
