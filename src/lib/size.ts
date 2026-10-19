import type { OpenerPick } from "./types";

/** Capacity to Qloo popularity band (percentile). Small rooms need artists who are not yet huge. */
export const idealPopularity = (capacity: number) => (capacity <= 300 ? 0.55 : capacity <= 800 ? 0.68 : capacity <= 2500 ? 0.8 : 0.9);

/**
 * Highest Qloo popularity that still fits the room (right-size or stretch), or undefined when every act fits.
 * Live Qloo popularity is a percentile and the acts a headliner's audience loves most sit near the top of it,
 * so small rooms ask Qloo for acts under this ceiling instead of hoping some appear in the uncapped list.
 */
export function roomCeiling(capacity: number) {
  const c = Math.round((idealPopularity(capacity) + 0.15) * 100) / 100;
  return c < 1 ? c : undefined;
}

export function sizeBand(capacity: number, popularity = 0.5): OpenerPick["sizeBand"] {
  const ideal = idealPopularity(capacity);
  if (popularity > ideal + 0.15) return "too big";
  if (popularity > ideal + 0.05) return "stretch";
  if (popularity < ideal - 0.3) return "too small";
  return "right-size";
}
