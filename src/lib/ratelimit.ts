import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env, modes } from "./env";

/**
 * Daily allowance for the public demo, so one visitor (or one busy day) cannot spend
 * the free LLM quota for everyone. Counts live in memory and in /tmp per server instance,
 * plus a signed cookie that follows the visitor across instances. They reset at UTC
 * midnight (when free model quotas reset) and only apply when a metered provider is in
 * use. Local demo mode stays unlimited. If the shared quota still runs out upstream, the
 * LLM layer falls back to templates, so a brief never dead-ends.
 */
export type Kind = "brief" | "chat";

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
export const limits = () => ({
  brief: num(process.env.UNDERCARD_BRIEFS_PER_VISITOR, 3),
  chat: num(process.env.UNDERCARD_CHATS_PER_VISITOR, 8),
  llmCalls: num(process.env.UNDERCARD_LLM_CALLS_PER_DAY, 40),
});
/** A brief makes two LLM calls (write + gut check). An edit makes one, sometimes three when it rebuilds. */
export const COST: Record<Kind, number> = { brief: 2, chat: 2 };

type State = { day: string; llm: number; visitors: Record<string, Record<Kind, number>> };
const today = () => new Date().toISOString().slice(0, 10);
const file = path.join(process.env.UNDERCARD_DATA_DIR || (process.env.VERCEL ? "/tmp/undercard" : path.join(process.cwd(), ".data")), "quota.json");
let state: State | null = null;

async function load(): Promise<State> {
  if (!state) state = await fs.readFile(file, "utf8").then((s) => JSON.parse(s) as State).catch(() => null);
  if (!state || state.day !== today()) state = { day: today(), llm: 0, visitors: {} };
  return state;
}
function persist() {
  fs.mkdir(path.dirname(file), { recursive: true }).then(() => fs.writeFile(file, JSON.stringify(state))).catch(() => {});
}

export type Limited = { reason: "visitor" | "global"; title: string; message: string };
export type Gate = { ok: true; refund: () => void } | { ok: false; limited: Limited };

export const COPY: Record<Kind, Record<Limited["reason"], Omit<Limited, "reason">>> = {
  brief: {
    visitor: { title: "That's today's fresh briefs.", message: "Each visitor gets a few new briefs a day while Undercard is in preview. The featured briefs are fully built and ready to explore, and new ones open up tomorrow." },
    global: { title: "Undercard is resting for today.", message: "Today's shared AI allowance is spent. The featured briefs are fully built and ready to explore, and fresh briefs open again tomorrow." },
  },
  chat: {
    visitor: { title: "That's today's edits.", message: "You've used today's edits for the preview. This brief stays as it is, and the featured briefs are ready to explore. Edits open up again tomorrow." },
    global: { title: "Undercard is resting for today.", message: "Today's shared AI allowance is spent. This brief stays as it is, and edits open again tomorrow." },
  },
};

/** Pure check used by spend() and tests. `seen` is what the visitor's cookie says they already used today. */
export function take(s: State, kind: Kind, visitor: string, lim = limits(), seen = 0): Gate {
  const v = (s.visitors[visitor] ??= { brief: 0, chat: 0 });
  v[kind] = Math.max(v[kind], seen);
  if (v[kind] >= lim[kind]) return { ok: false, limited: { reason: "visitor", ...COPY[kind].visitor } };
  if (s.llm + COST[kind] > lim.llmCalls) return { ok: false, limited: { reason: "global", ...COPY[kind].global } };
  v[kind]++;
  s.llm += COST[kind];
  return { ok: true, refund: () => { v[kind] = Math.max(0, v[kind] - 1); s.llm = Math.max(0, s.llm - COST[kind]); } };
}
export const freshState = (): State => ({ day: today(), llm: 0, visitors: {} });

const metered = () => env.llm().name !== "mock" || modes().qloo === "live";

const COOKIE = "uc_allowance";
const secret = () => `undercard-allowance:${env.llm().key ?? "local"}`;
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url").slice(0, 22);

/** Reads `day.brief.chat.sig`; anything stale, malformed, or unsigned counts as zero. */
export function readAllowance(req: Request): Record<Kind, number> {
  const raw = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
  const [day, b, c, sig] = (raw ? decodeURIComponent(raw) : "").split(".");
  const body = `${day}.${b}.${c}`;
  const good = sig && day === today() && sig.length === 22 && timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)));
  return good ? { brief: Number(b) || 0, chat: Number(c) || 0 } : { brief: 0, chat: 0 };
}
function allowanceCookie(used: Record<Kind, number>) {
  const body = `${today()}.${used.brief}.${used.chat}`;
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(`${body}.${sign(body)}`)}; Path=/; Max-Age=93600; HttpOnly; SameSite=Lax${secure}`;
}

export type Spent = Gate & { cookie?: string };

export async function spend(kind: Kind, visitor: string, req?: Request): Promise<Spent> {
  if (!metered()) return { ok: true, refund: () => {} };
  const s = await load();
  const used = req ? readAllowance(req) : { brief: 0, chat: 0 };
  const gate = take(s, kind, visitor, limits(), used[kind]);
  persist();
  if (!gate.ok) return gate;
  const cookie = req ? allowanceCookie({ ...used, [kind]: used[kind] + 1 }) : undefined;
  return { ok: true, cookie, refund: () => { gate.refund(); persist(); } };
}

export function clientKey(req: Request) {
  return req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
