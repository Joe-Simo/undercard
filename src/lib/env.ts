import "server-only";

export type LlmProviderName = "openrouter" | "groq" | "github" | "gemini" | "mock";

/**
 * LLM providers that need no credit card. First configured one wins:
 *  - OPENROUTER_API_KEY: OpenRouter free models only (ids ending in ":free"), with fallback models
 *  - GROQ_API_KEY: Groq free tier (console.groq.com, sign in with GitHub), OpenAI-compatible
 *  - GITHUB_MODELS_TOKEN: GitHub Models free tier (fine-grained PAT with Models: read)
 *  - GEMINI_API_KEY: Google AI Studio free tier, OpenAI-compatible endpoint
 */
export const env = {
  qlooKey: () => process.env.QLOO_API_KEY?.trim() || undefined,
  qlooBaseUrl: () => process.env.QLOO_BASE_URL?.trim() || "https://hackathon.api.qloo.com",
  llm(): { name: LlmProviderName; baseUrl: string; key?: string; model: string; fallbacks: string[] } {
    const override = process.env.UNDERCARD_MODEL?.trim();
    if (process.env.OPENROUTER_API_KEY?.trim()) {
      const fallbacks = (process.env.UNDERCARD_FALLBACK_MODELS ?? "google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free")
        .split(",").map((m) => m.trim()).filter((m) => m.endsWith(":free"));
      const primary = override?.endsWith(":free") ? override : "nvidia/nemotron-3-ultra-550b-a55b:free";
      return { name: "openrouter", baseUrl: "https://openrouter.ai/api/v1", key: process.env.OPENROUTER_API_KEY.trim(), model: primary, fallbacks: fallbacks.filter((m) => m !== primary) };
    }
    if (process.env.GROQ_API_KEY?.trim())
      return { name: "groq", baseUrl: "https://api.groq.com/openai/v1", key: process.env.GROQ_API_KEY.trim(), model: override || "openai/gpt-oss-120b", fallbacks: [] };
    if (process.env.GITHUB_MODELS_TOKEN?.trim())
      return { name: "github", baseUrl: "https://models.github.ai/inference", key: process.env.GITHUB_MODELS_TOKEN.trim(), model: override || "openai/gpt-4.1-mini", fallbacks: [] };
    if (process.env.GEMINI_API_KEY?.trim())
      return { name: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", key: process.env.GEMINI_API_KEY.trim(), model: override || "gemini-2.5-flash", fallbacks: [] };
    return { name: "mock", baseUrl: "", model: "template", fallbacks: [] };
  },
};

export function modes() {
  return {
    qloo: env.qlooKey() ? ("live" as const) : ("mock" as const),
    llm: env.llm().name === "mock" ? ("mock" as const) : ("live" as const),
    llmProvider: env.llm().name,
  };
}
