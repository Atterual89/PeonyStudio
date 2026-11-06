// Migrazione 027 (Fase 5, D27, gw_functions_v5): una spunta "Presente" per
// iscrizione e lettura dello storico con filtri, filtrata lato server per
// l'organizzatrice. Solo PGlite. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let laura: string;
let ale: string;
let w: string;
let other: string;

async function register(entries: string[], workshop = w, status = "prenotato"): Promise<string> {
  return t.value<string>(`select gw_create_registration($1, $2, $3::jsonb, $4, null, null, null) v`, [ale, workshop, JSON.stringify(entries), status]);
}
const bookingRow = (booking: string) =>
  t.rows<{ version: number; present: boolean; status: string }>(`select version, present, status::text from gw_bookings where id = $1`, [booking]).then((rows) => rows[0]);
const setPresent = (booking: string, version: number, present: boolean, operator = laura) =>
  t.value<number>(`select gw_set_present($1, $2, $3, $4) v`, [operator, booking, version, present]);

type AuditRow = {
  id: number;
  operator_name: string | null;
  operator_role: string | null;
  entity: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  kind: string;
  workshop_id: string | null;
  workshop_name: string | null;
  subject: string | null;
  total: number;
};
type Filters = { role?: "admin" | "organizzatrice"; operator?: string; workshop?: string; kind?: string; person?: string; offset?: number; limit?: number };
const list = (filters: Filters = {}) =>
  t.rows<AuditRow>(`select *, total::int from gw_audit_list($1::gw_operator_role, $2, $3, $4, $5, $6, $7)`, [
    filters.role ?? "admin",
    filters.operator ?? null,
    filters.workshop ?? null,
    filters.kind ?? null,
    filters.person ?? null,
    filters.offset ?? 0,
    filters.limit ?? 50,
  ]);

beforeAll(async () => {
  t = await createTestDb(MIGRATIONS);
  laura = await t.operator("Laura Prova");
  ale = await t.operator("Ale Prova");
  await t.db.query(`update gw_operators set role = 'admin' where id = $1`, [laura]);
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000501', 'Luxuria presenze', '2026-11-14', null) v`, [laura]);
  other = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000502', 'Luxuria altro', '2027-02-06', null) v`, [laura]);
  for (const id of [w, other]) {
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [laura, id]);
  }
});

describe("gw_set_present", () => {
  it("una spunta per iscrizione (la coppia è una); lo stato non cambia; storico; si toglie", async () => {
    const b = await register(["Aster", "Bruma"]);
    const before = await bookingRow(b);
    expect(before.present).toBe(false);

    const version = await setPresent(b, before.version, true, ale);
    expect(version).toBe(before.version + 1);
    expect(await bookingRow(b)).toEqual({ version, present: true, status: before.status });
    await setPresent(b, version, false);
    expect((await bookingRow(b)).present).toBe(false);

    const log = await t.rows<{ before: Record<string, unknown>; after: Record<string, unknown> }>(
      `select before, after from gw_audit_log where entity = 'booking' and entity_id = $1 and after ? 'present' and after - 'present' = '{}'::jsonb order by id`,
      [b],
    );
    expect(log.map((row) => [row.before.present, row.after.present])).toEqual([
      [false, true],
      [true, false],
    ]);
  });

  it("versione vecchia → conflitto; Presente solo sulle confermate (togliere sempre); inesistente → non trovato", async () => {
    const b = await register(["Cedro"]);
    const { version } = await bookingRow(b);
    await setPresent(b, version, true);
    expect((await t.error(`select gw_set_present('${laura}', '${b}', ${version}, false)`))?.code).toBe("GW409");

    const interested = await register(["Dalia"], w, "interessato");
    const row = await bookingRow(interested);
    const refused = await t.error(`select gw_set_present('${laura}', '${interested}', ${row.version}, true)`);
    expect(refused?.code).toBe("GW400");
    expect(refused?.detail).toContain("solo sulle iscrizioni confermate");
    expect(await setPresent(interested, row.version, false)).toBe(row.version + 1);

    expect((await t.error(`select gw_set_present('${laura}', gen_random_uuid(), 1, true)`))?.code).toBe("GW404");
  });
});

describe("gw_audit_list", () => {
  it("admin: dal più recente, con operatore, tipo, workshop e persona; filtri e paginazione", async () => {
    const b = await register(["Elio"], other);
    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [
      ale,
      b,
      JSON.stringify({ kind: "pagamento", amount_cents: 25000, payment_type: "acconto", method: "paypal", paid_on: "2027-01-20", received_by: "redsabbath" }),
    ]);
    await t.value(`select gw_create_expense($1, $2, $3::jsonb) v`, [
      laura,
      other,
      JSON.stringify({ description: "Sala prove", amount_cents: 5000, advanced_by: "peony", spent_on: "2027-01-21", category: "sala" }),
    ]);

    const all = await list();
    expect(all.length).toBeGreaterThan(5);
    expect(all.map((row) => row.id)).toEqual([...all.map((row) => row.id)].sort((x, y) => y - x));
    expect(all[0].total).toBe(all.length);

    const payments = await list({ kind: "pagamenti", workshop: other });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ entity: "payment", action: "insert", operator_name: "Ale Prova", operator_role: "organizzatrice", workshop_name: "Luxuria altro", subject: "Elio" });

    const expenses = await list({ kind: "spese" });
    expect(expenses).toHaveLength(1);
    expect(expenses[0]).toMatchObject({ operator_name: "Laura Prova", workshop_id: other });

    // Operatore: solo le sue righe.
    expect((await list({ operator: ale })).every((row) => row.operator_name === "Ale Prova")).toBe(true);

    // Persona: la scheda (creata dall'abbinamento), le sue iscrizioni e i loro pagamenti.
    const elio = await t.value<string>(`select person_id v from gw_booking_participants where booking_id = $1`, [b]);
    const ofElio = await list({ person: elio });
    expect(new Set(ofElio.map((row) => row.entity))).toEqual(new Set(["person", "booking", "payment"]));
    expect(ofElio.filter((row) => row.entity !== "person").every((row) => row.workshop_id === other)).toBe(true);
    expect(ofElio.every((row) => row.subject === "Elio")).toBe(true);

    // Paginazione.
    const page = await list({ offset: 2, limit: 3 });
    expect(page.map((row) => row.id)).toEqual(all.slice(2, 5).map((row) => row.id));
    expect(page[0].total).toBe(all.length);
  });

  it("organizzatrice: solo iscrizioni, pagamenti, spese, trasferimenti, riporti e stato dei conti; persone solo come entered_as", async () => {
    const b = await register(["Frassino Rossi"], other);
    const person = await t.value<string>(`select person_id v from gw_booking_participants where booking_id = $1`, [b]);
    // Un admin completa la scheda: per Ale non deve comparire niente di questo.
    await t.value(`select gw_update_person($1, $2, (select version from gw_people where id = $2), $3::jsonb) v`, [
      laura,
      person,
      JSON.stringify({ first_name: "Frassino", last_name: "Rossi-Verdi", email: "frassino.segreto@example.test" }),
    ]);
    // Cambio del prezzo del workshop (non è lo stato dei conti) e verifica del consuntivo (sì).
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"capacity": 12}'::jsonb) v`, [laura, other]);
    await t.value(`select gw_set_settlement_status($1, $2, (select version from gw_workshops where id = $2), 'verificato', '{"ricavi": 0}'::jsonb) v`, [ale, other]);

    const rows = await list({ role: "organizzatrice", limit: 200 });
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.kind))).toEqual(new Set(["iscrizioni", "pagamenti", "spese", "conti"]));
    // Mai il nome di chi ha fatto la modifica, solo il ruolo.
    expect(rows.every((row) => row.operator_name === null && row.operator_role !== null)).toBe(true);
    // Del workshop solo lo stato dei conti.
    const workshopRows = rows.filter((row) => row.entity === "workshop");
    expect(workshopRows).toHaveLength(1);
    expect(workshopRows[0].after).toMatchObject({ settlement_status: "verificato" });
    expect(Object.keys(workshopRows[0].after ?? {}).every((key) => ["settlement_status", "verified_at"].includes(key))).toBe(true);
    // Persone: solo il testo scritto da Ale; niente schede, abbinamenti, id.
    const text = JSON.stringify(rows);
    expect(text).not.toContain("frassino.segreto@example.test");
    expect(text).not.toContain("Rossi-Verdi");
    for (const key of ["person_id", "match_status", "association_member_id", "membership_email", "possible_duplicate_person_id", "verified_snapshot"]) {
      expect(text).not.toContain(`"${key}"`);
    }
    expect(rows.filter((row) => row.entity === "booking" && row.workshop_id === other).every((row) => row.subject === null || ["Elio", "Frassino Rossi"].includes(row.subject))).toBe(true);

    // Filtri riservati agli admin: ignorati (persona) o rifiutati (tipo non suo → nessuna riga).
    expect(await list({ role: "organizzatrice", kind: "anagrafica" })).toEqual([]);
    expect(await list({ role: "organizzatrice", kind: "accessi" })).toEqual([]);
    expect((await list({ role: "organizzatrice", person, limit: 200 })).length).toBe(rows.length);
  });

  it("accessi: login e logout senza token né hash; nessuna riga di storico contiene PIN, hash o token", async () => {
    const token = "ab".repeat(32);
    const ip = "cd".repeat(32);
    const session = await t.value<string>(`select gw_login_succeeded($1, $2, $3, 'test', now() + interval '30 days') v`, [laura, token, ip]);
    await t.value(`select gw_logout($1, $2) v`, [laura, session]);
    // Cambio PIN da script: lo storico dice solo "PIN cambiato".
    await t.value(`select out_operator_id v from gw_set_operator_pin(null, 'Laura Prova', 'scrypt$32768$8$1$sale$hash-segreto')`);

    const access = await list({ kind: "accessi" });
    expect(access.map((row) => row.action)).toEqual(expect.arrayContaining(["login", "logout", "update"]));

    // D7: le note fiscali di Ale non entrano nello storico (al più la chiave vuota della riga del workshop).
    await t.value(`select gw_set_tax_notes($1, $2, (select version from gw_workshops where id = $2), 'nota-fiscale-segreta') v`, [ale, w]);

    const everything = JSON.stringify(await t.rows(`select before, after from gw_audit_log`));
    for (const secret of [token, ip, "hash-segreto", "scrypt$", "nota-fiscale-segreta"]) expect(everything).not.toContain(secret);
    for (const key of ["pin_hash", "token_hash", "ip_hash"]) expect(everything).not.toContain(`"${key}"`);
    // La lettura dello storico non restituisce nemmeno la chiave.
    expect(JSON.stringify(await list({ limit: 200 }))).not.toContain("personal_tax_notes");
    expect(JSON.stringify(await list({ role: "organizzatrice", limit: 200 }))).not.toContain("personal_tax_notes");

    // Difesa in profondità: anche se una riga le contenesse, la lettura le toglie.
    await t.db.exec(`insert into gw_audit_log (operator_id, entity, entity_id, action, after)
                     values (null, 'operator', gen_random_uuid(), 'update', '{"pin_hash": "x", "token_hash": "y", "ok": true}')`);
    const [latest] = await list({ kind: "accessi", limit: 1 });
    expect(latest.after).toEqual({ ok: true });
  });

  it("le funzioni non sono eseguibili da anon e authenticated", async () => {
    for (const fn of [
      "gw_set_present(uuid, uuid, integer, boolean)",
      "gw_audit_organizer_view(jsonb)",
      "gw_audit_list(gw_operator_role, uuid, uuid, text, uuid, integer, integer)",
    ]) {
      for (const role of ["anon", "authenticated"]) {
        expect(await t.value<boolean>(`select has_function_privilege($1, $2, 'execute') v`, [role, fn])).toBe(false);
      }
      expect(await t.value<boolean>(`select has_function_privilege('service_role', $1, 'execute') v`, [fn])).toBe(true);
    }
  });

  it("rollback e riapplicazione", async () => {
    await t.db.exec(readMigration("027_gw_functions_v5", "down"));
    expect(await t.value(`select to_regprocedure('public.gw_audit_list(gw_operator_role, uuid, uuid, text, uuid, integer, integer)') v`)).toBeNull();
    expect(await t.value<number>(`select count(*)::int v from information_schema.columns where table_name = 'gw_bookings' and column_name = 'present'`)).toBe(0);
    await t.db.exec(readMigration("027_gw_functions_v5"));
    expect(await t.value<boolean>(`select bool_and(not present) v from gw_bookings`)).toBe(true);
    expect((await t.error(readMigration("027_gw_functions_v5")))?.message).toContain("sembra già applicata");
  });
});
