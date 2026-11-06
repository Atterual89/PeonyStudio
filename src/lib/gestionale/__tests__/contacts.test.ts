// 4d, parte B: richieste di associazione, logica pura (etichette, gruppi,
// filtri, Ccn di Gmail). Dati inventati.

import { describe, expect, it } from "vitest";

import { matchesBookingFilter } from "../bookings";
import { bccList, contactGroupOf, contactLabel, contactShortLabel, isRequestGroup, nextContactLabel, peopleInGroup } from "../contacts";
import type { BookingPersonView, BookingStatus, BookingView, MembershipBadge, MembershipContact } from "../types";

const contact = (number: number, sentOn: string): MembershipContact => ({
  id: `c-${number}`,
  periodKey: "2025-09-01",
  kind: number === 0 ? "richiesta" : "sollecito",
  number,
  sentOn,
  note: null,
});

function entry(id: string, badge: MembershipBadge, contacts: MembershipContact[] = [], email: string | null = `${id}@example.test`): BookingPersonView {
  return {
    participantId: `bp-${id}-${Math.random()}`,
    isPrimary: true,
    enteredAs: null,
    enteredEmail: null,
    matchStatus: "confermato",
    possibleDuplicate: null,
    member: null,
    displayName: id,
    fullName: null,
    membership: badge,
    contacts,
    person: {
      id,
      first_name: id,
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

const booking = (id: string, status: BookingStatus, people: BookingPersonView[]): BookingView => ({
  bookingId: id,
  version: 1,
  present: false,
  status,
  notes: null,
  agreedFeeCents: null,
  feeCustom: false,
  payments: [],
  createdBy: null,
  people,
  formerPartners: [],
});

const OK: MembershipBadge = { kind: "in_regola", expiresAt: "2026-12-31", match: "email" };
const MISSING: MembershipBadge = { kind: "quota_mancante", paymentsFrom: "2025-09-01" };

describe("etichette", () => {
  it("richiesta e solleciti; pulsante del passo successivo = massimo valido + 1", () => {
    expect(contactLabel(contact(0, "2026-10-12"))).toBe("Richiesta inviata il 12 ott");
    expect(contactLabel(contact(1, "2026-10-20"))).toBe("Sollecito 1 il 20 ott");
    expect(contactShortLabel(contact(2, "2026-10-25"))).toBe("sollecito 2 · 25 ott");
    expect(nextContactLabel([])).toBe("Registra richiesta inviata");
    expect(nextContactLabel([contact(0, "2026-10-12")])).toBe("Registra sollecito 1");
    // Dopo l'eliminazione del sollecito 1: il successivo è 3.
    expect(nextContactLabel([contact(0, "2026-10-12"), contact(2, "2026-10-25")])).toBe("Registra sollecito 3");
  });
});

describe("gruppi e filtri del tab Partecipanti", () => {
  const nuova = entry("nuova", MISSING);
  const sollecitata = entry("sollecitata", MISSING, [contact(0, "2026-10-12")]);
  // D26: non collegata al libro soci (anche con un contatto vecchio) → da verificare.
  const scollegata = entry("scollegata", { kind: "non_collegata" }, [contact(0, "2026-10-12")]);
  const inRegola = entry("inregola", OK, [contact(0, "2026-10-01")]);
  const senzaEmail = entry("senzaemail", { kind: "modulo_mancante" }, [], null);
  // La stessa persona in due prenotazioni (es. dopo un cambio): conta una volta.
  const bookings = [
    booking("b1", "acconto", [nuova, sollecitata]),
    booking("b2", "prenotato", [inRegola, { ...nuova, participantId: "altro" }]),
    booking("b3", "saldato", [senzaEmail]),
    booking("b4", "interessato", [entry("interessata", MISSING)]),
    booking("b5", "prenotato", [scollegata]),
  ];

  it("da contattare = non in regola senza contatti; in attesa = almeno un contatto; in regola: nessuno dei due", () => {
    expect(contactGroupOf(nuova)).toBe("da_contattare");
    expect(contactGroupOf(sollecitata)).toBe("richiesta_inviata");
    expect(contactGroupOf(inRegola)).toBeNull();
    expect(peopleInGroup(bookings, "da_contattare").map((e) => e.person.id)).toEqual(["nuova", "senzaemail"]);
    expect(peopleInGroup(bookings, "richiesta_inviata").map((e) => e.person.id)).toEqual(["sollecitata"]);
    expect(bookings.filter((b) => matchesBookingFilter(b, "da_contattare")).map((b) => b.bookingId)).toEqual(["b1", "b2", "b3"]);
    expect(bookings.filter((b) => matchesBookingFilter(b, "richiesta_inviata")).map((b) => b.bookingId)).toEqual(["b1"]);
  });

  it("4e (D26): le non collegate vanno in 'Da verificare nel libro soci', senza richieste; 'includi interessati'", () => {
    expect(contactGroupOf(scollegata)).toBe("da_verificare");
    expect(isRequestGroup("da_verificare")).toBe(false);
    expect(isRequestGroup("da_contattare") && isRequestGroup("richiesta_inviata")).toBe(true);
    expect(peopleInGroup(bookings, "da_verificare").map((e) => e.person.id)).toEqual(["scollegata"]);
    expect(peopleInGroup(bookings, "da_contattare").map((e) => e.person.id)).not.toContain("scollegata");
    expect(peopleInGroup(bookings, "da_contattare", { includeInterested: true }).map((e) => e.person.id)).toEqual(["nuova", "senzaemail", "interessata"]);
    expect(bookings.filter((b) => matchesBookingFilter(b, "da_contattare", { includeInterested: true })).map((b) => b.bookingId)).toEqual(["b1", "b2", "b3", "b4"]);
  });

  it("Ccn di Gmail: virgole, senza doppioni (maiuscole comprese), elenco di chi non ha email", () => {
    const twin = entry("gemella", MISSING, [], "NUOVA@example.test");
    const list = bccList([...peopleInGroup(bookings, "da_contattare"), twin]);
    expect(list.text).toBe("nuova@example.test");
    expect(list.withEmail.map((e) => e.person.id)).toEqual(["nuova", "gemella"]);
    expect(list.withoutEmail.map((e) => e.person.id)).toEqual(["senzaemail"]);
  });
});
