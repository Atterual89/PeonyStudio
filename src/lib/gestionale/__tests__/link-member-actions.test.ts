// 4d, parte A: "Cerca nel libro soci" → collegare = completare, e la pagina
// si aggiorna subito (revalidate + refresh) dopo ogni azione. Dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Person } from "../types";

const refresh = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh(), revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("@/lib/gestionale/server/auth", () => ({ requireAdmin: async () => ({ id: "op-admin", role: "admin" }) }));

const P = "00000000-0000-4000-8000-0000000000c1";
const person: Person = {
  id: P,
  first_name: "Cladia",
  last_name: "a",
  nickname: null,
  email: null,
  instagram: "@cla",
  phone: null,
  teamartist_id: null,
  notes: "nota",
  association_member_id: null,
  membership_email: null,
  merged_into: null,
  version: 4,
  created_at: "",
  updated_at: "",
};

type Link = { memberId: string | null; email: string | null; firstName: string | null; lastName: string | null };
let link: Link | null = null;
let badges = new Map<string, { kind: string }>();
const updatePerson = vi.fn<(...args: unknown[]) => Promise<{ ok: true; data: number }>>(async () => ({ ok: true, data: 5 }));
const setMembershipLink = vi.fn<(...args: unknown[]) => Promise<{ ok: true; data: number }>>(async () => ({ ok: true, data: 5 }));

vi.mock("@/lib/gestionale/server/data", () => ({
  getPerson: async (id: string) => (id === P ? person : null),
  getEnrolledPersonIds: async () => new Set(),
  getWorkshopView: async () => null,
  loadPeople: async () => [person],
}));
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({}) }));
vi.mock("@/lib/gestionale/server/membership", () => ({
  getMemberLink: async () => link,
  getMemberBadge: async () => ({ kind: "non_collegata" }),
  getMembershipBadges: async () => badges,
  searchMembers: async () => [],
}));
vi.mock("@/lib/gestionale/server/mutations", () => ({
  updatePerson: (...args: unknown[]) => updatePerson(...args),
  setMembershipLink: (...args: unknown[]) => setMembershipLink(...args),
}));

const { linkMemberAction } = await import("@/app/gestione/(app)/w/actions");

beforeEach(() => {
  badges = new Map();
  for (const mock of [refresh, revalidatePath, updatePerson, setMembershipLink]) mock.mockClear();
});

describe("collegare al libro soci", () => {
  it("socio con email: collegamento per email (il database completa i campi vuoti) e pagina aggiornata subito", async () => {
    link = { memberId: null, email: "claudia@example.test", firstName: "Claudia", lastName: "Acutis" };
    expect(await linkMemberAction({ personId: P, version: 4, memberId: "e:claudia@example.test" })).toEqual({ ok: true, data: { warning: null } });
    expect(setMembershipLink).toHaveBeenCalledWith("op-admin", P, 4, link);
    expect(revalidatePath).toHaveBeenCalledWith("/gestione", "layout");
    expect(refresh).toHaveBeenCalled();
  });

  it("socio del libro senza email: prima non si salvava niente; ora la persona prende nome e cognome del socio", async () => {
    link = { memberId: null, email: null, firstName: "Claudia", lastName: "Acutis" };
    expect(await linkMemberAction({ personId: P, version: 4, memberId: "n:acutis claudia" })).toEqual({ ok: true, data: { warning: null } });
    expect(setMembershipLink).not.toHaveBeenCalled();
    expect(updatePerson).toHaveBeenCalledWith("op-admin", P, 4, {
      first_name: "Claudia",
      last_name: "Acutis",
      nickname: null,
      email: null,
      instagram: "@cla",
      phone: null,
      teamartist_id: null,
      notes: "nota",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("4e (#11): se dopo il collegamento lo stato resta 'Non collegata', lo dice (omonimi senza email)", async () => {
    link = { memberId: null, email: null, firstName: "Claudia", lastName: "Acutis" };
    badges = new Map([[P, { kind: "non_collegata" }]]);
    expect(await linkMemberAction({ personId: P, version: 4, memberId: "n:acutis claudia", referenceDate: "2026-11-14" })).toEqual({
      ok: true,
      data: { warning: "Nel libro soci ci sono più persone con questo nome: serve l'email." },
    });
    expect((await linkMemberAction({ personId: P, version: 4, memberId: "n:acutis claudia", referenceDate: "ieri" })).ok).toBe(false);
  });
});
