// 4d, parte B2: email nel testo incollato, avviso doppioni per "+ Nuova
// persona", "collega anche N iscrizioni", email di Ale nelle azioni. Dati
// inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { existingPeopleFor, sameEnteredText } from "../aliases";
import { findEmail, parseRoster } from "../parse-roster";
import type { Person } from "../types";

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
let role: "admin" | "organizzatrice" = "admin";
const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: string; error: null }>>(async () => ({ data: "id", error: null }));
const resolveMatch = vi.fn<(...args: unknown[]) => Promise<{ ok: true; data: number }>>(async () => ({ ok: true, data: 2 }));
const pending = [
  { participantId: "00000000-0000-4000-8000-0000000000f1", bookingId: "00000000-0000-4000-8000-0000000000f2", version: 3, workshopId: "w1" },
  { participantId: "00000000-0000-4000-8000-0000000000f3", bookingId: "00000000-0000-4000-8000-0000000000f4", version: 1, workshopId: "w2" },
];

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/gestionale/server/auth", () => {
  const admin = async () => {
    if (role !== "admin") throw new Error(NOT_FOUND);
    return { id: "op-admin", role };
  };
  const organizer = async () => {
    if (role !== "organizzatrice") throw new Error(NOT_FOUND);
    return { id: "op-ale", role };
  };
  return { requireAdmin: admin, requireOrganizer: organizer, requireOperator: async () => ({ id: "op", role }) };
});
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ rpc }) }));
vi.mock("@/lib/gestionale/server/data", () => ({
  getPerson: async (id: string) => ({ id, merged_into: null }),
  getWorkshopView: async () => null,
  loadPeople: async () => [],
}));
vi.mock("@/lib/gestionale/server/aliases", () => ({
  findPendingEntries: async () => pending,
  loadAliases: async () => [],
}));
vi.mock("@/lib/gestionale/server/mutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gestionale/server/mutations")>()),
  resolveMatch: (...args: unknown[]) => resolveMatch(...args),
}));

const P = "00000000-0000-4000-8000-0000000000c9";
const W = "00000000-0000-4000-8000-0000000000a1";

beforeEach(() => {
  role = "admin";
  rpc.mockClear();
  resolveMatch.mockClear();
});

describe("box di testo: email nella riga", () => {
  it("la prima email dopo il nome va alla persona; in una coppia una per persona, nell'ordine", () => {
    const [single, couple, onlyEmail] = parseRoster(
      ["1. Viola viola@example.test 250€ paypal", "2. Bruno + Iris bruno@example.test, IRIS@example.test 400€", "3. nome@example.test 100€"].join("\n"),
      { standardFeeCents: 50000 },
    );
    expect(single).toMatchObject({ people: ["Viola"], emails: ["viola@example.test"], notes: null });
    expect(single.payments).toHaveLength(1);
    expect(couple).toMatchObject({ people: ["Bruno", "Iris"], emails: ["bruno@example.test", "iris@example.test"] });
    // Un'email al posto del nome è il nome stesso (come prima).
    expect(onlyEmail).toMatchObject({ people: ["nome@example.test"], emails: [null] });
  });

  it("email nelle note dell'iscrizione: la prima trovata", () => {
    expect(findEmail("pagherà a novembre, mail: Dalia.Fiore@Example.test grazie")).toBe("dalia.fiore@example.test");
    expect(findEmail("nessuna")).toBeNull();
  });
});

describe("altri nomi e nuova persona", () => {
  const person = (id: string, fields: Partial<Person>): Person =>
    ({ id, first_name: null, last_name: null, nickname: null, email: null, merged_into: null, ...fields }) as Person;
  const people = [
    person("a", { nickname: "Nebbia" }),
    person("b", { first_name: "Vera", last_name: "Lume" }),
    person("c", { nickname: "Ortica", email: "ortica@example.test" }),
    person("d", { nickname: "Unita", merged_into: "a" }),
  ];

  it("'Esiste già': nickname, altro nome (in tutte le combinazioni), nome e cognome, email; mai le persone unite", () => {
    const aliases = [{ id: "x", personId: "c", alias: "Lupa" }];
    const empty = { nickname: "", first_name: "", last_name: "", email: "", aliases: [] as string[] };
    expect(existingPeopleFor({ ...empty, nickname: "nebbià" }, people, aliases)).toEqual([{ id: "a", name: "Nebbia", reason: "nickname" }]);
    expect(existingPeopleFor({ ...empty, aliases: ["LUPA"] }, people, aliases)).toEqual([{ id: "c", name: "Ortica", reason: "altro nome" }]);
    expect(existingPeopleFor({ ...empty, first_name: "vera", last_name: "lume" }, people, aliases)[0]).toMatchObject({ id: "b", reason: "nome e cognome" });
    expect(existingPeopleFor({ ...empty, email: "ORTICA@example.test" }, people, aliases)[0]).toMatchObject({ id: "c", reason: "email" });
    expect(existingPeopleFor({ ...empty, nickname: "Unita" }, people, aliases)).toEqual([]);
    expect(sameEnteredText("  Brìna  ", "brina")).toBe(true);
  });

  it("'Collega anche N iscrizioni': ognuna con Collega (la sua versione); Ale: 404 su tutto", async () => {
    const actions = await import("@/app/gestione/(app)/p/alias-actions");
    expect(await actions.linkPendingEntriesAction({ personId: P, text: "Brina" })).toEqual({ ok: true, data: { linked: 2, failed: 0 } });
    expect(resolveMatch.mock.calls.map((call) => [call[1], call[2], call[3]])).toEqual([
      [{ bookingId: pending[0].bookingId, version: 3, participantId: pending[0].participantId }, "collega", P],
      [{ bookingId: pending[1].bookingId, version: 1, participantId: pending[1].participantId }, "collega", P],
    ]);

    role = "organizzatrice";
    for (const call of [
      () => actions.addAliasAction({ personId: P, alias: "Brina" }),
      () => actions.deleteAliasAction({ id: P }),
      () => actions.linkPendingEntriesAction({ personId: P, text: "Brina" }),
      () => actions.createPersonAction({ values: { nickname: "Sole" } as never, aliases: [] }),
      () => actions.findExistingPeopleAction({ values: { nickname: "Sole" } as never, aliases: [] }),
    ]) {
      await expect(call()).rejects.toThrow(NOT_FOUND);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("email scritta da Ale (azioni)", () => {
  it("Aggiungi: le email diventano { text, email } (minuscole); formato sbagliato rifiutato", async () => {
    role = "organizzatrice";
    const { addRegistrationAction, setEnteredEmailAction } = await import("@/app/gestione/(app)/w/registration-actions");
    await addRegistrationAction({
      workshopId: W,
      person: "Viola",
      partner: "Bruno",
      personEmail: " Viola@Example.test ",
      partnerEmail: "",
      status: "prenotato",
      fee: null,
      notes: "",
    });
    expect(rpc.mock.calls[0][1].p_entries).toEqual([{ text: "Viola", email: "viola@example.test" }, "Bruno"]);

    rpc.mockClear();
    expect(
      await addRegistrationAction({ workshopId: W, person: "Viola", partner: "", personEmail: "viola@", status: "prenotato", fee: null, notes: "" }),
    ).toEqual({ ok: false, error: "Email: controlla l'indirizzo (es. nome@esempio.it)." });
    expect(await setEnteredEmailAction({ participantId: P, email: "nope" })).toEqual({ ok: false, error: "Email non valida." });
    expect(rpc).not.toHaveBeenCalled();
    await setEnteredEmailAction({ participantId: P, email: "Iris@Example.test" });
    expect(rpc).toHaveBeenCalledWith("gw_set_entered_email", { p_operator_id: "op-ale", p_participant_id: P, p_email: "iris@example.test" });

    // L'admin non scrive email "come Ale".
    role = "admin";
    await expect(setEnteredEmailAction({ participantId: P, email: "x@example.test" })).rejects.toThrow(NOT_FOUND);
  });
});
