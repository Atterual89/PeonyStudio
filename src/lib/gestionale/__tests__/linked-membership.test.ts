// Fase C: stato socio dalle prove collegate. Stessi casi di membership-rule e
// membership-september-rule, senza confronto di nomi o email. Dati inventati.

import { describe, expect, it } from "vitest";

import { countDots, eventDot, linkedMembershipState, periodUntilFrom, type LinkedEvidence } from "@/lib/gestionale/linked-membership";

const form: LinkedEvidence = { kind: "form" };
const manual = (startsAt: string, expiresAt: string, verified = true): LinkedEvidence =>
  ({ kind: "fee", startsAt, expiresAt, verified, method: "manual" });
const email = (periodFrom: string): LinkedEvidence =>
  ({ kind: "fee", startsAt: periodFrom, expiresAt: periodUntilFrom(periodFrom), verified: true, method: "payment_email" });

describe("linkedMembershipState — modulo e quota indipendenti", () => {
  it("senza modulo né quota: modulo mancante", () => {
    expect(linkedMembershipState([], "2026-11-20")).toMatchObject({ status: "missing_form", formPresent: false, feePaid: false });
  });
  it("il modulo prova solo la registrazione", () => {
    expect(linkedMembershipState([form], "2026-11-20")).toMatchObject({ status: "payment_missing", formPresent: true });
  });
  it("quota senza modulo: resta modulo mancante, ma la quota risulta pagata", () => {
    expect(linkedMembershipState([manual("2026-10-01", "2027-12-31")], "2026-11-20"))
      .toMatchObject({ status: "missing_form", feePaid: true });
  });
  it("modulo e quota manuale verificata: in regola", () => {
    expect(linkedMembershipState([form, manual("2026-02-10", "2026-12-31")], "2026-11-20"))
      .toEqual({ status: "valid", formPresent: true, feePaid: true, expiresAt: "2026-12-31", method: "manual" });
  });
  it("a parità di scadenza la quota email prevale sul manuale", () => {
    expect(linkedMembershipState([form, manual("2025-10-01", "2026-12-31"), email("2025-09-01")], "2026-11-20").method)
      .toBe("payment_email");
  });
  it("una quota revocata non conta", () => {
    expect(linkedMembershipState([form, manual("2026-02-10", "2026-12-31", false)], "2026-11-20").status).toBe("payment_missing");
  });
  it("la quota 2025/26 non vale per un evento del 2027", () => {
    expect(linkedMembershipState([form, email("2025-09-01")], "2027-03-14").status).toBe("payment_missing");
  });
  it("prima del primo anno associativo nessuna quota conta", () => {
    expect(linkedMembershipState([form, manual("2025-06-01", "2026-12-31")], "2025-07-01").status).toBe("payment_missing");
  });
});

describe("linkedMembershipState — regola del 1 settembre", () => {
  it("un versamento di giugno 2026 non copre eventi del 2027", () => {
    expect(linkedMembershipState([form, manual("2026-06-15", "2026-12-31")], "2027-02-01").status).toBe("payment_missing");
  });
  it("un versamento del 1 settembre 2026 copre novembre 2026 e tutto il 2027", () => {
    const fee = manual("2026-09-01", "2027-12-31");
    expect(linkedMembershipState([form, fee], "2026-11-20").status).toBe("valid");
    expect(linkedMembershipState([form, fee], "2027-12-31").status).toBe("valid");
    expect(linkedMembershipState([form, fee], "2028-01-01").status).toBe("payment_missing");
  });
  it("con quota 2026 e rinnovo 2027 mostra la scadenza più lunga", () => {
    expect(linkedMembershipState([form, manual("2026-02-10", "2026-12-31"), manual("2026-09-20", "2027-12-31")], "2026-11-20").expiresAt)
      .toBe("2027-12-31");
  });
  it("una quota non ancora versata alla data dell'evento non conta", () => {
    expect(linkedMembershipState([form, manual("2026-12-01", "2027-12-31")], "2026-11-20").status).toBe("payment_missing");
  });
  it("periodo delle quote email", () => {
    expect(periodUntilFrom("2025-09-01")).toBe("2026-12-31");
    expect(periodUntilFrom("2026-09-01")).toBe("2027-12-31");
  });
});

describe("eventDot", () => {
  const valid = linkedMembershipState([form, email("2025-09-01")], "2026-11-20");
  it("verde, rosso e giallo con il motivo", () => {
    expect(eventDot({ link: "collegata", hasIdentity: true, state: valid, eventDate: "2026-11-20" }))
      .toEqual({ color: "verde", reason: "In regola · fino al 31 dic 2026", expiresAt: "2026-12-31" });
    expect(eventDot({ link: "collegata", hasIdentity: true, state: linkedMembershipState([form], "2026-11-20"), eventDate: "2026-11-20" }))
      .toMatchObject({ color: "rosso", reason: "Non in regola · quota 2026 mancante" });
    expect(eventDot({ link: "collegata", hasIdentity: true, state: linkedMembershipState([], "2026-11-20"), eventDate: "2026-11-20" }))
      .toMatchObject({ color: "rosso", reason: "Non in regola · nessun modulo" });
    expect(eventDot({ link: "da_confermare", note: "più persone possibili", hasIdentity: true, state: null, eventDate: "2026-11-20" }))
      .toMatchObject({ color: "giallo", reason: "Da chiarire: più persone possibili" });
    expect(eventDot({ link: "assente", hasIdentity: false, state: null, eventDate: "2026-11-20" }).color).toBe("giallo");
  });
  it("solo nickname e nessun modulo collegato: giallo, non rosso", () => {
    expect(eventDot({ link: "collegata", hasIdentity: false, state: linkedMembershipState([], "2026-11-20"), eventDate: "2026-11-20" }))
      .toMatchObject({ color: "giallo", reason: "Solo nickname: mancano email o nome e cognome" });
  });
  it("solo nickname ma con modulo collegato: si valuta normalmente", () => {
    expect(eventDot({ link: "collegata", hasIdentity: false, state: valid, eventDate: "2026-11-20" }).color).toBe("verde");
  });
  it("conteggi", () => {
    expect(countDots([
      { color: "verde", reason: "", expiresAt: null }, { color: "giallo", reason: "", expiresAt: null },
      { color: "giallo", reason: "", expiresAt: null },
    ])).toEqual({ verde: 1, rosso: 0, giallo: 2 });
  });
});
