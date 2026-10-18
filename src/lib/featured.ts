import "server-only";
import { buildBrief } from "./pipeline";
import { getBrief, saveBrief } from "./store";
import type { Brief, ShowInput } from "./types";

/** Hand-picked demos. Built once from live data, then served from the private cache. */
export const FEATURED: { slug: string; title: string; blurb: string; input: ShowInput }[] = [
  { slug: "japanese-breakfast-lawrence", title: "Japanese Breakfast in Lawrence, KS", blurb: "1,000-cap college-town room", input: { headliner: "Japanese Breakfast", city: "Lawrence, KS", capacity: 1000 } },
  { slug: "khruangbin-nashville", title: "Khruangbin in Nashville, TN", blurb: "2,500-cap theater", input: { headliner: "Khruangbin", city: "Nashville, TN", capacity: 2500 } },
  { slug: "wednesday-asheville", title: "Wednesday in Asheville, NC", blurb: "350-cap club", input: { headliner: "Wednesday", city: "Asheville, NC", capacity: 350 } },
];

const inflight = new Map<string, Promise<Brief>>();

export function featuredId(slug: string) {
  return `f-${slug}`;
}

export async function getOrBuildFeatured(slug: string): Promise<Brief | null> {
  const f = FEATURED.find((x) => x.slug === slug);
  if (!f) return null;
  const cached = await getBrief(featuredId(slug));
  if (cached) return cached;
  let p = inflight.get(slug);
  if (!p) {
    p = buildBrief(f.input, () => {}, { id: featuredId(slug), featured: f.title }).then(async (b) => {
      await saveBrief(b);
      return b;
    }).finally(() => inflight.delete(slug));
    inflight.set(slug, p);
  }
  return p;
}
