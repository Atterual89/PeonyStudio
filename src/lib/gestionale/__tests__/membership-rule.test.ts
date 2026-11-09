import { describe, expect, it } from "vitest";
import { deriveMembershipState, type MembershipEvidenceRow } from "@/lib/association/membership-state";
import { deriveForWorkshop, membershipBadge, membershipLabel, memberOutcomeLabel, paymentWindowFor } from "../membership-rule";
import { parseMemberKey, memberKeyOfPerson, memberKeyOfRow } from "../member-key";

const row = (source: string, changes: Partial<MembershipEvidenceRow> = {}): MembershipEvidenceRow => ({
  first_name: "Viola", last_name: "Serra", email: "viola@example.test", source,
  membership_status: "verified", membership_starts_at: "2025-09-01",
  membership_expires_at: "2026-12-31", ...changes,
});
const form = (changes: Partial<MembershipEvidenceRow> = {}) => row("google_sheet", changes);
const manual = (changes: Partial<MembershipEvidenceRow> = {}) => row("manual_override", changes);
const status = (rows: MembershipEvidenceRow[], date = "2026-11-10", linked = true) =>
  membershipBadge({ workshopStartsOn: date, state: deriveForWorkshop(rows,
    {email:"viola@example.test",firstName:"Viola",lastName:"Serra"}, date), linked });

describe("registrazione Google e quota indipendenti", () => {
  it("senza modulo o quota non può essere verificata", () => {
    expect(status([], "2026-11-10")).toMatchObject({kind:"modulo_mancante",quotaPaid:false});
    expect(status([], "2026-11-10",false)).toMatchObject({kind:"non_collegata",quotaPaid:false});
    expect(membershipLabel(status([], "2026-11-10"))).toBe("Modulo non trovato");
  });
  it("un modulo Google prova solo la registrazione", () => {
    expect(status([form()])).toEqual({kind:"quota_mancante",paymentsFrom:"2025-09-01"});
  });
  it("l'export storico non dà né registrazione né quota, anche se contiene 'verified'", () => {
    expect(status([row("official_members_book")])).toMatchObject({kind:"modulo_mancante",quotaPaid:false});
    expect(status([form(), row("official_members_book")])).toMatchObject({kind:"quota_mancante"});
  });
  it("quota manuale senza modulo salvata, ma modulo ancora assente", () => {
    const s = deriveForWorkshop([manual()], {email:"viola@example.test"}, "2026-11-10");
    expect(s).toMatchObject({status:"missing_form",formPresent:false,currentYearPaid:true,paymentMatchMethod:"manual"});
    expect(status([manual()])).toMatchObject({kind:"modulo_mancante",quotaPaid:true,quotaMatch:"manual"});
  });
  it("modulo e quota manuale verificati insieme danno il verde", () => {
    const s = status([form(),manual()]);
    expect(s).toEqual({kind:"in_regola",match:"manual",expiresAt:"2026-12-31"});
  });
  it("modulo e quota da email confermata danno il verde, e la email prevale sul manuale", () => {
    const email = manual({notes_admin:"Quota confermata da email (Qonto 123)"});
    expect(status([form(),manual(),email])).toMatchObject({kind:"in_regola",match:"payment_email"});
  });
  it("la quota del 2025/26 non verifica il rinnovo 2027", () => {
    expect(status([form(),manual()], "2027-02-19")).toEqual({kind:"quota_mancante",paymentsFrom:"2027-01-01"});
    expect(status([form(),manual({membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31"})],
      "2027-02-19")).toEqual({kind:"in_regola",match:"manual",expiresAt:"2027-12-31"});
    expect(paymentWindowFor("2027-02-19").options.paymentsFrom).toBe("2027-01-01");
  });
  it("una quota revocata non è pagata", () => {
    expect(status([form(),manual({membership_status:"revoked"})])).toMatchObject({kind:"quota_mancante"});
  });
  it("le email differenti con stesso nome non trasferiscono quote tra omonimi", () => {
    const rows=[form({email:"altra@example.test"}),form(),manual()];
    expect(deriveForWorkshop(rows,{email:"altra@example.test",firstName:"Viola",lastName:"Serra"},
      "2026-11-10")).toMatchObject({status:"payment_missing",currentYearPaid:false});
  });
  it("ricerca per nominativo consentita se non esiste una email confliggente", () => {
    const rows=[form({email:null}),manual({email:null})];
    expect(deriveForWorkshop(rows,{firstName:"Serra",lastName:"Viola"},"2026-11-10").status).toBe("valid");
  });
  it("etichette di ricerca brevi", () => {
    expect(memberOutcomeLabel({kind:"quota_mancante",paymentsFrom:"2025-09-01"},false)).toBe("Quota non registrata");
  });
});
describe("chiavi e collegamenti manuali", () => {
  it("chiave email e nome per trovare il modulo, senza validare la quota", () => {
    const id="11111111-1111-4111-8111-111111111111";
    expect(memberKeyOfRow({tableId:id,email:"a@test.it",first_name:null,last_name:null})).toBe("m:"+id);
    expect(memberKeyOfRow({tableId:null,email:"Viola.Serra+wk@GoogleMail.com",first_name:null,last_name:null})).toBe("e:violaserra@gmail.com");
    expect(memberKeyOfRow({tableId:null,email:null,first_name:"Serra",last_name:"Viola"})).toBe("n:serra viola");
    expect(parseMemberKey("n:serra viola")).toEqual({kind:"name",nameKey:"serra viola"});
    expect(memberKeyOfPerson({association_member_id:null,membership_email:"viola.serra@gmail.com"})).toBe("e:violaserra@gmail.com");
  });
});
