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

export type SizeBand = "right-size" | "stretch" | "too big" | "too small";

export interface OpenerPick extends Entity {
  sizeBand: SizeBand;
  overlap?: number; // 0..1 audience overlap with headliner (Qloo compare)
  sharedTags?: string[];
  rationale: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  meta?: string;
  at: string;
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
  /** Remaining ranked candidates, used when the user asks to swap an opener. */
  bench: (Entity & { sizeBand: SizeBand })[];
  center: { lat: number; lng: number };
  heat: { lat: number; lng: number; affinity: number }[];
  trace: TraceStep[];
  chat: ChatMessage[];
  llm: string;
  featured?: string;
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

export interface Overlap {
  score: number; // 0..1
  sharedTags: string[];
}
