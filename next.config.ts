import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page reads live per-user data, so Cache Components are off for now.
  cacheComponents: false,
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
