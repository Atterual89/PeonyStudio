// 4d, parte B: azioni delle richieste di associazione. Solo admin (Ale: 404,
// nessuna scrittura); periodo dal workshop, quindi due workshop dello stesso
// periodo condividono lo storico; "Segna come inviata a tutti" ricalcola il
// gruppo sul server. Dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingView, MembershipBadge } from "../types";

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
let role: "admin" | "organizzatrice" = "admin";
let badge: MembershipBadge = { kind: "quota_mancante", paymentsFrom: "2025-09-01" };
let bookings: BookingView[] = [];

type Mocked<T> = (...args: unknown[]) => Promise<T>;
const addOne = vi.fn<Mocked<{ ok: true; data: { id: string; kind: string; number: number } }>>(async () => ({
  ok: true,
  data: { id: "c1", kind: "richiesta", number: 0 },
}));
const addMany = vi.fn<Mocked<{ ok: true; data: number }>>(async () => ({ ok: true, data: 1 }));
const remove = vi.fn<Mocked<{ ok: true; data: null }>>(async () => ({ ok: true, data: null }));
const restore = vi.fn<Mocked<{ ok: true; data: null }>>(async () => ({ ok: true, data: null }));

const P = "00000000-0000-4000-8000-0000000000d1";
const Q = "00000000-0000-4000-8000-0000000000d2";
const W_MARCH = "00000000-0000-4000-8000-0000000000e1";
const W_NOV = "00000000-0000-4000-8000-0000000000e2";
const W_2027 = "00000000-0000-4000-8000-0000000000e3";
const STARTS: Record<string, string> = { [W_MARCH]: "2026-03-14", [W_NOV]: "2026-11-14", [W_2027]: "2027-02-06" };

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/gestionale/server/auth", () => {
  const check = async () => {
    if (role !== "admin") throw new Error(NOT_FOUND);
    return { id: "op-admin", role };
  };
  return { requireAdmin: check, requireOperator: async () => ({ id: "op", role }) };
});
vi.mock("@/lib/gestionale/server/data", () => ({
  getPerson: async (id: string) => ({ id, merged_into: null }),
  getWorkshopView: async (id: string) => (STARTS[id] ? { id, startsOn: STARTS[id] } : null),
  getWorkshopBookings: async () => bookings,
}));
vi.mock("@/lib/gestionale/server/membership", () => ({
  getMembershipBadges: async (people: { id: string }[]) => new Map(people.map((p) => [p.id, badge])),
}));
vi.mock("@/lib/gestionale/server/mutations", () => ({
  addMembershipContact: (...args: unknown[]) => addOne(...args),
  addMembershipContacts: (...args: unknown[]) => addMany(...args),
  deleteMembershipContact: (...args: unknown[]) => remove(...args),
  restoreMembershipContact: (...args: unknown[]) => restore(...args),
  restoreDeleted: async () => ({ ok: true, data: null }),
}));
vi.mock("@/lib/gestionale/workshops", () => ({ todayInRome: () => "2026-10-29" }));

const actions = await import("@/app/gestione/(app)/w/contact-actions");
const { restoreDeletedAction } = await import("@/app/gestione/(app)/delete-actions");

function person(id: string, email: string | null, contacts = 0) {
  return {
    participantId: `bp-${id}`,
    isPrimary: true,
    enteredAs: null,
    matchStatus: "confermato" as const,
    possibleDuplicate: null,
    member: null,
    displayName: id,
    fullName: null,
    membership: badge,
    contacts: Array.from({ length: contacts }, (_, n) => ({ id: `c${n}`, periodKey: "2025-09-01", kind: "sollecito" as const, number: n, sentOn: "2026-10-01", note: null })),
    person: { id, email } as BookingView["people"][number]["person"],
  };
}

beforeEach(() => {
  role = "admin";
  badge = { kind: "quota_mancante", paymentsFrom: "2025-09-01" };
  bookings = [];
  for (const mock of [addOne, addMany, remove, restore]) mock.mockClear();
});

describe("richieste di associazione", () => {
  it("Ale: 404 su tutto, nessuna scrittura", async () => {
    role = "organizzatrice";
    await expect(actions.addContactAction({ personId: P, workshopId: W_NOV, sentOn: "2026-10-12", note: "" })).rejects.toThrow(NOT_FOUND);
    await expect(actions.markGroupSentAction({ workshopId: W_NOV, group: "da_contattare", personIds: [P] })).rejects.toThrow(NOT_FOUND);
    await expect(actions.deleteContactAction({ id: P })).rejects.toThrow(NOT_FOUND);
    await expect(restoreDeletedAction({ entity: "membership_contact", id: P })).rejects.toThrow(NOT_FOUND);
    for (const mock of [addOne, addMany, remove, restore]) expect(mock).not.toHaveBeenCalled();
  });

  it("periodo dal workshop: due workshop dello stesso periodo → stesso storico; il 2027 è un altro periodo", async () => {
    await actions.addContactAction({ personId: P, workshopId: W_MARCH, sentOn: "2026-10-12", note: "  via Gmail " });
    await actions.addContactAction({ personId: P, workshopId: W_NOV, sentOn: "2026-10-20", note: "" });
    await actions.addContactAction({ personId: P, workshopId: W_2027, sentOn: "2026-10-21", note: "" });
    expect(addOne.mock.calls.map((call) => call.slice(1))).toEqual([
      [P, "2025-09-01", "2026-10-12", "via Gmail"],
      [P, "2025-09-01", "2026-10-20", null],
      [P, "2026-09-01", "2026-10-21", null],
    ]);
  });

  it("niente date nel futuro né persone già in regola", async () => {
    expect(await actions.addContactAction({ personId: P, workshopId: W_NOV, sentOn: "2026-11-02", note: "" })).toEqual({
      ok: false,
      error: "La data non può essere nel futuro.",
    });
    badge = { kind: "in_regola", expiresAt: "2026-12-31", match: "email" };
    expect((await actions.addContactAction({ personId: P, workshopId: W_NOV, sentOn: "2026-10-12", note: "" })).ok).toBe(false);
    expect(addOne).not.toHaveBeenCalled();
  });

  it("segna come inviata a tutti: solo le persone copiate ancora nel gruppo e con email, data di oggi", async () => {
    const STRANGER = "00000000-0000-4000-8000-0000000000d9";
    bookings = [
      { bookingId: "b1", status: "acconto", people: [person(P, "p@example.test"), person(Q, null)] },
      { bookingId: "b2", status: "prenotato", people: [person("00000000-0000-4000-8000-0000000000d3", "s@example.test", 1)] },
    ] as unknown as BookingView[];
    expect(await actions.markGroupSentAction({ workshopId: W_NOV, group: "da_contattare", personIds: [P, Q, STRANGER] })).toEqual({
      ok: true,
      data: { count: 1 },
    });
    expect(addMany).toHaveBeenCalledWith("op-admin", [P], "2025-09-01", "2026-10-29");
  });

  it("4e (#12, D26): solo le persone spuntate; mai per le non collegate; con 'includi interessati' anche gli interessati", async () => {
    const R = "00000000-0000-4000-8000-0000000000d4";
    bookings = [
      { bookingId: "b1", status: "acconto", people: [person(P, "p@example.test"), person(Q, "q@example.test")] },
      { bookingId: "b2", status: "interessato", people: [person(R, "r@example.test")] },
    ] as unknown as BookingView[];
    await actions.markGroupSentAction({ workshopId: W_NOV, group: "da_contattare", personIds: [Q] });
    expect(addMany).toHaveBeenLastCalledWith("op-admin", [Q], "2025-09-01", "2026-10-29");
    expect((await actions.markGroupSentAction({ workshopId: W_NOV, group: "da_contattare", personIds: [R] })).ok).toBe(false);
    await actions.markGroupSentAction({ workshopId: W_NOV, group: "da_contattare", personIds: [R], includeInterested: true });
    expect(addMany).toHaveBeenLastCalledWith("op-admin", [R], "2025-09-01", "2026-10-29");
    addMany.mockClear();
    expect(await actions.markGroupSentAction({ workshopId: W_NOV, group: "da_verificare", personIds: [P] })).toEqual({
      ok: false,
      error: "Dati non validi. Ricarica la pagina e riprova.",
    });
    expect(addMany).not.toHaveBeenCalled();
  });

  it("elimina e annulla passano dal database (solo chi ha eliminato, entro 10 minuti)", async () => {
    expect(await actions.deleteContactAction({ id: P })).toEqual({ ok: true });
    expect(await restoreDeletedAction({ entity: "membership_contact", id: P })).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith("op-admin", P);
    expect(restore).toHaveBeenCalledWith("op-admin", P);
  });
});
