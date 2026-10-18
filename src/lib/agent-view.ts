import "server-only";
import type { Brief } from "./types";

const pct = (v?: number) => (v == null ? null : Math.round(v * 100));

/**
 * A compact, agent-friendly view of a brief: the same facts the brief page shows, as plain JSON.
 * Scores are 0 to 100, as on the page. Used by the MCP endpoint.
 */
export function briefForAgents(b: Brief, origin: string) {
  return {
    brief_id: b.id,
    url: `${origin}/brief/${b.id}`,
    sample_data: b.sample,
    ...(b.sample ? { sample_note: "Demo mode: Qloo results are simulated with invented openers and partners." } : {}),
    headliner: { name: b.headliner.name, ...(b.headliner.description ? { description: b.headliner.description } : {}) },
    city: b.input.city,
    capacity: b.input.capacity,
    openers: b.openers.map((o, i) => ({
      slot: i + 1,
      name: o.name,
      size_fit: o.sizeBand,
      local_affinity: pct(o.affinity),
      audience_overlap: pct(o.overlap),
      popularity: pct(o.popularity),
      shared_tags: o.sharedTags ?? [],
      rationale: o.rationale,
    })),
    routing: b.routing.map((r) => ({ city: r.city, affinity: pct(r.affinity), note: r.note })),
    partners: { places: b.partners.places.map((p) => p.name), brands: b.partners.brands.map((x) => x.name) },
    ad_plan: { podcasts: b.adPlan.podcasts.map((p) => p.name), tv: b.adPlan.tv.map((t) => t.name), summary: b.adPlan.summary },
    audience: b.audience.summary,
    copy: b.copy,
    gut_vs_graph: { llm_only_picks: b.gutCheck.llmOnly, note: b.gutCheck.note },
    qloo_calls: b.trace?.filter((s) => s.tool === "qloo").length ?? 0,
    recent_chat: (b.chat ?? []).slice(-4).map((m) => ({ role: m.role, text: m.text })),
  };
}
