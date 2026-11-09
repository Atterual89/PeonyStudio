import { describe, expect, it } from "vitest";
import { deriveMembershipState } from "@/lib/association/membership-state";
import { identityForLinkedPeonyAttendee } from "../peony-linked-identity";

const official = {
  id: "official-1",
  first_name: "Christian",
  last_name: "Martelli",
  email: null,
  source: "official_members_book",
  membership_status: "verified",
  membership_starts_at: "2025-09-01",
  membership_expires_at: "2026-12-31",
};
const period = { paymentsFrom: "2025-09-01", paymentsUntil: "2026-12-31", referenceDate: "2026-11-11" };

describe("stato associativo da identità collegata ai biglietti Peony", () => {
  it("usa il nome ufficiale collegato, non il nickname mostrato sul biglietto", () => {
    const linked = {
      first_name: "Gesù", last_name: "Christian", email: null,
      membership_name_key: "christian martelli", membership_email: null, association_member_id: null,
    };
    const identity = identityForLinkedPeonyAttendee([official], linked, null,
      { email: null, firstName: "Gesù", lastName: "Christian" });
    expect(identity.firstName).toBe("christian martelli");
    expect(deriveMembershipState([official], identity, period).status).toBe("valid");
  });

  it("il collegamento al libro già verificato prevale sul nome differente del biglietto", () => {
    const identity = identityForLinkedPeonyAttendee([official], null, official.id,
      { firstName: "Alias", lastName: "Diverso" });
    expect(deriveMembershipState([official], identity, period).verifiedInOfficialBook).toBe(true);
  });

  it("una quota manuale senza modulo non diventa verde solo perche' e' stata collegata", () => {
    const manual = {
      id: "manual-1", first_name: "Franceska", last_name: "Cela", email: "franceska@example.test",
      source: "manual_override", membership_status: "verified",
      membership_starts_at: "2025-09-01", membership_expires_at: "2026-12-31",
    };
    const identity = identityForLinkedPeonyAttendee([manual], null, manual.id,
      { firstName: "Nickname", lastName: "Caso" });
    expect(deriveMembershipState([manual], identity, period)).toMatchObject({
      status: "missing_form", currentYearPaid: true, formPresent: false,
    });
  });

  it("senza abbinamento mantiene l'identità scritta su Ticket Tailor", () => {
    const fallback = { firstName: "Lina", lastName: "Bianchi", email: "lina@example.test" };
    expect(identityForLinkedPeonyAttendee([], null, null, fallback)).toEqual(fallback);
  });
});
