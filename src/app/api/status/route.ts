import { modes } from "@/lib/env";
import { blobEnabled } from "@/lib/store";

export function GET() {
  return Response.json({ modes: modes(), storage: blobEnabled() ? "blob" : "local" });
}
