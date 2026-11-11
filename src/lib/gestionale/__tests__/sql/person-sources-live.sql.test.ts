// Migrazione 051 (Fase C audit anagrafica): il registro gw_person_sources si
// aggiorna da solo. Solo PGlite. Dati inventati.

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
  return t;
}

describe("051 — registro sempre aggiornato", () => {
  let t: TestDb;
  let admin: string;
  let ale: string;
  const id: Record<string, string> = {};
  const source = (kind: string, ref: string) =>
    t.rows<Source>(`select id, status::text, person_id, candidate_ids, version, note
                    from gw_person_sources where source_kind = $1 and source_ref = $2`, [kind, ref]).then((r) => r[0]);
  const person = (first: string | null, last: string | null, email: string | null, nickname: string | null = null) =>
    t.value<string>(`insert into gw_people (first_name, last_name, email, nickname) values ($1, $2, $3, $4) returning id v`,
      [first, last, email, nickname]);
  const form = (first: string, last: string, email: string, rowId: string) =>
    t.value<string>(`insert into association_members (source, first_name, last_name, email, source_row_id)
                     values ('google_sheet', $1, $2, $3, $4) returning id v`, [first, last, email, rowId]);

  beforeAll(async () => {
    t = await freshDb();
    admin = await t.operator("Admin Prova");
    ale = await t.operator("Ale Prova");
    await t.db.query(`update gw_operators set role = 'admin' where id = $1`, [admin]);
    await t.db.query(`update gw_operators set role = 'organizzatrice' where id = $1`, [ale]);
    id.viola = await person("Viola", "Ferraresi", "viola.ferraresi@gmail.com");
    id.irene = await person("Irene", "Saltarelli", "condivisa@example.test");
    id.tommaso = await person("Tommaso", "Saltarelli", "condivisa@example.test");
    id.asteria = await person("Asteria", "Lombardi", "asteria@example.test", "Aster");
  });

  it("un nuovo modulo Google registra la sua riga, anche quando è dubbio", async () => {
    // Persona nuova: il trigger 045 crea la scheda, la 051 la registra.
    id.formNadia = await form("Nadia", "De Santis", "nadia@example.test", "g-10");
    const nadia = await t.value<string>(`select id v from gw_people where email = 'nadia@example.test'`);
    expect(await source("modulo_google", id.formNadia)).toMatchObject({ status: "automatico", person_id: nadia });
    // Email condivisa: oggi il 045 restituisce 'review' e la perde; ora resta in coda.
    id.formShared = await form("Irene", "Saltarelli", "condivisa@example.test", "g-11");
    const shared = await source("modulo_google", id.formShared);
    expect(shared).toMatchObject({ status: "da_confermare", person_id: null });
    expect([...shared.candidate_ids].sort()).toEqual([id.irene, id.tommaso].sort());
    // Gmail con punti diversi: stessa persona.
    id.formViola = await form("Viola", "Ferraresi", "violaferraresi@gmail.com", "g-12");
    expect(await source("modulo_google", id.formViola)).toMatchObject({ status: "automatico", person_id: id.viola });
  });

  it("l'admin conferma o rifiuta, e la scelta non viene sovrascritta", async () => {
    const shared = await source("modulo_google", id.formShared);
    const done = await t.value<{ status: string; version: number }>(
      `select gw_resolve_person_source($1, $2, $3, 'conferma', $4) v`, [admin, shared.id, shared.version, id.irene]);
    expect(done.status).toBe("confermato");
    // Il modulo cambia nel foglio: il trigger ricalcola ma non tocca la decisione.
    await t.db.query(`update association_members set last_name = 'Saltarelli Neri' where id = $1`, [id.formShared]);
    expect(await source("modulo_google", id.formShared)).toMatchObject({ status: "confermato", person_id: id.irene });
    // Versione vecchia → conflitto; Ale non può decidere.
    expect((await t.error(`select gw_resolve_person_source($1, $2, $3, 'rifiuta', null)`,
      [admin, shared.id, shared.version]))?.message).toBe("gw_conflict");
    const now = await source("modulo_google", id.formShared);
    expect((await t.error(`select gw_resolve_person_source($1, $2, $3, 'rifiuta', null)`,
      [ale, now.id, now.version]))?.message).toBe("gw_forbidden");
    // Registro storico.
    expect(await t.value<number>(`select count(*)::int v from gw_audit_log where entity = 'person_source'`)).toBe(1);
  });

  it("un'iscrizione di Ale col solo nickname resta una proposta e segue l'abbinamento", async () => {
    const workshop = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000951', 'Luxuria prova', '2026-12-05', null) v`, [admin]);
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [admin, workshop]);
    await t.value(`select gw_create_registration($1, $2, '["Aster"]'::jsonb, 'prenotato', null, null, null) v`, [ale, workshop]);
    const p = (await t.rows<{ participant: string; booking: string; version: number }>(
      `select bp.id participant, b.id booking, b.version from gw_booking_participants bp
       join gw_bookings b on b.id = bp.booking_id where b.workshop_id = $1`, [workshop]))[0];
    // Il nickname coincide con quello di Asteria: è solo una proposta, non un
    // collegamento (manca l'email).
    expect(await source("iscrizione_workshop", p.participant)).toMatchObject({
      status: "da_confermare", person_id: null, candidate_ids: [id.asteria] });

    // L'admin dice "è lei" dal flusso esistente (conferma della proposta): il registro segue.
    await t.value(`select gw_confirm_match($1, $2, $3, $4) v`, [admin, p.booking, p.version, p.participant]);
    expect(await source("iscrizione_workshop", p.participant)).toMatchObject({ status: "confermato", person_id: id.asteria });

    // Partecipante rimosso: la riga sparisce solo se non era una scelta esplicita.
    await t.db.query(`update gw_booking_participants set removed_at = now() where id = $1`, [p.participant]);
    expect(await source("iscrizione_workshop", p.participant)).toMatchObject({ status: "confermato" });
  });

  it("biglietti TT: automatico solo se email e nome indicano una sola persona", async () => {
    await t.db.query(`insert into ticket_tailor_issued_tickets
      (ticket_tailor_event_id, ticket_tailor_issued_ticket_id, status, holder_first_name, holder_last_name, holder_email) values
      ($1, 'tk-viola', 'valid', 'Viola', 'Ferraresi', 'Viola.Ferraresi@gmail.com'),
      ($1, 'tk-shared', 'valid', 'Irene', 'Saltarelli', 'condivisa@example.test'),
      ($1, 'tk-void', 'void', 'Jonas', 'Brettner', 'jonas@example.test'),
      ($1, 'tk-new', 'valid', 'Dario', 'Colonna', 'dario@example.test')`, [TT_EVENT]);
    expect(await t.value<number>(`select gw_register_ticket_sources($1) v`, [TT_EVENT])).toBe(4);
    expect(await source("biglietto_intestatario", `${EVENT}:tk-viola`)).toMatchObject({ status: "automatico", person_id: id.viola });
    expect(await source("biglietto_intestatario", `${EVENT}:tk-shared`)).toMatchObject({ status: "da_confermare", person_id: null });
    expect(await source("biglietto_intestatario", `${EVENT}:tk-void`)).toBeUndefined();
    expect(await source("biglietto_intestatario", `${EVENT}:tk-new`)).toMatchObject({
      status: "da_confermare", candidate_ids: [], note: "nessuna persona con questa email" });

    // L'admin abbina l'intestatario dal flusso TT: il registro segue, anche all'annullamento.
    await t.db.query(`insert into gw_peony_booking_holders (event_id, ticket_id, person_id, updated_by)
                      values ($1, 'tk-shared', $2, $3)`, [EVENT, id.tommaso, admin]);
    expect(await source("biglietto_intestatario", `${EVENT}:tk-shared`)).toMatchObject({ status: "confermato", person_id: id.tommaso });
    await t.db.query(`delete from gw_peony_booking_holders where event_id = $1 and ticket_id = 'tk-shared'`, [EVENT]);
    expect(await source("biglietto_intestatario", `${EVENT}:tk-shared`)).toMatchObject({ status: "da_confermare" });

    // Partner indicato solo per nome: in coda finché qualcuno lo collega.
    await t.db.query(`insert into gw_peony_booking_partners (event_id, ticket_id, partner_name) values ($1, 'tk-viola', 'Giorgia')`, [EVENT]);
    expect(await source("biglietto_partner", `${EVENT}:tk-viola`)).toMatchObject({ status: "da_confermare" });
  });

  it("contatti di Ale: chiusi da soli quando email e nome coincidono", async () => {
    await t.db.query(`insert into gw_ale_contacts (owner_operator_id, source_key, display_name, email) values
      ($1, $2, 'Viola Ferraresi', 'viola.ferraresi@gmail.com'),
      ($1, $3, 'Irene Saltarelli', 'condivisa@example.test'),
      ($1, $4, 'Elisa', null)`, [ale, "a".repeat(64), "b".repeat(64), "c".repeat(64)]);
    const rows = await t.rows<{ seen_name: string; status: string }>(
      `select seen_name, status::text from gw_person_sources where source_kind = 'contatto_ale' order by seen_name`);
    expect(rows).toEqual([
      { seen_name: "Elisa", status: "da_confermare" },
      { seen_name: "Irene Saltarelli", status: "da_confermare" },
      { seen_name: "Viola Ferraresi", status: "automatico" },
    ]);
    // Rieseguire non cambia nulla.
    expect(await t.value<number>(`select gw_auto_match_ale_contacts() v`)).toBe(0);
  });

  it("quote da email: il registro segue l'allocazione, anche quando viene tolta", async () => {
    const payment = await t.value<string>(`insert into gw_association_payment_emails
      (gmail_message_id, provider, paid_at, amount_cents, status, payer_name)
      values ('m-1', 'paypal', '2026-10-12T10:00:00Z', 1500, 'confirmed', 'Tommaso Ravizza') returning id v`);
    const allocation = await t.value<string>(`insert into gw_association_payment_allocations
      (payment_id, person_id, slot, period_from, validated_by) values ($1, $2, 1, '2025-09-01', $3) returning id v`,
      [payment, id.viola, admin]);
    expect(await source("quota_email", allocation)).toMatchObject({ status: "confermato", person_id: id.viola });
    await t.db.query(`delete from gw_association_payment_allocations where id = $1`, [allocation]);
    expect(await source("quota_email", allocation)).toBeUndefined();
  });

  it("iscrizioni, biglietti e contatti non si decidono con gw_resolve_person_source", async () => {
    const ticket = await source("biglietto_intestatario", `${EVENT}:tk-new`);
    expect((await t.error(`select gw_resolve_person_source($1, $2, $3, 'rifiuta', null)`,
      [admin, ticket.id, ticket.version]))?.message).toBe("gw_invalid");
  });

  it("una quota \"Quota ok\" scritta fuori dai trigger entra con gw_register_pending_member_rows", async () => {
    const quota = await t.value<string>(`insert into association_members
      (source, first_name, last_name, email, membership_status, membership_starts_at, membership_expires_at)
      values ('manual_override', 'Viola', 'Ferraresi', 'viola.ferraresi@gmail.com', 'verified', '2026-10-01', '2027-12-31') returning id v`);
    expect(await source("quota_manuale", quota)).toBeUndefined();
    expect(await t.value<number>(`select gw_register_pending_member_rows() v`)).toBe(1);
    expect(await source("quota_manuale", quota)).toMatchObject({ status: "automatico", person_id: id.viola });
    expect(await t.value<number>(`select gw_register_pending_member_rows() v`)).toBe(0);
  });

  it("gw_refresh_person_sources è idempotente", async () => {
    const before = await t.value<number>(`select count(*)::int v from gw_person_sources`);
    const result = await t.value<{ contatti_ale_chiusi: number }>(`select gw_refresh_person_sources() v`);
    expect(result.contatti_ale_chiusi).toBe(0);
    expect(await t.value<number>(`select count(*)::int v from gw_person_sources`)).toBe(before);
  });

  it("riservata al server", async () => {
    for (const fn of ["gw_resolve_person_source(uuid, uuid, integer, text, uuid)", "gw_refresh_person_sources()",
                      "gw_register_pending_member_rows()",
                      "gw_register_ticket_sources(text)", "gw_auto_match_ale_contacts()"]) {
      expect(await t.value<boolean>(`select has_function_privilege('anon', 'public.${fn}', 'EXECUTE') v`), fn).toBe(false);
      expect(await t.value<boolean>(`select has_function_privilege('authenticated', 'public.${fn}', 'EXECUTE') v`), fn).toBe(false);
    }
  });

  it("il rollback rimuove trigger e funzioni e ripristina il trigger dei moduli", async () => {
    await t.db.exec(migration("051_gw_person_sources_live.down.sql"));
    expect(await t.value<string | null>(`select to_regprocedure('public.gw_register_member_row_source(uuid)')::text v`)).toBeNull();
    const before = await t.value<number>(`select count(*)::int v from gw_person_sources`);
    await form("Anna", "Weber", "anna@example.test", "g-99");
    // Il modulo crea ancora la persona (045), ma non scrive più nel registro.
    expect(await t.value<number>(`select count(*)::int v from gw_people where email = 'anna@example.test'`)).toBe(1);
    expect(await t.value<number>(`select count(*)::int v from gw_person_sources`)).toBe(before);
  });
});
