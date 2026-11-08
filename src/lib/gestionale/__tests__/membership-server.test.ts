// D11 (016): server/membership.ts usa le stesse fonti della pagina admin
// (Google Sheet live per modulo e libro soci + manual_override della tabella)
// con una cache di 5 minuti, e non fa uscire dati sensibili. Fonti simulate,
// dati inventati.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MANUAL_ID = "00000000-0000-4000-8000-00000000a0a1";

const formRows = [
  // Caso di verifica: presente SOLO nel modulo (google_sheet).
  { first_name: "Ginevra", last_name: "Solo Modulo", email: "ginevra@example.test", source: "google_sheet", membership_status: "verified", membership_starts_at: "2026-01-10", membership_expires_at: "2026-12-31", fiscal_code: "NON-DEVE-USCIRE" },
  // 4d: stessa persona nel modulo (con email) e nel libro soci (senza email).
  { first_name: "Ortensia", last_name: "Doppia", email: "ortensia@example.test", source: "google_sheet", membership_status: "verified", membership_starts_at: "2025-11-02", membership_expires_at: "2026-12-31" },
];
const bookRows = [
  { first_name: "Livia", last_name: "Libro", email: "Livia.Libro@gmail.com", source: "official_members_book", membership_status: "verified", membership_starts_at: "2025-10-01", membership_expires_at: "2026-12-31", fiscal_code: "XXXYYY00A00Z000Z", birth_date: "1990-01-01", membership_card_number: "T-9" },
  { first_name: "Doppia", last_name: "Ortensia", email: null, source: "official_members_book", membership_status: "verified", membership_starts_at: "2025-11-02", membership_expires_at: "2026-12-31" },
  // Omonimi con email diverse: soci diversi. Socio del libro senza email e senza altre fonti.
  { first_name: "Pia", last_name: "Uguale", email: "pia.uno@example.test", source: "official_members_book", membership_status: "verified", membership_starts_at: "2025-10-01", membership_expires_at: "2026-12-31" },
  { first_name: "Pia", last_name: "Uguale", email: "pia.due@example.test", source: "official_members_book", membership_status: "missing", membership_starts_at: null, membership_expires_at: null },
  { first_name: "Senza", last_name: "Posta", email: null, source: "official_members_book", membership_status: "verified", membership_starts_at: "2025-10-01", membership_expires_at: "2026-12-31" },
];
const manualRows = [
  { id: MANUAL_ID, first_name: "Marta", last_name: "Manuale", email: "marta@example.test", source: "manual_override", membership_status: "verified", membership_starts_at: "2025-09-15", membership_expires_at: "2026-12-31" },
];

const readForm = vi.fn(async () => ({ rows: formRows }));
const readBook = vi.fn(async () => ({ rows: bookRows }));
const tableQueries: { table: string; columns: string; filters: string[] }[] = [];

vi.mock("@/lib/google/sheets", () => ({ readAssociationMembersFromGoogleSheet: () => readForm() }));
vi.mock("@/lib/google/members-book", () => ({ readOfficialMembersBookFromGoogleSheet: () => readBook() }));
vi.mock("@/lib/gestionale/server/auth", () => ({ requireAdmin: async () => ({ id: "op", role: "admin" }) }));

function query(table: string) {
  const entry = { table, columns: "", filters: [] as string[] };
  tableQueries.push(entry);
  const result = () => ({ data: table === "association_members" ? manualRows : [], error: null });
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "in", "is", "not", "or", "ilike", "range", "order"]) {
    builder[method] = (...args: unknown[]) => {
      entry.filters.push(`${method}:${args.join(",")}`);
      return builder;
    };
  }
  builder.select = (columns: string) => {
    entry.columns = columns;
    return builder;
  };
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return builder;
}
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query }) }));

const membership = await import("../server/membership");

function person(fields: Partial<{ first_name: string; last_name: string; email: string; association_member_id: string; membership_email: string }>) {
  return {
    id: `p-${Object.values(fields).join("-")}`,
    first_name: null,
    last_name: null,
    email: null,
    association_member_id: null,
    membership_email: null,
    ...fields,
  };
}

beforeEach(() => {
  tableQueries.length = 0;
  // Le fonti Google sono simulate: configura i nomi delle env richieste
  // per verificare il ramo live senza credenziali autentiche.
  for (const key of [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
    "GOOGLE_SHEET_RANGE",
    "GOOGLE_MEMBERS_BOOK_RANGE",
  ]) vi.stubEnv(key, "test");
});
afterEach(() => vi.unstubAllEnvs());

describe("stato socio dalle fonti admin", () => {
  it("caso di verifica: solo una riga google_sheet → come nella pagina admin, quota non registrata", async () => {
    const p = person({ first_name: "Ginevra", last_name: "Solo Modulo", email: "ginevra@example.test" });
    const badges = await membership.getMembershipBadges([p], "2026-03-14");
    expect(badges.get(p.id)).toEqual({ kind: "quota_mancante", paymentsFrom: "2025-09-01" });
  });

  it("libro soci (email normalizzata come l'admin), validazione manuale collegata, nessuna corrispondenza", async () => {
    const book = person({ first_name: "Livia", email: "livialibro@gmail.com" });
    const linkedByKey = person({ first_name: "Liv", email: "altra@example.test", membership_email: "livia.libro@gmail.com" });
    const manual = person({ first_name: "M", association_member_id: MANUAL_ID });
    const nobody = person({ first_name: "Nessuno", email: "nessuno@example.test" });
    const badges = await membership.getMembershipBadges([book, linkedByKey, manual, nobody], "2026-03-14");
    expect(badges.get(book.id)).toMatchObject({ kind: "in_regola", match: "email" });
    expect(badges.get(linkedByKey.id)).toMatchObject({ kind: "in_regola", match: "email" });
    expect(badges.get(manual.id)).toMatchObject({ kind: "in_regola", match: "manual" });
    expect(badges.get(nobody.id)).toEqual({ kind: "non_collegata" });
    // Workshop nov 2026: stesso periodo, in regola. Feb 2027 (anno solare): la quota di ottobre 2025 non vale.
    expect((await membership.getMembershipBadges([book], "2026-11-14")).get(book.id)?.kind).toBe("in_regola");
    expect((await membership.getMembershipBadges([book], "2027-02-06")).get(book.id)?.kind).toBe("non_collegata");
    // Socia riconosciuta nel 2026: nel 2027 deve rinnovare la quota.
    expect((await membership.getMembershipBadges([linkedByKey], "2027-02-06")).get(linkedByKey.id))
      .toEqual({kind:"quota_mancante",paymentsFrom:"2027-01-01"});
  });

  it("dalla tabella si leggono solo le righe manual_override, senza colonne sensibili", async () => {
    vi.useFakeTimers({ now: Date.now() + 10 * 60_000 }); // cache scaduta
    await membership.getMembershipBadges([person({ first_name: "X" })], "2026-03-14");
    vi.useRealTimers();
    const members = tableQueries.filter((q) => q.table === "association_members");
    expect(members).toHaveLength(1);
    expect(members[0].filters).toContain("eq:source,manual_override");
    expect(members[0].columns).not.toMatch(/fiscal|birth|card/);
  });

  it("una quota manuale appena salvata vale subito anche se il libro soci è ancora in cache", async () => {
    const p=person({first_name:"Adriano",last_name:"Giuffrè",email:"adriano.giuff@gmail.com",membership_email:"adriano.giuff@gmail.com"});
    const first=(await membership.getMembershipBadges([p],"2027-02-06")).get(p.id);
    expect(first?.kind).not.toBe("in_regola");
    const row={
      id:"00000000-0000-4000-8000-00000000b0b7",
      first_name:"Adriano",last_name:"Giuffrè",email:"adrianogiuff@gmail.com",
      source:"manual_override",membership_status:"verified",
      membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31"
    };
    manualRows.push(row);
    try {
      const badge=(await membership.getMembershipBadges([p],"2027-02-06")).get(p.id);
      expect(badge).toEqual({kind:"in_regola",expiresAt:"2027-12-31",match:"manual"});
      row.membership_status="revoked";
      const revoked=(await membership.getMembershipBadges([p],"2027-02-06")).get(p.id);
      expect(revoked?.kind).not.toBe("in_regola");
    } finally { manualRows.pop(); }
  });

  it("cache di 5 minuti: i Google Sheet si leggono una volta sola", async () => {
    vi.useFakeTimers({ now: Date.now() + 60 * 60_000 });
    readForm.mockClear();
    readBook.mockClear();
    await membership.getMembershipBadges([person({ first_name: "A" })], "2026-03-14");
    await membership.searchMembers("livia");
    await membership.getMemberSummary(`m:${MANUAL_ID}`);
    expect(readForm).toHaveBeenCalledTimes(1);
    expect(readBook).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 6 * 60_000);
    await membership.searchMembers("livia");
    expect(readForm).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("ricerca e collegamento", () => {
  it("una voce per socio, con chiave admin; nessun dato sensibile", async () => {
    const results = [
      ...(await membership.searchMembers("livia")),
      ...(await membership.searchMembers("ginevra")),
      ...(await membership.searchMembers("marta")),
    ];
    expect(results).toEqual([
      { id: "e:livialibro@gmail.com", first_name: "Livia", last_name: "Libro", email: "Livia.Libro@gmail.com", expires_at: "2026-12-31", source: "libro", name_split: true },
      { id: "e:ginevra@example.test", first_name: "Ginevra", last_name: "Solo Modulo", email: "ginevra@example.test", expires_at: null, source: "modulo", name_split: true },
      { id: `m:${MANUAL_ID}`, first_name: "Marta", last_name: "Manuale", email: "marta@example.test", expires_at: "2026-12-31", source: "manuale", name_split: true },
    ]);
    expect(JSON.stringify(results)).not.toMatch(/XXXYYY|NON-DEVE-USCIRE|1990-01-01|T-9/);
  });

  it("4d: una voce per socio anche tra fonti diverse (modulo con email + libro senza email); stato che risulterebbe", async () => {
    const [ortensia] = await membership.searchMembers("ortensia", 8, "2026-11-14");
    expect(await membership.searchMembers("ortensia")).toHaveLength(1);
    expect(ortensia).toMatchObject({
      id: "e:ortensia@example.test",
      email: "ortensia@example.test",
      source: "libro",
      in_book: true,
      outcome: { kind: "in_regola", expiresAt: "2026-12-31" },
    });
    // Periodo 2027: la quota del 2025 non vale più.
    const [later] = await membership.searchMembers("ortensia", 8, "2027-02-06");
    expect(later.outcome?.kind).not.toBe("in_regola");

    const pia = await membership.searchMembers("pia uguale", 8, "2026-11-14");
    expect(pia.map((m) => m.id).sort()).toEqual(["e:pia.due@example.test", "e:pia.uno@example.test"]);
    expect(await membership.searchMembers("senza posta")).toMatchObject([{ id: "n:posta senza", email: null }]);
    expect(await membership.getMemberLink("n:posta senza")).toEqual({ memberId: null, email: null, firstName: "Senza", lastName: "Posta" });
  });

  it("collegamento: id solo per le validazioni manuali, altrimenti l'email", async () => {
    expect(await membership.getMemberLink(`m:${MANUAL_ID}`)).toEqual({ memberId: MANUAL_ID, email: null, firstName: "Marta", lastName: "Manuale" });
    expect(await membership.getMemberLink("e:livialibro@gmail.com")).toEqual({
      memberId: null,
      email: "livia.libro@gmail.com",
      firstName: "Livia",
      lastName: "Libro",
    });
    expect(await membership.getMemberLink("e:sconosciuto@example.test")).toBeNull();
  });
});
