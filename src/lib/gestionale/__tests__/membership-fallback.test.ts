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
    expect(source).toContain('["google_sheet", "official_members_book", "manual_override"]');
  });
  it("avvisa che TeamArtist va verificato e non rivela i dati ad Ale", () => {
    const source = readFileSync(join(process.cwd(), "src/app/gestione/(app)/w/[id]/page.tsx"), "utf8");
    expect(source).toContain('isAdmin && membershipEvidence?.source === "snapshot"');
    expect(source).toContain("verificare la registrazione e la quota su TeamArtist");
  });
});