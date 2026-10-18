import "server-only";

export const env = {
  qlooKey: () => process.env.QLOO_API_KEY?.trim() || undefined,
  qlooBaseUrl: () => process.env.QLOO_BASE_URL?.trim() || "https://hackathon.api.qloo.com",
  nebiusKey: () => process.env.NEBIUS_API_KEY?.trim() || undefined,
  nebiusBaseUrl: () => process.env.NEBIUS_BASE_URL?.trim() || "https://api.tokenfactory.nebius.com/v1",
  model: () => process.env.UNDERCARD_MODEL?.trim() || "nvidia/nemotron-3-super-120b-a12b",
};

export function modes() {
  return {
    qloo: env.qlooKey() ? ("live" as const) : ("mock" as const),
    llm: env.nebiusKey() ? ("live" as const) : ("mock" as const),
  };
}
