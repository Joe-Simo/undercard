import { sizeBand } from "../size";
import type { Entity } from "../types";

/**
 * The one scoring rule, stated in code and applied identically to both sides:
 *
 *   A pick counts as a "room-fit local pick" when it appears in Qloo's top 50 artists for this
 *   headliner's audience in this city (GET /v2/insights, signal.location.query) AND its Qloo
 *   popularity is right-size or a stretch for the room (the same sizeBand Undercard uses).
 *   Score = room-fit local picks / 5.
 *
 * Limit, stated up front: the ruler is Qloo's own data, which Undercard also uses to choose. The
 * score measures whether a list matches local taste and room size as Qloo sees them. It does not
 * measure ticket sales.
 */
export const RULE = "room-fit local picks out of 5: in Qloo's top 50 local artists for this headliner and city, and right-size or stretch for the room";

export const normName = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();

export function scorePicks(picks: string[], ruler: Entity[], capacity: number) {
  const byName = new Map(ruler.map((e) => [normName(e.name), e]));
  const detail = picks.slice(0, 5).map((name) => {
    const hit = byName.get(normName(name));
    const band = hit ? sizeBand(capacity, hit.popularity) : undefined;
    return { name, local: !!hit, band, counts: !!hit && (band === "right-size" || band === "stretch") };
  });
  return { score: detail.filter((d) => d.counts).length / 5, detail };
}
