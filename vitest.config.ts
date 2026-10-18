import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 15_000,
    // Vitest sorts object keys in snapshots by default. Digested state depends on key
    // insertion order, so keep keys in the order they were written to catch that drift.
    snapshotFormat: { compareKeys: null },
  },
});
