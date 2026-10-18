import type { AudienceShape, Entity, Overlap } from "../types";

export type EntityType =
  | "urn:entity:artist"
  | "urn:entity:brand"
  | "urn:entity:place"
  | "urn:entity:podcast"
  | "urn:entity:tv_show"
  | "urn:entity:movie"
  | "urn:entity:destination";

export interface HeatCell {
  lat: number;
  lng: number;
  affinity: number;
  popularity?: number;
}

/**
 * Everything Undercard needs from Qloo. The live client talks to https://hackathon.api.qloo.com;
 * the mock returns invented, clearly labeled data so the product can be built before the key arrives.
 */
export interface QlooClient {
  readonly name: "qloo" | "mock";
  searchEntity(query: string, type: EntityType): Promise<Entity[]>;
  insights(opts: {
    type: EntityType;
    signalEntities: string[];
    locationQuery?: string;
    take?: number;
    popularityMax?: number;
    popularityMin?: number;
  }): Promise<Entity[]>;
  /** Audience overlap between two entities (GET /v2/analysis/compare). */
  compare(a: string, b: string): Promise<Overlap>;
  heatmap(opts: { signalEntities: string[]; locationQuery: string; radiusMeters?: number }): Promise<HeatCell[]>;
  demographics(entityId: string): Promise<AudienceShape>;
}
