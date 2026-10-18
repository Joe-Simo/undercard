/**
 * Scripts run outside Next, so read .env.local the way `next dev` does. Existing env vars win.
 * `--dry-run` skips it: a dry run is for mock data and must not pick up real keys.
 */
import { existsSync } from "node:fs";

if (!process.argv.includes("--dry-run")) for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
