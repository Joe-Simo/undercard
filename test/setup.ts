import os from "node:os";
import path from "node:path";

// Smoke tests always run in demo mode: no network, no keys, scratch storage.
for (const k of ["QLOO_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY", "GITHUB_MODELS_TOKEN", "GEMINI_API_KEY", "BLOB_READ_WRITE_TOKEN", "VERCEL"]) delete process.env[k];
process.env.UNDERCARD_DATA_DIR = path.join(os.tmpdir(), `undercard-test-${process.pid}`);
