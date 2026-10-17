import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    // Database tests share one local Postgres; run files one at a time so
    // the concurrency tests measure what they claim to.
    fileParallelism: false,
    testTimeout: 20_000,
    setupFiles: ["tests/setup-env.ts"],
  },
});
