import type { OpenerPick } from "./types";

/** Capacity to Qloo popularity band (percentile). Small rooms need artists who are not yet huge. */
export function sizeBand(capacity: number, popularity = 0.5): OpenerPick["sizeBand"] {
  const ideal = capacity <= 300 ? 0.55 : capacity <= 800 ? 0.68 : capacity <= 2500 ? 0.8 : 0.9;
  if (popularity > ideal + 0.15) return "too big";
  if (popularity > ideal + 0.05) return "stretch";
  if (popularity < ideal - 0.3) return "too small";
  return "right-size";
}
