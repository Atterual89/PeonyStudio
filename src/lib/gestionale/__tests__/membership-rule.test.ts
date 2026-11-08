// D11 (016, periodi corretti): stato socio come la pagina admin, per il
// periodo associativo del workshop, più la correzione manuale del gestionale.
// Dati inventati.

import { describe, expect, it } from "vitest";

import { deriveMembershipState, type MembershipEvidenceRow } from "@/lib/association/membership-state";

import { parseMemberKey, memberKeyOfPerson, memberKeyOfRow } from "../member-key";
import { deriveForWorkshop, formatShortDate, memberOutcomeLabel, membershipBadge, membershipLabel } from "../membership-rule";

function evidence(fields: Partial<MembershipEvidenceRow>): MembershipEvidenceRow {
  return {
    first_name: "Viola",
    last_name: "Serra",
    email: "viola@example.test",
    source: "official_members_book",
    membership_status: "verified",
    membership_starts_at: "2025-10-01",
    membership_expires_at: "2026-12-31",
    ...fields,
  };
}

function badge(
  rows: MembershipEvidenceRow[],
  identity: Parameters<typeof deriveMembershipState>[1],
  workshopStartsOn: string,
  linked = true,
) {
  return membershipBadge({ workshopStartsOn, state: deriveForWorkshop(rows, identity, workshopStartsOn), linked });
}

describe("badge del gestionale = stato della pagina admin", () => {
  it("caso di verifica: solo una riga google_sheet → quota non registrata, come nell'admin", () => {
    const rows = [evidence({ source: "google_sheet", membership_starts_at: "2026-01-10" })];
    const identity = { email: "viola@example.test" };
    expect(deriveMembershipState(rows, identity).status).toBe("payment_missing");
    const b = badge(rows, identity, "2026-03-14");
    expect(b).toEqual({ kind: "quota_mancante", paymentsFrom: "2025-09-01" });
    expect(membershipLabel(b)).toBe("Quota non registrata dal 1 set 2025");
  });

  it("libro soci pagato nel periodo associativo del workshop → Tesseramento in regola", () => {
    const b = badge([evidence({})], { email: "Viola@Example.test" }, "2026-03-14");
    expect(b).toEqual({ kind: "in_regola", expiresAt: "2026-12-31", match: "email" });
    expect(membershipLabel(b)).toBe("In regola");
  });

  it("workshop nov 2026, quota pagata a ottobre 2025 → in regola; feb 2027, stessa quota → non in regola", () => {
    const rows = [evidence({ membership_starts_at: "2025-10-15" })];
    const identity = { email: "viola@example.test" };
    expect(badge(rows, identity, "2026-11-14").kind).toBe("in_regola");
    const feb2027 = badge(rows, identity, "2027-02-06");
    expect(feb2027.kind).toBe("modulo_mancante");
    // Non collegata esplicitamente: stesso esito, badge "Non collegata al libro soci".
    expect(badge(rows, identity, "2027-02-06", false).kind).toBe("non_collegata");
    // Con il modulo presente: "Quota non registrata dal 1 gen 2027".
    const withForm = [...rows, evidence({ source: "google_sheet", membership_starts_at: "2025-10-01" })];
    expect(membershipLabel(badge(withForm, identity, "2027-02-06"))).toBe("Quota non registrata dal 1 gen 2027");
  });

  it("quando il libro ufficiale conferma l'annualità precedente, nel 2027 indica quota non verificata e non modulo assente", () => {
    const rows=[evidence({email:null,first_name:"Gaia",last_name:"Baietti"})];
    const state=deriveForWorkshop(rows,{firstName:"Gaia",lastName:"Baietti"},"2027-02-19");
    expect(membershipBadge({workshopStartsOn:"2027-02-19",state,linked:true,knownHistoricalMember:true}))
      .toEqual({kind:"quota_mancante",paymentsFrom:"2027-01-01"});
  });

  it("dal 2027 conta la quota pagata nell'anno solare; una quota del 2027 non vale per il 2026", () => {
    const paid2027 = [evidence({ membership_starts_at: "2027-01-03", membership_expires_at: "2027-12-31" })];
    expect(badge(paid2027, { email: "viola@example.test" }, "2027-02-06")).toMatchObject({ kind: "in_regola", expiresAt: "2027-12-31" });
    expect(badge(paid2027, { email: "viola@example.test" }, "2026-11-14").kind).toBe("modulo_mancante");
  });

  it("workshop prima del primo periodo: nessuna quota conta", () => {
    const b = badge([evidence({ source: "google_sheet" }), evidence({})], { email: "viola@example.test" }, "2025-06-01");
    expect(b).toEqual({ kind: "quota_mancante", paymentsFrom: null });
    expect(membershipLabel(b)).toBe("Quota non registrata");
  });

  it("data breve delle etichette", () => {
    expect(formatShortDate("2025-09-01")).toBe("1 set 2025");
    expect(formatShortDate("2027-01-01")).toBe("1 gen 2027");
  });

  it("per nome solo se c'è un'unica riga nel libro ufficiale", () => {
    const one = [evidence({ email: null })];
    expect(badge(one, { firstName: "Serra", lastName: "Viola" }, "2026-03-14")).toMatchObject({ kind: "in_regola", match: "name" });
    const two = [evidence({ email: null }), evidence({ email: null, membership_starts_at: "2025-11-01" })];
    expect(badge(two, { firstName: "Viola", lastName: "Serra" }, "2026-03-14").kind).toBe("modulo_mancante");
  });

  it("nessuna riga: collegata → Modulo non trovato; non collegata → Non collegata al libro soci", () => {
    expect(membershipLabel(badge([], { email: "nessuno@example.test" }, "2026-03-14"))).toBe("Modulo non trovato");
    const notLinked = badge([], { email: "nessuno@example.test" }, "2026-03-14", false);
    expect(notLinked).toEqual({ kind: "non_collegata" });
    expect(membershipLabel(notLinked)).toBe("Non collegata");
    // Trovata dall'abbinamento admin (per email) anche senza collegamento esplicito: vale lo stato.
    expect(badge([evidence({})], { email: "viola@example.test" }, "2026-03-14", false).kind).toBe("in_regola");
  });

  it("validazione manuale \"Quota ok\" del periodo del workshop: in regola (manuale); annullata o di un altro periodo no", () => {
    const manual = (fields: Partial<MembershipEvidenceRow>) =>
      evidence({ source: "manual_override", email: "viola@example.test", membership_starts_at: "2025-09-01", ...fields });
    const b = badge([manual({})], { email: "viola@example.test" }, "2026-03-14");
    expect(b).toEqual({ kind: "in_regola", expiresAt: "2026-12-31", match: "manual" });
    expect(membershipLabel(b)).toBe("In regola (manuale)");
    expect(badge([manual({ membership_status: "revoked" })], { email: "viola@example.test" }, "2026-03-14").kind).toBe("modulo_mancante");
    expect(badge([manual({})], { email: "viola@example.test" }, "2027-02-06").kind).toBe("modulo_mancante");
    expect(
      badge([manual({ membership_starts_at: "2027-01-01", membership_expires_at: "2027-12-31" })], { email: "viola@example.test" }, "2027-02-06"),
    ).toMatchObject({ kind: "in_regola", match: "manual" });
  });
});

describe("chiavi del socio", () => {
  it("manuale per id, libro soci / modulo per email normalizzata come l'admin, altrimenti per nome", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(memberKeyOfRow({ tableId: id, email: "x@example.test", first_name: null, last_name: null })).toBe(`m:${id}`);
    expect(memberKeyOfRow({ tableId: null, email: "Viola.Serra+wk@GoogleMail.com", first_name: null, last_name: null })).toBe("e:violaserra@gmail.com");
    expect(memberKeyOfRow({ tableId: null, email: null, first_name: "Serra", last_name: "Viola" })).toBe("n:serra viola");
    expect(memberKeyOfRow({ tableId: null, email: null, first_name: "Viola", last_name: null })).toBeNull();

    expect(parseMemberKey(`m:${id}`)).toEqual({ kind: "manual", id });
    expect(parseMemberKey("e:violaserra@gmail.com")).toEqual({ kind: "email", email: "violaserra@gmail.com" });
    expect(parseMemberKey("e:Viola.Serra@gmail.com")).toBeNull();
    expect(parseMemberKey("n:serra viola")).toEqual({ kind: "name", nameKey: "serra viola" });
    expect(parseMemberKey(id)).toBeNull();

    expect(memberKeyOfPerson({ association_member_id: id, membership_email: null })).toBe(`m:${id}`);
    expect(memberKeyOfPerson({ association_member_id: null, membership_email: "viola.serra@gmail.com" })).toBe("e:violaserra@gmail.com");
    expect(memberKeyOfPerson({ association_member_id: null, membership_email: null })).toBeNull();
    expect(memberKeyOfPerson({ association_member_id: null, membership_email: null, membership_name_key: "serra viola" })).toBe("n:serra viola");
  });
});

describe("4d — ricerca nel libro soci: stato che risulterebbe", () => {
  it("in regola fino al…, solo modulo o libro soci senza quota, modulo non trovato", () => {
    expect(memberOutcomeLabel({ kind: "in_regola", expiresAt: "2026-12-31", match: "email" }, true)).toBe("In regola fino al 31 dic 2026");
    expect(memberOutcomeLabel({ kind: "quota_mancante", paymentsFrom: "2025-09-01" }, false)).toBe("Solo modulo, quota non registrata");
    expect(memberOutcomeLabel({ kind: "quota_mancante", paymentsFrom: "2025-09-01" }, true)).toBe("Nel libro soci, quota non registrata");
    expect(memberOutcomeLabel({ kind: "modulo_mancante" }, true)).toBe("Modulo non trovato");
  });
});

describe("quote da modulo Google e omonimi", () => {
  it("due domande con stesso nome ma email diverse non condividono la validazione manuale", () => {
    const rows: MembershipEvidenceRow[] = [
      evidence({ source: "google_sheet", email: "viola@example.test" }),
      evidence({ source: "google_sheet", email: "altra@example.test" }),
      evidence({ source: "manual_override", email: "viola@example.test", membership_starts_at: "2025-09-01" }),
    ];
    expect(deriveForWorkshop(rows, { email: "viola@example.test", firstName: "Viola", lastName: "Serra" }, "2026-11-07").status).toBe("valid");
    expect(deriveForWorkshop(rows, { email: "altra@example.test", firstName: "Viola", lastName: "Serra" }, "2026-11-07").status).toBe("payment_missing");
  });
});


describe("quote ufficiali conservate per più annualità", () => {
  it("un socio senza email nel libro conserva la validità per il 2026 anche dopo l'import 2027", () => {
    const rows: MembershipEvidenceRow[] = [
      evidence({ email: null, membership_starts_at: "2025-09-01", membership_expires_at: "2026-12-31" }),
      evidence({ email: null, membership_starts_at: "2027-01-01", membership_expires_at: "2027-12-31" }),
    ];
    expect(deriveForWorkshop(rows, { firstName: "Viola", lastName: "Serra" }, "2026-11-07").status).toBe("valid");
    expect(deriveForWorkshop(rows, { firstName: "Viola", lastName: "Serra" }, "2027-03-07").status).toBe("valid");
  });
});

describe("omonimi: non confermare quote ufficiali con email diverse", () => {
  it("il pagamento sul libro con indirizzo diverso non valida l'omonimo del modulo", () => {
    const rows: MembershipEvidenceRow[] = [
      evidence({ source: "google_sheet", email: "altra@example.test" }),
      evidence({ source: "official_members_book", email: "viola@example.test" }),
    ];
    expect(deriveForWorkshop(rows, { email: "altra@example.test", firstName: "Viola", lastName: "Serra" }, "2026-11-07").status).toBe("payment_missing");
    expect(deriveForWorkshop(rows, { email: "viola@example.test", firstName: "Viola", lastName: "Serra" }, "2026-11-07").status).toBe("valid");
  });
});
