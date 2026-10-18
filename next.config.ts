import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads live per-user data, so Cache Components are off for now.
  cacheComponents: false,
  // Precomputed featured briefs are read from disk at runtime; ship them with the server functions.
  outputFileTracingIncludes: { "/brief/[id]": ["./data/featured/**"], "/featured/[slug]": ["./data/featured/**"], "/api/brief/[id]/chat": ["./data/featured/**"] },
  // The LLM key is read only by server-only modules. Inlining it at build time lets a deployment carry it
  // from a server-side .env file without a dashboard env var. It never reaches client bundles.
  env: process.env.OPENROUTER_API_KEY ? { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY } : {},
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
