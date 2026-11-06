import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Test del gestionale. `server-only` è risolto internamente da Next e non
// esiste come pacchetto: nei test lo sostituisce un modulo vuoto.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/lib/gestionale/__tests__/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/lib/gestionale/**/*.test.ts"],
    // I test SQL (PGlite) hanno uno script a parte: test:gestionale:sql.
    exclude: ["**/node_modules/**", "src/lib/gestionale/__tests__/sql/**"],
    environment: "node",
    testTimeout: 30_000,
  },
});
