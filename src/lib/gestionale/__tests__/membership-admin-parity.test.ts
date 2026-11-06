// La pagina admin chiama deriveMembershipState senza opzioni: deve dare
// esattamente gli stessi risultati di prima delle opzioni del gestionale.
// Confronto con la copia invariata della versione precedente su tutte le
// combinazioni di righe e identità qui sotto. Dati inventati.

import { describe, expect, it } from "vitest";

import { membershipPeriodFor } from "@/lib/association/membership-periods";
import {
  CURRENT_MEMBERSHIP_EXPIRY,
  CURRENT_MEMBERSHIP_START,
  deriveMembershipState,
  type MembershipEvidenceRow,
} from "@/lib/association/membership-state";

import {
  CURRENT_MEMBERSHIP_EXPIRY as EXPIRY_BEFORE,
  CURRENT_MEMBERSHIP_START as START_BEFORE,
  deriveMembershipState as deriveBefore,
} from "./fixtures/membership-state-before";

const CURRENT_BEFORE = { start: START_BEFORE, expiry: EXPIRY_BEFORE };

const SOURCES = ["google_sheet", "official_members_book", "manual_override", null] as const;
const STATUSES = ["verified", "expired", null] as const;
const STARTS = ["2024-10-01", "2025-08-31", "2025-09-01", "2026-03-15", "2026-09-02", null] as const;
const PEOPLE = [
  { first_name: "Aurora", last_name: "Neri", email: "aurora.neri@gmail.com" },
  { first_name: "Neri", last_name: "Aurora", email: "AuroraNeri+x@googlemail.com" },
  { first_name: "Aurora", last_name: "Neri", email: null },
  { first_name: "Bruno", last_name: "Sole", email: "bruno@example.test" },
  { first_name: "Bruno", last_name: "Sole", email: "altro.bruno@example.test" },
  { first_name: "Celeste", last_name: null, email: "celeste@example.test" },
];

function row(i: number): MembershipEvidenceRow {
  const person = PEOPLE[i % PEOPLE.length];
  return {
    ...person,
    source: SOURCES[Math.floor(i / 2) % SOURCES.length],
    membership_status: STATUSES[Math.floor(i / 3) % STATUSES.length],
    membership_starts_at: STARTS[Math.floor(i / 5) % STARTS.length],
    membership_expires_at: i % 4 === 0 ? null : "2026-12-31",
  };
}

const ALL_ROWS = Array.from({ length: 72 }, (_, i) => row(i));

const IDENTITIES = [
  {},
  { email: "aurora.neri@gmail.com" },
  { email: "auroraneri@gmail.com", firstName: "Aurora", lastName: "Neri" },
  { firstName: "Aurora", lastName: "Neri" },
  { firstName: "Bruno", lastName: "Sole" },
  { email: "bruno@example.test" },
  { email: "nessuno@example.test", firstName: "Celeste" },
  { email: "  BRUNO@example.test ", firstName: "Sole", lastName: "Bruno" },
];

/** Sottoinsiemi deterministici delle righe (finestre e passi diversi). */
function* rowSets(): Generator<MembershipEvidenceRow[]> {
  yield [];
  yield ALL_ROWS;
  for (let size = 1; size <= 6; size += 1) {
    for (let start = 0; start + size <= ALL_ROWS.length; start += 3) yield ALL_ROWS.slice(start, start + size);
  }
  for (let step = 2; step <= 7; step += 1) yield ALL_ROWS.filter((_, i) => i % step === 0);
}

describe("pagina admin: deriveMembershipState senza opzioni è invariato", () => {
  it("stessi risultati della versione precedente su tutte le combinazioni", () => {
    let cases = 0;
    for (const rows of rowSets()) {
      for (const identity of IDENTITIES) {
        expect(deriveMembershipState(rows, identity)).toEqual(deriveBefore(rows, identity));
        expect(deriveMembershipState(rows, identity, {})).toEqual(deriveBefore(rows, identity));
        cases += 1;
      }
    }
    expect(cases).toBeGreaterThan(500);
  });
});

describe("periodi associativi (membership-periods.ts)", () => {
  it("primo periodo 01/09/2025 – 31/12/2026, poi anno solare", () => {
    expect(membershipPeriodFor("2025-08-31")).toBeNull();
    expect(membershipPeriodFor("2025-09-01")).toEqual({ paymentsFrom: "2025-09-01", validUntil: "2026-12-31" });
    expect(membershipPeriodFor("2026-11-14")).toEqual({ paymentsFrom: "2025-09-01", validUntil: "2026-12-31" });
    expect(membershipPeriodFor("2027-01-01")).toEqual({ paymentsFrom: "2027-01-01", validUntil: "2027-12-31" });
    expect(membershipPeriodFor("2028-06-30")).toEqual({ paymentsFrom: "2028-01-01", validUntil: "2028-12-31" });
  });

  it("la pagina admin usa il primo periodo, come prima", () => {
    expect(CURRENT_MEMBERSHIP_START).toBe("2025-09-01");
    expect(CURRENT_MEMBERSHIP_EXPIRY).toBe("2026-12-31");
    expect(CURRENT_MEMBERSHIP_START).toBe(CURRENT_BEFORE.start);
    expect(CURRENT_MEMBERSHIP_EXPIRY).toBe(CURRENT_BEFORE.expiry);
  });

  it("finestra di pagamento: inizio pagamenti e fine validità del periodo", () => {
    const rows: MembershipEvidenceRow[] = [
      { first_name: "Dafne", last_name: "Rio", email: "dafne@example.test", source: "official_members_book", membership_status: "verified", membership_starts_at: "2027-01-05", membership_expires_at: "2027-12-31" },
    ];
    const identity = { email: "dafne@example.test" };
    // Pagina admin (default): dal 01/09/2025 in poi, senza limite.
    expect(deriveMembershipState(rows, identity).status).toBe("valid");
    // Workshop 2026: la quota del 2027 non conta.
    expect(deriveMembershipState(rows, identity, { paymentsFrom: "2025-09-01", paymentsUntil: "2026-12-31" }).status).toBe("missing_form");
    // Workshop 2027: conta.
    expect(deriveMembershipState(rows, identity, { paymentsFrom: "2027-01-01", paymentsUntil: "2027-12-31" })).toMatchObject({ status: "valid", paymentMatchMethod: "email" });
  });

  it("per il primo periodo coincide con la pagina admin (righe fino al 31/12/2026)", () => {
    const current = ALL_ROWS.filter((r) => !r.membership_starts_at || r.membership_starts_at <= "2026-12-31");
    for (const identity of IDENTITIES) {
      expect(deriveMembershipState(current, identity, { paymentsFrom: "2025-09-01", paymentsUntil: "2026-12-31" })).toEqual(
        deriveBefore(current, identity),
      );
    }
  });
});
