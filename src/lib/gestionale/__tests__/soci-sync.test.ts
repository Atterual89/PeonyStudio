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
    expect(actions).toContain("isGoogleFormImportSuspicious(forms.validRows, previousUniqueForms)");
    expect(actions).toContain("forms.existingUniqueRows");
    expect(actions).toContain("clearMembershipCache()");
    expect(actions).toContain("refreshGestione()");
    expect(actions).toContain("applyOfficialMembersBookSync(createSupabaseAdminClient(), { removeStaleRows: false })");
    expect(actions).not.toContain('  "GOOGLE_MEMBERS_BOOK_RANGE",');
  });

  it("presenta solo registrazioni Google e verifica quote separata", () => {
    const ui = source("src/components/gestionale/SyncSociButton.tsx");
    expect(ui).toContain("Aggiorna moduli Google");
    expect(ui).toContain("Esamina le incongruenze una alla volta");
    expect(ui).not.toContain("onClick={apply}");
    expect(ui).toContain("/gestione/altro/soci/revisione");
    expect(ui).not.toContain('stat("Libro soci"');
    const home = source("src/app/gestione/(app)/page.tsx");
    expect(home).toContain("<SyncTicketTailorButton />");
    expect(home).not.toContain("<SyncSociButton />");
    const settings = source("src/app/gestione/(app)/altro/soci/page.tsx");
    expect(settings).toMatch(/<SyncSociButton\s*\/>/);
    expect(settings).not.toContain("<SyncOfficialBookButton/>");
    expect(settings.indexOf("<SyncSociButton/>")).toBeLessThan(settings.indexOf("<AssociationMailSyncControl/>"));
    expect(settings.indexOf("<SyncSociButton/>")).toBeLessThan(settings.indexOf("<AssociationMailSyncControl/>"));
    expect(settings).toContain("<Suspense");
  });

  it("la pagina di revisione soci è protetta e legge tutte le righe", () => {
    const page = source("src/app/gestione/(app)/persone/page.tsx");
    expect(page).toContain("await requireAdmin()");
    expect(page).toContain("loadUnifiedDirectory(today)");
    expect(page).not.toContain("loadSociReviewData()");
    expect(page).not.toContain("loadUpcomingPeonyPeople");
    expect(page).not.toContain("loadUpcomingLuxuriaPeople");
    const loader = source("src/lib/gestionale/server/soci.ts");
    expect(loader).toContain("offset += 500");
    expect(loader).toContain("deriveMembershipState");
  });
});

describe("menu gestionale semplificato", () => {
  const nav = source("src/components/gestionale/GestioneNav.tsx");
  it("usa Eventi, Persone e Impostazioni senza Cerca e registrazioni come schede autonome", () => {
    expect(nav).toContain('label: "Eventi"');
    expect(nav).toContain('label: "Persone"');
    expect(nav).toContain('label: "Impostazioni"');
    expect(nav).not.toContain('label: "Cerca"');
    expect(nav).not.toContain('label: "Altro"');
    const settings = source("src/app/gestione/(app)/altro/page.tsx");
    expect(settings).toContain("Registrazioni e quote");
    expect(settings).not.toContain("Registrazioni associazione");
  });
});

describe("Ticket Tailor a blocchi e accesso rapido al libro soci", () => {
  const actions = source("src/app/gestione/(app)/peony/sync/actions.ts");
  const importer = source("src/lib/ticket-tailor/sync-issued-tickets.ts");
  const button = source("src/components/gestionale/SyncTicketTailorButton.tsx");
  const eventPage = source("src/app/gestione/(app)/peony/[id]/page.tsx");
  const bookPage = source("src/app/gestione/(app)/altro/soci/page.tsx");
  it("usa una pagina di ordini per richiesta e gestisce i cursori", () => {
    expect(actions).toContain("syncTicketTailorPageFromGestionale");
    expect(actions).toContain("await requireAdmin()");
    expect(actions).toContain("maxPages:1");
    expect(importer).toContain("starting_after");
    expect(importer).toContain("AbortSignal.timeout(20_000)");
    expect(importer).toContain("nextCursor");
    expect(button).toContain("for(let page=1;page<=100;page++)");
    expect(button).toContain("response.nextCursor");
  });
  it("sincronizza la vista Evento senza aggiornare la box office intera", () => {
    expect(eventPage).toContain("<SyncTicketTailorButton eventId={event.id} />");
    expect(actions).toContain("ticketTailorEventId=event.ticketTailorEventId");
  });
  it("offre accesso visibile all'allineamento senza confermare quote automaticamente", () => {
    const nav=source("src/components/gestionale/GestioneNav.tsx");
    expect(nav).toContain('href: "/gestione/altro/soci", label: "Verifiche"');
    expect(eventPage).not.toContain("Allinea libro soci");
    expect(bookPage).toContain('id="allineamento-anagrafiche"');
    expect(bookPage).not.toContain('id="allineamento-anagrafiche" open');
    expect(bookPage).toContain("MemberLinkReview");
    expect(bookPage).not.toContain("SociBookUpload");
    expect(bookPage).toContain("RefreshMembershipButton");
  });
});
