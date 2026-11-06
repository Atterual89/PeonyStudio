// Migrazione 010: schema, vincoli, permessi, funzioni di autenticazione, rollback.

import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;

beforeAll(async () => {
  t = await createTestDb(["010_gw_schema_v1"]);
  op = await t.operator("Aurora");
});

describe("010 — applicazione e controllo iniziale", () => {
  it("una seconda applicazione si ferma con un messaggio", async () => {
    const err = await t.error(readMigration("010_gw_schema_v1"));
    expect(err?.message).toContain("esistono già tabelle gw_");
    await t.db.exec("rollback").catch(() => {});
  });
});

describe("010 — sicurezza", () => {
  it("anon e authenticated senza privilegi; service_role sì", async () => {
    expect(await t.value(`select has_table_privilege('anon','public.gw_people','select') v`)).toBe(false);
    expect(await t.value(`select has_table_privilege('authenticated','public.gw_payments','insert') v`)).toBe(false);
    expect(await t.value(`select has_table_privilege('service_role','public.gw_people','select,insert,update,delete') v`)).toBe(true);
    expect(await t.value(`select has_function_privilege('anon','public.gw_set_operator_pin(uuid,text,text)','execute') v`)).toBe(false);
    expect(await t.value(`select has_function_privilege('service_role','public.gw_logout(uuid,uuid)','execute') v`)).toBe(true);
  });

  it("RLS attiva su tutte le tabelle gw_, nessuna policy", async () => {
    const [rls] = await t.rows<{ tutte: boolean; n: number }>(
      `select bool_and(relrowsecurity) tutte, count(*)::int n from pg_class where relname like 'gw\\_%' and relkind = 'r'`,
    );
    expect(rls).toEqual({ tutte: true, n: 14 });
    expect(await t.value(`select count(*)::int v from pg_policies where tablename like 'gw\\_%'`)).toBe(0);
  });
});

describe("010 — operatori e sessioni", () => {
  it("cambio PIN: revoca le sessioni; nome unico senza maiuscole", async () => {
    const session = await t.value<string>(
      `select gw_login_succeeded($1, $2, 'ip', 'UA', now() + interval '30 days') v`,
      [op, "a".repeat(64)],
    );
    const [again] = await t.rows<{ out_created: boolean; out_revoked_sessions: number }>(
      `select * from gw_set_operator_pin(null, ' aurora ', 'scrypt$32768$8$1$x$y')`,
    );
    expect(again).toMatchObject({ out_created: false, out_revoked_sessions: 1 });
    expect(await t.value(`select revoked_at is not null v from gw_sessions where id = $1`, [session])).toBe(true);
    expect((await t.error(`insert into gw_operators (display_name, pin_hash) values ('AURORA', 'scrypt$x')`))?.code).toBe("23505");
  });

  it("sessione oltre 90 giorni rifiutata; storico senza hash né token", async () => {
    expect(
      await t.error(`insert into gw_sessions (operator_id, token_hash, expires_at) values ($1, $2, now() + interval '91 days')`, [
        op,
        "c".repeat(64),
      ]),
    ).not.toBeNull();
    expect(await t.value(`select count(*)::int v from gw_audit_log where coalesce(after::text, '') ~ '(scrypt|aaaa)'`)).toBe(0);
  });

  it("storico e tentativi di accesso in sola aggiunta", async () => {
    expect((await t.error(`update gw_audit_log set entity = 'x'`))?.message).toContain("append-only");
    expect((await t.error(`delete from gw_login_attempts`))?.message).toContain("append-only");
  });
});

describe("010 — vincoli del modello", () => {
  it("pagamenti: segno coerente, importi non modificabili, niente DELETE, rettifica collegata", async () => {
    const w = await t.value<string>(`insert into gw_workshops (name, starts_on) values ('W', '2026-11-01') returning id v`);
    const b = await t.value<string>(`insert into gw_bookings (workshop_id) values ($1) returning id v`, [w]);
    const pay = await t.value<string>(
      `insert into gw_payments (booking_id, kind, amount_cents, paid_on, received_by) values ($1, 'pagamento', 25000, '2026-10-01', 'redsabbath') returning id v`,
      [b],
    );
    expect(await t.error(`insert into gw_payments (booking_id, kind, amount_cents, paid_on, received_by) values ($1, 'pagamento', -5, '2026-10-01', 'peony')`, [b])).not.toBeNull();
    expect((await t.error(`update gw_payments set amount_cents = 1 where id = $1`, [pay]))?.message).toContain("non sono modificabili");
    expect((await t.error(`delete from gw_payments where id = $1`, [pay]))?.message).toContain("non si cancellano");
    expect(await t.error(`update gw_payments set description = 'nota' where id = $1`, [pay])).toBeNull();
    expect(
      await t.error(
        `insert into gw_payments (booking_id, kind, amount_cents, paid_on, received_by, corrects_payment_id) values ($1, 'rettifica', -25000, '2026-10-02', 'redsabbath', $2)`,
        [b, pay],
      ),
    ).toBeNull();
  });

  it("override soci unico per persona e anno; association_member_id senza FK", async () => {
    const p = await t.value<string>(`insert into gw_people (nickname) values ('Nebbia') returning id v`);
    await t.db.query(`insert into gw_membership_overrides (person_id, year, status) values ($1, 2026, 'in_regola')`, [p]);
    expect((await t.error(`insert into gw_membership_overrides (person_id, year, status) values ($1, 2026, 'non_associato')`, [p]))?.code).toBe("23505");
    expect(await t.error(`update gw_people set association_member_id = gen_random_uuid() where id = $1`, [p])).toBeNull();
  });
});

describe("010 — rollback", () => {
  it("elimina tutti e soli gli oggetti gw_, poi si riapplica", async () => {
    const fresh = await createTestDb(["010_gw_schema_v1"]);
    await fresh.db.exec(readMigration("010_gw_schema_v1", "down"));
    expect(await fresh.value(`select count(*)::int v from pg_class where relname like 'gw\\_%'`)).toBe(0);
    expect(await fresh.value(`select count(*)::int v from pg_type where typname like 'gw\\_%'`)).toBe(0);
    expect(await fresh.value(`select count(*)::int v from pg_proc where proname like 'gw\\_%'`)).toBe(0);
    expect(await fresh.value(`select count(*)::int v from public.events`)).toBe(1);
    await fresh.db.exec(readMigration("010_gw_schema_v1"));
  });
});
