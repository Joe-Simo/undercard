import { modes } from "@/lib/env";

export function GET() {
  return Response.json({ modes: modes() });
}
