// Migrazione 050 (Fase B audit anagrafica): registro unico dei collegamenti
// fonte → persona e copia dei collegamenti esistenti. Solo PGlite. Dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { normalizeMembershipEmail } from "@/lib/association/membership-state";

import { MIGRATIONS, createTestDb, type TestDb } from "./pglite";

const migration = (file: string) => readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8");
const DEPENDENCIES = [
  "029_gw_association_payment_emails.sql",
  "031_gw_peony_booking_partners.sql",
  "032_gw_keep_explicit_nominal_links.sql",
  "032_gw_peony_booking_holders.sql",
  "033_gw_name_only_membership_link.sql",
  "038_gw_billing_directory.sql",
  "039_gw_ale_contacts_admin_matching.sql",
];
const EVENT = "11111111-1111-4111-8111-111111111111";

async function freshDb(): Promise<TestDb> {
  const t = await createTestDb(MIGRATIONS, { supabaseDefaults: true });
  // Tabella del sito letta dalla 029 (come in association-mail.sql.test.ts).
  await t.db.exec(`create table public.ticket_tailor_issued_tickets(
    ticket_tailor_event_id text, status text, last_synced_at timestamptz);`);
  for (const file of DEPENDENCIES) await t.db.exec(migration(file));
  await t.db.exec(migration("050_gw_person_sources.sql"));
  return t;
}

type Source = { source_kind: string; source_ref: string; person_id: string | null; status: string; candidate_ids: string[]; note: string | null };
const sourceOf = (t: TestDb, kind: string, ref: string) =>
  t.rows<Source>(`select source_kind::text, source_ref, person_id, status::text, candidate_ids, note
                  from gw_person_sources where source_kind = $1 and source_ref = $2`, [kind, ref]).then((r) => r[0]);

describe("gw_norm_email", () => {
  it("normalizza come normalizeMembershipEmail del codice", async () => {
    const t = await freshDb();
    const cases = [
      "Viola.Ferraresi@Gmail.com", " viola.ferraresi+peony@googlemail.com ", "v.f@example.test",
      "V.F+tag@Example.TEST", "senza-chiocciola", "irene@gmail.com",
    ];
    for (const value of cases) {
      expect(await t.value<string>(`select gw_norm_email($1) v`, [value]), value).toBe(normalizeMembershipEmail(value));
    }
    expect(await t.value<string | null>(`select gw_norm_email('  ') v`)).toBeNull();
  });
});

describe("gw_backfill_person_sources", () => {
  let t: TestDb;
  let admin: string;
  let ale: string;
  const id: Record<string, string> = {};

  beforeAll(async () => {
    t = await freshDb();
    admin = await t.operator("Admin Prova");
    ale = await t.operator("Ale Prova");
    await t.db.query(`update gw_operators set role = 'admin' where id = $1`, [admin]);

    const person = (first: string, last: string, email: string | null) =>
      t.value<string>(`insert into gw_people (first_name, last_name, email) values ($1, $2, $3) returning id v`,
        [first, last, email]);
    const member = (source: string, first: string | null, last: string | null, email: string | null, notes: string | null = null, rowId: string | null = null) =>
      t.value<string>(`insert into association_members (source, first_name, last_name, email, notes_admin, source_row_id)
                       values ($1, $2, $3, $4, $5, $6) returning id v`, [source, first, last, email, notes, rowId]);

    id.viola = await person("Viola", "Ferraresi", "viola.ferraresi@gmail.com");
    id.irene = await person("Irene", "Saltarelli", "condivisa@example.test");
    id.tommaso = await person("Tommaso", "Saltarelli", "condivisa@example.test");
    id.nadia = await person("Nadia", "De Santis", "nadia@example.test");

    // Modulo Google: email Gmail scritta con i punti in modo diverso.
    id.formViola = await member("google_sheet", "Viola", "Ferraresi", "violaferraresi@gmail.com", null, "g-1");
    // Email condivisa da due persone: in coda anche se il nome ne indica una.
    id.formShared = await member("google_sheet", "Irene", "Saltarelli Neri", "condivisa@example.test", null, "g-2");
    // Stessa email ma nome incompatibile: non è nessuno dei due.
    id.formOther = await member("google_sheet", "Giorgia", "Brunetto", "nadia@example.test", null, "g-3");
    // Quota da email: rappresentata dall'allocazione, non dalla riga.
    await member("manual_override", "Viola", "Ferraresi", "violaferraresi@gmail.com", "Quota confermata da email (riferimento x)");
    // Quota manuale "Quota ok" collegata per email e nome.
    id.manualNadia = await member("manual_override", "Nadia", "De Santis", "nadia@example.test");
    // Libro ufficiale: uno collegato esplicitamente, uno no (resta fuori).
    id.bookLinked = await member("official_members_book", "Elisa", "Ravizza", null);
    id.bookAlone = await member("official_members_book", "Dario", "Colonna", null);
    id.elisa = await person("Elisa", "Ravizza", null);
    // Collegamento al libro per nome, come lo salva l'admin (migrazione 033).
    await t.db.query(`update gw_people set membership_name_key = 'elisa ravizza', membership_name_explicit = true where id = $1`, [id.elisa]);
    // Quota manuale collegata esplicitamente (association_member_id, migrazione 016).
    // Una persona ha un solo collegamento legacy alla volta (trigger 032).
    id.anna = await person("Anna", "Weber", null);
    id.manualAnna = await member("manual_override", "Anna", "Weber", null);
    await t.db.query(`update gw_people set association_member_id = $2 where id = $1`, [id.anna, id.manualAnna]);

    // Excel di Ale: uno collegato dall'admin, uno no.
    await t.db.query(`insert into gw_ale_contacts (owner_operator_id, source_key, display_name, email, person_id, linked_by, linked_at)
                      values ($1, $2, 'Nadia De Santis', 'nadia@example.test', $3, $4, now()),
                             ($1, $5, 'Jonas Brettner', null, null, null, null)`,
      [ale, "a".repeat(64), id.nadia, admin, "b".repeat(64)]);
    // Biglietto TT: intestatario collegato, partner solo al libro soci.
    await t.db.query(`insert into gw_peony_booking_holders (event_id, ticket_id, person_id, updated_by)
                      values ($1, 'tk-1', $2, $3)`, [EVENT, id.viola, admin]);
    await t.db.query(`insert into gw_peony_booking_partners (event_id, ticket_id, partner_name, member_row_id)
                      values ($1, 'tk-1', 'Elisa', $2), ($1, 'tk-2', null, null)`, [EVENT, id.bookLinked]);
    // Iscrizione di Ale con il solo nickname: scheda creata in automatico.
    const workshop = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000901', 'Luxuria prova', '2026-12-05', null) v`, [admin]);
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [admin, workshop]);
    await t.value(`select gw_create_registration($1, $2, '["Aster"]'::jsonb, 'prenotato', null, null, null) v`, [ale, workshop]);
  });

  it("copia i collegamenti esistenti con lo stato giusto", async () => {
    const result = await t.value<{ inserite: number }>(`select gw_backfill_person_sources() v`);
    expect(result.inserite).toBeGreaterThan(0);

    // Gmail con punti diversi: stessa persona, email e nome coerenti → automatico.
    expect(await sourceOf(t, "modulo_google", id.formViola)).toMatchObject({ status: "automatico", person_id: id.viola });
    // Email condivisa: nessun collegamento, due candidati.
    const shared = await sourceOf(t, "modulo_google", id.formShared);
    expect(shared).toMatchObject({ status: "da_confermare", person_id: null });
    expect(shared.candidate_ids.sort()).toEqual([id.irene, id.tommaso].sort());
    // Stessa email ma nome diverso (es. email del partner): in coda, mai automatico.
    expect(await sourceOf(t, "modulo_google", id.formOther)).toMatchObject({
      status: "da_confermare", person_id: null, candidate_ids: [id.nadia], note: "stessa email, nome diverso o mancante" });
    // Quota manuale collegata; quota da email esclusa (c'è l'allocazione).
    expect(await sourceOf(t, "quota_manuale", id.manualNadia)).toMatchObject({ status: "automatico", person_id: id.nadia });
    expect(await sourceOf(t, "quota_manuale", id.manualAnna)).toMatchObject({ status: "confermato", person_id: id.anna });
    expect(await t.value<number>(`select count(*)::int v from gw_person_sources where source_kind = 'quota_manuale'`)).toBe(2);
    // Libro ufficiale: solo il collegamento esplicito, l'altro resta archivio.
    expect(await sourceOf(t, "libro_ufficiale", id.bookLinked)).toMatchObject({ status: "confermato", person_id: id.elisa });
    expect(await sourceOf(t, "libro_ufficiale", id.bookAlone)).toBeUndefined();
    // Excel di Ale.
    expect(await t.rows(`select status::text, person_id from gw_person_sources where source_kind = 'contatto_ale' order by status`))
      .toEqual([{ status: "confermato", person_id: id.nadia }, { status: "da_confermare", person_id: null }]);
    // Biglietti: intestatario confermato; partner legato solo al libro soci → in coda con candidato.
    expect(await sourceOf(t, "biglietto_intestatario", `${EVENT}:tk-1`)).toMatchObject({ status: "confermato", person_id: id.viola });
    expect(await sourceOf(t, "biglietto_partner", `${EVENT}:tk-1`)).toMatchObject({
      status: "da_confermare", person_id: null, candidate_ids: [id.elisa] });
    expect(await sourceOf(t, "biglietto_partner", `${EVENT}:tk-2`)).toBeUndefined();
    // Iscrizione di Ale con il solo nickname: "da abbinare" → in coda, con la
    // scheda provvisoria come unico candidato.
    const entry = await t.rows<{ status: string; person_id: string | null; n: number; seen_name: string }>(
      `select status::text, person_id, cardinality(candidate_ids) n, seen_name
       from gw_person_sources where source_kind = 'iscrizione_workshop'`);
    expect(entry).toEqual([{ status: "da_confermare", person_id: null, n: 1, seen_name: "Aster" }]);
  });

  it("è idempotente e non sovrascrive le decisioni prese dopo", async () => {
    await t.db.query(`update gw_person_sources set status = 'rifiutato', person_id = null
                      where source_kind = 'modulo_google' and source_ref = $1`, [id.formOther]);
    const before = await t.value<number>(`select count(*)::int v from gw_person_sources`);
    const again = await t.value<{ inserite: number }>(`select gw_backfill_person_sources() v`);
    expect(again.inserite).toBe(0);
    expect(await t.value<number>(`select count(*)::int v from gw_person_sources`)).toBe(before);
    expect((await sourceOf(t, "modulo_google", id.formOther)).status).toBe("rifiutato");
  });

  it("non tocca le tabelle esistenti", async () => {
    expect(await t.value<number>(`select count(*)::int v from association_members`)).toBe(8);
    expect(await t.value<string | null>(`select membership_email v from gw_people where id = $1`, [id.viola])).toBeNull();
  });

  it("collegata se e solo se lo stato lo dice", async () => {
    const err = await t.error(`insert into gw_person_sources (source_kind, source_ref, status) values ('contatto_ale', 'x', 'confermato')`);
    expect(err?.code).toBe("23514");
  });

  it("riservata al server", async () => {
    expect(await t.value<boolean>(`select has_table_privilege('anon', 'public.gw_person_sources', 'SELECT') v`)).toBe(false);
    expect(await t.value<boolean>(`select has_table_privilege('authenticated', 'public.gw_person_sources', 'SELECT') v`)).toBe(false);
    expect(await t.value<boolean>(`select has_function_privilege('anon', 'public.gw_backfill_person_sources()', 'EXECUTE') v`)).toBe(false);
  });

  it("il rollback rimuove tutto e lascia intatto il resto", async () => {
    await t.db.exec(migration("050_gw_person_sources.down.sql"));
    expect(await t.value<string | null>(`select to_regclass('public.gw_person_sources')::text v`)).toBeNull();
    expect(await t.value<number>(`select count(*)::int v from gw_people`)).toBeGreaterThan(0);
    await t.db.exec(migration("050_gw_person_sources.sql"));
    expect(await t.value<number>(`select count(*)::int v from gw_person_sources`)).toBe(0);
  });
});
