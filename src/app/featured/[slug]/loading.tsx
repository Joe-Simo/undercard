import { Loader2 } from "lucide-react";
import { Header } from "@/components/undercard/chrome";

export default function Loading() {
  return (
    <>
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-32 text-center text-muted-foreground" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-brand" />
        <p>Building the featured brief from Qloo data. This only happens once.</p>
      </main>
    </>
  );
}
