import "server-only";

export type LlmProviderName = "groq" | "github" | "gemini" | "mock";

/**
 * LLM providers that need no credit card. First configured one wins:
 *  - GROQ_API_KEY: Groq free tier (console.groq.com, sign in with GitHub), OpenAI-compatible
 *  - GITHUB_MODELS_TOKEN: GitHub Models free tier (fine-grained PAT with Models: read)
 *  - GEMINI_API_KEY: Google AI Studio free tier, OpenAI-compatible endpoint
 */
export const env = {
  qlooKey: () => process.env.QLOO_API_KEY?.trim() || undefined,
  qlooBaseUrl: () => process.env.QLOO_BASE_URL?.trim() || "https://hackathon.api.qloo.com",
  llm(): { name: LlmProviderName; baseUrl: string; key?: string; model: string } {
    const override = process.env.UNDERCARD_MODEL?.trim();
    if (process.env.GROQ_API_KEY?.trim())
      return { name: "groq", baseUrl: "https://api.groq.com/openai/v1", key: process.env.GROQ_API_KEY.trim(), model: override || "openai/gpt-oss-120b" };
    if (process.env.GITHUB_MODELS_TOKEN?.trim())
      return { name: "github", baseUrl: "https://models.github.ai/inference", key: process.env.GITHUB_MODELS_TOKEN.trim(), model: override || "openai/gpt-4.1-mini" };
    if (process.env.GEMINI_API_KEY?.trim())
      return { name: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", key: process.env.GEMINI_API_KEY.trim(), model: override || "gemini-2.5-flash" };
    return { name: "mock", baseUrl: "", model: "template" };
  },
};

export function modes() {
  return {
    qloo: env.qlooKey() ? ("live" as const) : ("mock" as const),
    llm: env.llm().name === "mock" ? ("mock" as const) : ("live" as const),
    llmProvider: env.llm().name,
  };
}
