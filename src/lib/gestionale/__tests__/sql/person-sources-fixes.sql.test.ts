// Migrazione 052 (Fase C, correzioni dopo il primo confronto): quote assegnate a
// un socio del libro soci e biglietti con email diversa. Solo PGlite. Dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

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
  "045_gw_auto_person_from_google_forms.sql",
  "050_gw_person_sources.sql",
];
const EVENT = "11111111-1111-4111-8111-111111111111";
const TT_EVENT = "ev_test_1";

type Source = { id: string; status: string; person_id: string | null; candidate_ids: string[]; version: number; note: string | null };

async function freshDb(): Promise<TestDb> {
  const t = await createTestDb(MIGRATIONS, { supabaseDefaults: true });
  // Tabelle del sito lette dalle migrazioni (come negli altri test SQL).
  await t.db.exec(`
    create table public.ticket_tailor_issued_tickets(
      ticket_tailor_event_id text, ticket_tailor_issued_ticket_id text, status text,
      holder_first_name text, holder_last_name text, holder_email text, last_synced_at timestamptz);
    alter table public.events add column ticket_tailor_event_id text;
    update public.events set ticket_tailor_event_id = '${TT_EVENT}' where id = '${EVENT}';`);
  for (const file of DEPENDENCIES) await t.db.exec(migration(file));
  await t.db.exec(migration("051_gw_person_sources_live.sql"));
  await t.db.exec(migration("052_gw_person_sources_fixes.sql"));
  return t;
}

describe("052 — correzioni", () => {
  let t: TestDb;
  let admin: string;
  const id: Record<string, string> = {};
  const source = (kind: string, ref: string) =>
    t.rows<Source>(`select id, status::text, person_id, candidate_ids, version, note
                    from gw_person_sources where source_kind = $1 and source_ref = $2`, [kind, ref]).then((r) => r[0]);
  const person = (first: string, last: string, email: string | null) =>
    t.value<string>(`insert into gw_people (first_name, last_name, email) values ($1, $2, $3) returning id v`, [first, last, email]);
  let payment: string;
  const allocate = (memberKey: string, slot: number) =>
    t.value<string>(`insert into gw_association_payment_allocations (payment_id, member_key, slot, period_from, validated_by)
                     values ($1, $2, $3, '2025-09-01', $4) returning id v`, [payment, memberKey, slot, admin]);

  beforeAll(async () => {
    t = await freshDb();
    admin = await t.operator("Admin Prova");
    await t.db.query(`update gw_operators set role = 'admin' where id = $1`, [admin]);
    id.viola = await person("Viola", "Ferraresi", "viola.ferraresi@gmail.com");
    id.nadia = await person("Nadia", "De Santis", null);
    await t.db.query(`insert into association_members (source, first_name, last_name) values ('official_members_book', 'Nadia', 'De Santis')`);
    await t.db.query(`update gw_people set membership_name_key = gw_name_key('Nadia De Santis') where id = $1`, [id.nadia]);
    id.dario1 = await person("Dario", "Colonna", null);
    id.dario2 = await person("Dario", "Colonna", "dario.c@example.test");
    payment = await t.value<string>(`insert into gw_association_payment_emails
      (gmail_message_id, provider, paid_at, amount_cents, status, payer_name)
      values ('m-52', 'paypal', '2026-10-12T10:00:00Z', 4500, 'confirmed', 'Tommaso Ravizza') returning id v`);
  });

  it("quota assegnata a un socio per email: collegata alla persona", async () => {
    const a = await allocate("e:violaferraresi@gmail.com", 1);
    expect(await source("quota_email", a)).toMatchObject({ status: "automatico", person_id: id.viola });
  });

  it("quota assegnata a un socio per nome collegato dall'admin: collegata", async () => {
    const a = await allocate("n:nadia de santis", 2);
    expect(await source("quota_email", a)).toMatchObject({ status: "automatico", person_id: id.nadia });
  });

  it("quota assegnata per nome con due omonimi: da confermare con i candidati", async () => {
    const a = await allocate("n:dario colonna", 3);
    const row = await source("quota_email", a);
    expect(row).toMatchObject({ status: "da_confermare", person_id: null });
    expect([...row.candidate_ids].sort()).toEqual([id.dario1, id.dario2].sort());
  });

  it("biglietto con email sconosciuta: propone chi ha lo stesso nome, mai in automatico", async () => {
    await t.db.query(`insert into ticket_tailor_issued_tickets
      (ticket_tailor_event_id, ticket_tailor_issued_ticket_id, status, holder_first_name, holder_last_name, holder_email) values
      ($1, 'tk-altra', 'valid', 'Viola', 'Ferraresi', 'altra.email@example.test'),
      ($1, 'tk-nessuno', 'valid', 'Anna', 'Weber', 'anna@example.test')`, [TT_EVENT]);
    await t.value(`select gw_register_ticket_sources($1) v`, [TT_EVENT]);
    expect(await source("biglietto_intestatario", `${EVENT}:tk-altra`)).toMatchObject({
      status: "da_confermare", person_id: null, candidate_ids: [id.viola], note: "email diversa, stesso nome in anagrafica" });
    expect(await source("biglietto_intestatario", `${EVENT}:tk-nessuno`)).toMatchObject({
      status: "da_confermare", candidate_ids: [], note: "nessuna persona con questa email né con questo nome" });
  });

  it("riservata al server", async () => {
    for (const fn of ["gw_sync_allocation_source(uuid)", "gw_member_key_candidates(text)", "gw_email_known(text)"]) {
      expect(await t.value<boolean>(`select has_function_privilege('anon', 'public.${fn}', 'EXECUTE') v`), fn).toBe(false);
    }
  });

  it("il rollback ripristina le funzioni della 051", async () => {
    await t.db.exec(migration("052_gw_person_sources_fixes.down.sql"));
    expect(await t.value<string | null>(`select to_regprocedure('public.gw_sync_allocation_source(uuid)')::text v`)).toBeNull();
    payment = await t.value<string>(`insert into gw_association_payment_emails
      (gmail_message_id, provider, paid_at, amount_cents, status, payer_name)
      values ('m-53', 'paypal', '2026-10-13T10:00:00Z', 1500, 'confirmed', 'Viola Ferraresi') returning id v`);
    const a = await allocate("e:viola.ferraresi@gmail.com", 1);
    // Comportamento 051: quota senza persona, in coda.
    expect(await source("quota_email", a)).toMatchObject({ status: "da_confermare", person_id: null });
  });
});
