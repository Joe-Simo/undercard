import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 py-32 text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-brand" />
      <p>Loading the brief...</p>
    </main>
  );
}
