import { describe, expect, it } from "vitest";

import { BOOKING_FILTERS, bookingTitle, matchesBookingFilter, membershipSummary, personNames } from "../bookings";
import type { BookingPersonView, BookingStatus, BookingView, MembershipBadge } from "../types";

// Dati inventati.
function entry(name: string, isPrimary: boolean, membership: MembershipBadge["kind"], email: string | null = `${name}@example.test`): BookingPersonView {
  const badge: MembershipBadge =
    membership === "in_regola"
      ? { kind: "in_regola", expiresAt: "2026-12-31", match: "email" }
      : membership === "modulo_mancante"
          ? { kind: "modulo_mancante" }
          : membership === "non_collegata"
            ? { kind: "non_collegata" }
            : { kind: "quota_mancante", paymentsFrom: "2025-09-01" };
  return {
    participantId: `bp-${name}`,
    isPrimary,
    enteredAs: null,
    enteredEmail: null,
    matchStatus: "confermato",
    possibleDuplicate: null,
    member: null,
    displayName: name,
    fullName: null,
    membership: badge,
    contacts: [],
    person: {
      id: `p-${name}`,
      first_name: name,
      last_name: null,
      nickname: null,
      email,
      instagram: null,
      phone: null,
      teamartist_id: null,
      notes: null,
      association_member_id: null,
      membership_email: null,
      merged_into: null,
      version: 1,
      created_at: "",
      updated_at: "",
    },
  };
}

function booking(id: string, status: BookingStatus, people: BookingPersonView[]): BookingView {
  return { bookingId: id, version: 1, status, present: false, notes: null, agreedFeeCents: null, feeCustom: false, payments: [], createdBy: null, people, formerPartners: [] };
}

const couple = booking("b-1", "acconto", [entry("Francesco", false, "quota_mancante", null), entry("Claudia", true, "in_regola")]);
const single = booking("b-2", "prenotato", [entry("Nebbia", true, "modulo_mancante")]);
const waiting = booking("b-3", "lista_attesa", [entry("Salice", true, "quota_mancante")]);
const interested = booking("b-4", "interessato", [entry("Ramo", true, "in_regola")]);

describe("D15 — tab Partecipanti per prenotazione", () => {
  it("una riga per coppia, con il principale per primo", () => {
    expect(bookingTitle(couple)).toBe("Claudia + Francesco");
  });

  it("riepilogo soci per persona sui confermati: la coppia conta 2", () => {
    expect(membershipSummary([couple, single, waiting, interested])).toEqual({
      persone: 3,
      soci: 1,
      quotaMancante: 1,
      nonSoci: 1,
      nonCollegati: 0,
      emailMancanti: 1,
    });
  });

  it("filtri: confermati = prenotato + acconto + saldato; quota non registrata / non in regola per persona", () => {
    const all = [couple, single, waiting, interested];
    const ids = (filter: Parameters<typeof matchesBookingFilter>[1]) =>
      all.filter((b) => matchesBookingFilter(b, filter)).map((b) => b.bookingId);

    expect(ids("confermati")).toEqual(["b-1", "b-2"]);
    expect(ids("interessati")).toEqual(["b-4"]);
    expect(ids("lista_attesa")).toEqual(["b-3"]);
    expect(ids("quota_mancante")).toEqual(["b-1"]);
    expect(ids("non_soci")).toEqual(["b-1", "b-2"]);
  });
});

describe("017 — filtro 'Non collegate'", () => {
  it("prenotazioni di qualunque stato con almeno una persona non collegata; niente filtri sull'abbinamento", () => {
    const auto = booking("b-5", "cancellato", [{ ...entry("Vischio", true, "in_regola"), matchStatus: "automatico", enteredAs: "vischio" }]);
    const notLinked = booking("b-6", "interessato", [
      entry("Ortica", true, "in_regola"),
      { ...entry("Cardo", false, "non_collegata", null), matchStatus: "da_abbinare", enteredAs: "Cardo" },
    ]);
    const all = [couple, auto, notLinked];
    expect(all.filter((b) => matchesBookingFilter(b, "non_collegati")).map((b) => b.bookingId)).toEqual(["b-6"]);
    expect(BOOKING_FILTERS.map((f) => f.key)).not.toContain("automatico");
    expect(BOOKING_FILTERS.map((f) => f.label)).toContain("Non collegate");
    expect(membershipSummary([notLinked])).toMatchObject({ nonCollegati: 0 });
    expect(membershipSummary([{ ...notLinked, status: "prenotato" }])).toMatchObject({ nonCollegati: 1 });
  });
});

describe("nome nel tab Partecipanti (admin)", () => {
  it("Nome Cognome come nome principale, nickname o testo di Ale piccolo accanto; senza nome completo come prima", () => {
    const base = entry("Nebbia", true, "in_regola");
    const full = { ...base, fullName: "Nora Bianchi", enteredAs: "Nebbia", person: { ...base.person, nickname: "Nebbia" } };
    expect(personNames(full)).toEqual({ main: "Nora Bianchi", alias: "Nebbia" });
    expect(personNames(base)).toEqual({ main: "Nebbia", alias: null });
    expect(bookingTitle({ ...single, people: [full] })).toBe("Nora Bianchi");
  });
});
