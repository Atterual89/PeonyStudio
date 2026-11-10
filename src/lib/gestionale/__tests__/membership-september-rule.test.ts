import { describe, expect, it } from "vitest";
import { membershipPeriodFor, membershipPeriodForPayment } from "@/lib/association/membership-periods";
import { deriveForWorkshop } from "@/lib/gestionale/membership-rule";
import type { MembershipEvidenceRow } from "@/lib/association/membership-state";

const person = { email: "socia@example.test", firstName: "Lia", lastName: "Rossi" };
const form: MembershipEvidenceRow = {
  first_name: "Lia", last_name: "Rossi", email: person.email,
  source: "google_sheet", membership_status: "verified",
  membership_starts_at: "2026-06-10", membership_expires_at: "2026-12-31",
};
function paid(startsAt: string, expiresAt: string): MembershipEvidenceRow {
  return {
    first_name: "Lia", last_name: "Rossi", email: person.email,
    source: "manual_override", membership_status: "verified",
    membership_starts_at: startsAt, membership_expires_at: expiresAt,
  };
}

describe("quota associativa dal 1 settembre valida fino al dicembre successivo", () => {
  it("le date di confine attribuiscono la scadenza al versamento", () => {
    const cases = [
      ["2026-01-01", "2026-12-31"],
      ["2026-06-15", "2026-12-31"],
      ["2026-08-31", "2026-12-31"],
      ["2026-09-01", "2027-12-31"],
      ["2026-10-20", "2027-12-31"],
      ["2026-12-31", "2027-12-31"],
      ["2027-01-01", "2027-12-31"],
      ["2027-08-31", "2027-12-31"],
      ["2027-09-01", "2028-12-31"],
    ];
    for (const [paidAt, expiry] of cases) {
      expect(membershipPeriodForPayment(paidAt)?.validUntil, paidAt).toBe(expiry);
    }
  });

  it("un versamento di giugno 2026 non copre eventi del 2027", () => {
    const rows = [form, paid("2025-09-01", "2026-12-31")];
    expect(deriveForWorkshop(rows, person, "2026-11-10").status).toBe("valid");
    expect(deriveForWorkshop(rows, person, "2027-02-19").status).toBe("payment_missing");
  });

  it("un versamento del 1 settembre 2026 copre anche novembre 2026 e tutto il 2027", () => {
    const rows = [form, paid("2026-09-01", "2027-12-31")];
    expect(deriveForWorkshop(rows, person, "2026-08-31").status).toBe("payment_missing");
    expect(deriveForWorkshop(rows, person, "2026-09-01").status).toBe("valid");
    expect(deriveForWorkshop(rows, person, "2026-11-11").status).toBe("valid");
    expect(deriveForWorkshop(rows, person, "2027-12-31").status).toBe("valid");
    expect(deriveForWorkshop(rows, person, "2028-01-01").status).toBe("payment_missing");
  });

  it("la quota di rinnovo non cancella la precedente e viene mostrata la scadenza più lunga", () => {
    const rows = [form, paid("2025-09-01", "2026-12-31"), paid("2026-09-01", "2027-12-31")];
    expect(deriveForWorkshop(rows, person, "2026-11-10").membershipExpiresAt).toBe("2027-12-31");
    expect(deriveForWorkshop(rows, person, "2027-01-10").status).toBe("valid");
  });

  it("le annualità dei workshop e dei pagamenti sono distinte", () => {
    expect(membershipPeriodFor("2026-11-11")?.validUntil).toBe("2026-12-31");
    expect(membershipPeriodForPayment("2026-11-11")?.validUntil).toBe("2027-12-31");
    expect(membershipPeriodFor("2027-02-19")?.paymentsFrom).toBe("2026-09-01");
  });
});
