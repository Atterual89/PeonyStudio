import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("sync soci nel gestionale PIN", () => {
  const actions = source("src/app/gestione/(app)/soci/sync/actions.ts");

  it("autorizza solo gli admin in entrambe le azioni", () => {
    expect(actions).toContain("export async function previewSociSyncAction()");
    expect(actions).toContain("export async function applySociSyncAction(");
    expect(actions.match(/await requireAdmin\(\)/g)).toHaveLength(3);
  });

  it("aggiorna le domande separatamente dal libro ufficiale e senza cancellazioni", () => {
    expect(actions).toContain("buildAssociationMembersSyncPreview");
    expect(actions).not.toContain("buildOfficialMembersBookSyncPreview");
    expect(actions).toContain("applyAssociationMembersSync(db, { removeStaleRows: false })");
    expect(actions).toContain("fingerprint(forms) !== expectedToken");
    expect(actions).toContain("forms.validRows < previousForms * 0.75");
    expect(actions).toContain("clearMembershipCache()");
    expect(actions).toContain("refreshGestione()");
    expect(actions).toContain("applyOfficialMembersBookSync(createSupabaseAdminClient(), { removeStaleRows: false })");
    expect(actions).not.toContain('  "GOOGLE_MEMBERS_BOOK_RANGE",');
  });

  it("non tratta TeamArtist come connesso automaticamente", () => {
    const ui = source("src/components/gestionale/SyncSociButton.tsx");
    expect(ui).toContain("Sincronizza soci");
    expect(ui).toContain("Conferma aggiornamento");
    expect(ui).toContain("TeamArtist non è interrogato direttamente");
    expect(ui).not.toContain('stat("Libro soci"');
    const home = source("src/app/gestione/(app)/page.tsx");
    expect(home).toContain("<SyncTicketTailorButton />");
    expect(home).toContain("<SyncSociButton />");
  });

  it("la pagina di revisione soci è protetta e legge tutte le righe", () => {
    const page = source("src/app/gestione/(app)/altro/soci/page.tsx");
    expect(page).toContain("await requireAdmin()");
    expect(page).toContain("loadSociReviewData()");
    const loader = source("src/lib/gestionale/server/soci.ts");
    expect(loader).toContain("offset += 500");
    expect(loader).toContain("deriveMembershipState");
  });
});
