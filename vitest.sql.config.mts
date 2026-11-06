import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Test SQL del gestionale: migrazioni e funzioni gw_* su Postgres in memoria
// (PGlite). Non toccano il database reale.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/lib/gestionale/__tests__/sql/**/*.sql.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
