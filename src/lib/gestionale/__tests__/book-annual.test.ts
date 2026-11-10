import { describe, expect, it } from "vitest";

import { validateMembersBook } from "@/lib/association/book-upload";
import { normalizeOfficialMembersBookRows } from "@/lib/google/members-book";
import { getDefaultMembershipExpiryDate } from "@/lib/association/membership";

const headers = [
  "Data richiesta", "Data accettazione", "Data cessazione", "Nome", "Cognome",
  "", "", "", "", "", "Anno Sociale 2026", "", "Anno Sociale 2027", "",
];
const subheaders = [
  "", "", "", "", "", "", "", "", "", "", "Quota soci", "N. tessera",
  "Quota soci", "N. tessera",
];
const rows = [
  headers, subheaders,
  ["01/10/2025", "01/10/2025", "", "Viola", "Serra", "", "", "", "", "", 15, "12", 15, "23"],
  ["01/10/2025", "01/10/2025", "", "Marco", "Rossi", "", "", "", "", "", 15, "13", 0, ""],
];

describe("Libro Soci Team Artist per annualità", () => {
  it("accetta l'annualità 2027 anche se la colonna quota non è più K", () => {
    expect(() => validateMembersBook(rows, 2027)).not.toThrow();
    expect(() => validateMembersBook(rows, 2028)).toThrow(/2028/);
  });

  it("mantiene separata la prova 2025/26 dalla quota 2027", () => {
    const previous = normalizeOfficialMembersBookRows(rows, 2026);
    const current = normalizeOfficialMembersBookRows(rows, 2027);
    expect(previous.errors).toEqual([]);
    expect(current.errors).toEqual([]);
    expect(previous.rows[0]).toMatchObject({
      source_row_id: "3", membership_status: "verified",
      membership_starts_at: "2025-09-01", membership_expires_at: "2026-12-31",
    });
    expect(current.rows[0]).toMatchObject({
      source_row_id: "2027:3", membership_status: "verified",
      membership_starts_at: "2027-01-01", membership_expires_at: "2027-12-31",
    });
    expect(current.rows[1].membership_status).toBe("expired");
    expect(previous.rows[1].membership_status).toBe("verified");
  });

  it("applica correttamente le scadenze anche alla copia del modulo", () => {
    expect(getDefaultMembershipExpiryDate("2025-09-01")).toBe("2026-12-31");
    expect(getDefaultMembershipExpiryDate("2026-11-07")).toBe("2027-12-31");
    expect(getDefaultMembershipExpiryDate("2027-03-07")).toBe("2027-12-31");
  });
});
