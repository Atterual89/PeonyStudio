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

describe("fonti associative Google + quota", () => {
  it("modulo Google senza quota: giallo", async () => {
    const p=person({first_name:"Ginevra",last_name:"Solo Modulo",email:"ginevra@example.test"});
    expect((await membership.getMembershipBadges([p],"2026-11-14")).get(p.id))
      .toEqual({kind:"quota_mancante",paymentsFrom:"2025-09-01"});
  });
  it("libro storico non è registrazione e non è pagamento", async () => {
    const old=person({first_name:"Livia",last_name:"Libro",email:"livialibro@gmail.com"});
    expect((await membership.getMembershipBadges([old],"2026-11-14")).get(old.id))
      .toMatchObject({kind:"non_collegata",quotaPaid:false});
  });
  it("quota manuale con modulo assente rimane memorizzata senza diventare verde", async () => {
    const p=person({first_name:"Marta",last_name:"Manuale",association_member_id:MANUAL_ID});
    expect((await membership.getMembershipBadges([p],"2026-11-14")).get(p.id))
      .toMatchObject({kind:"modulo_mancante",quotaPaid:true,quotaMatch:"manual"});
  });
  it("quota per 2027 salvata e riconosciuta senza ricavare un modulo inesistente", async () => {
    const p=person({first_name:"Adriano",last_name:"Giuffrè",email:"adriano.giuff@gmail.com",membership_email:"adriano.giuff@gmail.com"});
    const row={id:"00000000-0000-4000-8000-00000000b0b7",first_name:"Adriano",last_name:"Giuffrè",email:"adrianogiuff@gmail.com",
      source:"manual_override",membership_status:"verified",membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31"};
    manualRows.push(row);
    try{
      expect((await membership.getMembershipBadges([p],"2027-02-06")).get(p.id))
        .toMatchObject({kind:"modulo_mancante",quotaPaid:true});
      row.membership_status="revoked";
      expect((await membership.getMembershipBadges([p],"2027-02-06")).get(p.id))
        .toMatchObject({kind:"modulo_mancante",quotaPaid:false});
    }finally{manualRows.pop();}
  });
  it("non espone dati sensibili nel browser", async()=>{
    const people=await membership.searchMembers("ginevra");
    expect(JSON.stringify(people)).not.toMatch(/NON-DEVE-USCIRE|XXXYYY|1990-01-01|T-9/);
  });
  it("legge il modulo e non legge più il libro storico live", async()=>{
    readBook.mockClear();
    readForm.mockClear();
    await membership.clearMembershipCache();
    await membership.searchMembers("ortensia");
    expect(readForm).toHaveBeenCalledTimes(1);
    expect(readBook).not.toHaveBeenCalled();
  });
  it("solo email del modulo o quota manuale possono essere collegate", async()=>{
    expect(await membership.getMemberLink("e:ortensia@example.test"))
      .toEqual({memberId:null,email:"ortensia@example.test",firstName:"Ortensia",lastName:"Doppia"});
    expect(await membership.getMemberLink("m:"+MANUAL_ID))
      .toEqual({memberId:MANUAL_ID,email:null,firstName:"Marta",lastName:"Manuale"});
    expect(await membership.getMemberLink("e:livialibro@gmail.com")).toBeNull();
  });
});
