import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regressione 7/11/2026: senza service account Google la pagina workshop
// non deve collassare quando l'admin chiede lo stato associativo.
describe("workshop admin con Google non configurato", () => {
  it("prevede una lettura di sola copia con stato esplicito", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/gestionale/server/membership.ts"), "utf8");
    expect(source).toContain("async function fetchSavedEvidence()");
    expect(source).toContain("if (!canReadGoogle)");
    expect(source).toContain("return fetchSavedEvidence()");
    expect(source).toContain('source: "snapshot"');
    expect(source).toContain("getMembershipEvidenceStatus");
    expect(source).toContain('.eq("source", "google_sheet")');
    expect(source).toContain('.eq("source","manual_override")');
    expect(source).toContain('readCurrentManualValidations');
  });
  it("avvisa che le verifiche da copia vanno aggiornate", () => {
    const source = readFileSync(join(process.cwd(), "src/app/gestione/(app)/w/[id]/page.tsx"), "utf8");
    expect(source).toContain('isAdmin && membershipEvidence?.source === "snapshot"');
    expect(source).toContain("aggiorna le registrazioni Google e le quote email");
  });
});