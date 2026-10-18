import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    // Loads .env, .env.local, etc. so DB tests can read TEST_SUPABASE_*.
    env: loadEnv(mode, process.cwd(), ""),
    // DB tests share one test project and reset it between tests; run files one at a time.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
}));
