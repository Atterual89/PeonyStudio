// "Completa con i dati del libro soci" (scheda, riga Partecipanti, pagina
// Persone): le azioni leggono il socio dal server e riempiono solo i campi
// vuoti; il caricamento della lista non scrive niente. Dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberSummary, Person } from "../types";

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/gestionale/server/auth", () => ({ requireAdmin: async () => ({ id: "op", role: "admin" }) }));

const P1 = "00000000-0000-4000-8000-000000000101";
const P2 = "00000000-0000-4000-8000-000000000102";
const P3 = "00000000-0000-4000-8000-000000000103";

function person(id: string, fields: Partial<Person>): Person {
  return {
    id,
    first_name: null,
    last_name: null,
    nickname: null,
    email: null,
    instagram: null,
    phone: null,
    teamartist_id: null,
    notes: null,
    association_member_id: null,
    membership_email: null,
    merged_into: null,
    version: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...fields,
  };
}

const people = [
  // Solo nickname, collegata per email al libro soci.
  person(P1, { nickname: "kriko", membership_email: "quentin@example.test" }),
  // Tutto pieno: niente da completare.
  person(P2, { first_name: "Olmo", last_name: "Rami", email: "olmo@example.test", membership_email: "olmo@example.test" }),
  // Non collegata.
  person(P3, { nickname: "solo" }),
];
const members: Record<string, MemberSummary> = {
  "quentin@example.test": { id: "e:quentin@example.test", first_name: "Quentin", last_name: "Brunoir", email: "quentin@example.test", expires_at: null, source: "libro", name_split: true },
  "olmo@example.test": { id: "e:olmo@example.test", first_name: "Olmo", last_name: "Ramo", email: "olmo@example.test", expires_at: null, source: "libro", name_split: true },
};

const rpc = vi.fn(async () => ({ data: true, error: null }));
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ rpc }) }));
vi.mock("@/lib/gestionale/server/data", () => ({
  loadPeople: async () => people,
  getPerson: async (id: string) => people.find((p) => p.id === id) ?? null,
}));
vi.mock("@/lib/gestionale/server/membership", () => ({
  getLinkedMemberSummary: async (p: Person) => (p.membership_email ? members[p.membership_email] : null),
}));

beforeEach(() => rpc.mockClear());

describe("completa dal libro soci", () => {
  it("la lista per la pagina Persone non scrive niente", async () => {
    const { listCompletablePeople } = await import("../server/member-fill");
    const list = await listCompletablePeople();
    expect(list.map((entry) => [entry.person.id, entry.fill])).toEqual([
      [P1, { first_name: "Quentin", last_name: "Brunoir", email: "quentin@example.test" }],
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("scheda: solo i campi vuoti, valori letti dal server", async () => {
    const { completeFromMemberAction } = await import("@/app/gestione/(app)/p/actions");
    expect(await completeFromMemberAction({ personId: P1 })).toEqual({ ok: true, data: { filled: true } });
    expect(rpc).toHaveBeenCalledWith("gw_fill_person_fields", {
      p_operator_id: "op",
      p_person_id: P1,
      p_first_name: "Quentin",
      p_last_name: "Brunoir",
      p_email: "quentin@example.test",
    });
    rpc.mockClear();
    expect(await completeFromMemberAction({ personId: P2 })).toEqual({ ok: true, data: { filled: false } });
    expect(await completeFromMemberAction({ personId: P3 })).toEqual({ ok: true, data: { filled: false } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("'usa questo': sostituisce solo quel campo con il valore del socio", async () => {
    const { applyMemberValueAction } = await import("@/app/gestione/(app)/p/actions");
    expect(await applyMemberValueAction({ personId: P2, version: 1, field: "last_name" })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("gw_update_person", expect.objectContaining({
      p_id: P2,
      p_version: 1,
      p_data: expect.objectContaining({ first_name: "Olmo", last_name: "Ramo", email: "olmo@example.test" }),
    }));
    expect(await applyMemberValueAction({ personId: P3, version: 1, field: "email" })).toMatchObject({ ok: false });
  });

  it("pagina Persone: tutte le persone completabili", async () => {
    const { completeAllFromMemberAction } = await import("@/app/gestione/(app)/p/actions");
    expect(await completeAllFromMemberAction()).toEqual({ ok: true, data: { updated: 1, failed: 0 } });
    expect((rpc.mock.calls as unknown as [string, { p_person_id: string }][]).map(([name, args]) => [name, args.p_person_id])).toEqual([
      ["gw_fill_person_fields", P1],
    ]);
  });
});
