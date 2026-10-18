export type Mode = "live" | "mock";

export interface ShowInput {
  headliner: string;
  city: string;
  capacity: number;
  date?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  popularity?: number; // 0..1 percentile
  affinity?: number; // 0..1 relative to the signal
  tags?: string[];
  image?: string;
  address?: string;
}

export interface OpenerPick extends Entity {
  sizeBand: "right-size" | "stretch" | "too big" | "too small";
  overlap?: number; // 0..1 audience overlap with headliner
  rationale: string;
}

export interface RouteStop {
  city: string;
  lat: number;
  lng: number;
  affinity: number; // 0..1
  note: string;
}

export interface AudienceShape {
  age: { label: string; value: number }[];
  gender: { label: string; value: number }[];
  summary: string;
}

export interface Brief {
  id: string;
  input: ShowInput;
  headliner: Entity;
  openers: OpenerPick[];
  routing: RouteStop[];
  partners: { places: Entity[]; brands: Entity[] };
  adPlan: { podcasts: Entity[]; tv: Entity[]; summary: string };
  audience: AudienceShape;
  copy: { social: string; tagline: string };
  gutCheck: { llmOnly: string[]; note: string };
  sample: boolean;
  createdAt: string;
}

export interface TraceStep {
  id: string;
  label: string;
  detail?: string;
  tool: "qloo" | "llm" | "undercard";
  endpoint?: string;
  model?: string;
  mocked: boolean;
  status: "running" | "ok" | "error";
  ms?: number;
}

export type BriefEvent =
  | { type: "step"; step: TraceStep }
  | { type: "done"; brief: Brief }
  | { type: "error"; message: string };
