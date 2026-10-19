import { sizeBand } from "../size";
import type { Entity } from "../types";

/**
 * The one scoring rule, stated in code and applied identically to both sides:
 *
 *   A pick counts as a "room-fit local pick" when it appears in Qloo's top 50 artists for this
 *   headliner's audience in this city among acts that fit the room (GET /v2/insights with
 *   signal.location.query and filter.popularity.max set to the room's ceiling) AND its Qloo popularity
 *   is right-size or a stretch for the room (the same sizeBand Undercard uses). Score = picks / 5.
 *
 * History, kept on purpose: rule v1 (Oct 18, before the key) used the top 50 with no popularity cap.
 * The first live run showed that list is almost all popularity 0.8 and up, so for rooms under about
 * 1,000 capacity no list could score, Undercard's included. v2 asks Qloo for the room-sized list instead.
 *
 * Limit, stated up front: the ruler is Qloo's own data, which Undercard also uses to choose, so
 * Undercard's score is close to 1 by construction. The informative number is the model-only score: how
 * often an LLM's gut picks are acts Qloo places in this city's taste at this room's size. It does not
 * measure ticket sales.
 */
export const RULE = "room-fit local picks out of 5: in Qloo's top 50 local artists for this headliner and city under the room's popularity ceiling, and right-size or stretch for the room";
export const RULE_V1 = "room-fit local picks out of 5: in Qloo's top 50 local artists for this headliner and city, and right-size or stretch for the room";

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
