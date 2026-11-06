// Migrazione 018: consuntivo (spese con categoria, trasferimenti, riporti,
// percentuale, perdita, stato con snapshot, note fiscali, export) e rollback.
// Solo PGlite, mai il database reale. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w: string;
let w2: string;

const version = (id: string, table = "gw_workshops") => t.value<number>(`select version v from ${table} where id = $1`, [id]);

async function audit(entity: string, id: string) {
  return t.rows<{ action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null }>(
    `select action::text, before, after from gw_audit_log where entity = $1 and entity_id = $2 order by id`,
    [entity, id],
  );
}

beforeAll(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Admin Conti");
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000181', 'Luxuria conti', '2026-11-14', null) v`, [op]);
  w2 = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000182', 'Luxuria dopo', '2027-02-14', null) v`, [op]);
});

describe("spese", () => {
  it("categoria (default 'altro'), modifica ed eliminazione con storico", async () => {
    const id = await t.value<string>(
      `select gw_create_expense($1, $2, '{"description": "Volo", "amount_cents": 12050, "advanced_by": "peony", "category": "viaggi"}'::jsonb) v`,
      [op, w],
    );
    const other = await t.value<string>(
      `select gw_create_expense($1, $2, '{"description": "Varie", "amount_cents": 500, "advanced_by": "redsabbath", "spent_on": "2026-11-15"}'::jsonb) v`,
      [op, w],
    );
    expect(await t.rows(`select category::text, spent_on::text from gw_expenses where id in ($1, $2) order by amount_cents desc`, [id, other])).toEqual([
      { category: "viaggi", spent_on: null },
      { category: "altro", spent_on: "2026-11-15" },
    ]);

    const v = await t.value<number>(
      `select gw_update_expense($1, $2, 1, '{"description": "Volo A/R", "amount_cents": 24000, "advanced_by": "redsabbath", "category": "viaggi"}'::jsonb) v`,
      [op, id],
    );
    expect(v).toBe(2);
    expect((await t.error(`select gw_update_expense('${op}', '${id}', 1, '{"description": "x", "amount_cents": 1, "advanced_by": "peony"}'::jsonb)`))?.code).toBe("GW409");
    expect((await t.error(`select gw_create_expense('${op}', '${w}', '{"description": "x", "amount_cents": 0, "advanced_by": "peony"}'::jsonb)`))?.code).toBe("23514");
    expect((await t.error(`select gw_create_expense('${op}', '${w}', '{"description": "x", "amount_cents": 1, "advanced_by": "peony", "category": "tasse"}'::jsonb)`))?.code).toBe("22P02");

    await t.value(`select gw_delete_expense($1, $2, 2) v`, [op, id]);
    expect(await t.value(`select count(*)::int v from gw_expenses where id = $1 and deleted_at is null`, [id])).toBe(0);
    const log = await audit("expense", id);
    expect(log.map((r) => r.action)).toEqual(["insert", "update", "delete"]);
    expect(log[2].before).toMatchObject({ description: "Volo A/R", amount_cents: 24000, category: "viaggi" });
  });
});

describe("trasferimenti e riporti", () => {
  it("trasferimento eseguito con data (oggi se manca), da eseguire → eseguito, eliminazione", async () => {
    const done = await t.value<string>(
      `select gw_create_transfer($1, $2, '{"from_party": "redsabbath", "to_party": "peony", "amount_cents": 50000, "status": "eseguito"}'::jsonb) v`,
      [op, w],
    );
    expect(await t.value(`select (executed_on is not null) v from gw_transfers where id = $1`, [done])).toBe(true);

    const pending = await t.value<string>(
      `select gw_create_transfer($1, $2, '{"from_party": "redsabbath", "to_party": "peony", "amount_cents": 45000, "executed_on": "2026-11-20"}'::jsonb) v`,
      [op, w],
    );
    expect(await t.rows(`select status::text, executed_on from gw_transfers where id = $1`, [pending])).toEqual([{ status: "da_eseguire", executed_on: null }]);
    await t.value(`select gw_set_transfer_executed($1, $2, 1, '2026-11-21') v`, [op, pending]);
    expect(await t.rows(`select status::text, executed_on::text from gw_transfers where id = $1`, [pending])).toEqual([
      { status: "eseguito", executed_on: "2026-11-21" },
    ]);
    expect((await t.error(`select gw_create_transfer('${op}', '${w}', '{"from_party": "peony", "to_party": "peony", "amount_cents": 1}'::jsonb)`))?.code).toBe("23514");

    await t.value(`select gw_delete_transfer($1, $2, 2) v`, [op, pending]);
    expect((await audit("transfer", pending)).map((r) => r.action)).toEqual(["insert", "update", "delete"]);
  });

  it("riporto: origine ≠ destinazione, workshop esistenti; eliminazione con storico", async () => {
    const id = await t.value<string>(
      `select gw_create_carryover($1, $2::jsonb) v`,
      [op, JSON.stringify({ origin_workshop_id: w, destination_workshop_id: w2, debtor: "redsabbath", creditor: "peony", amount_cents: 95000 })],
    );
    expect(await t.value(`select count(*)::int v from gw_carryovers where id = $1`, [id])).toBe(1);
    const same = JSON.stringify({ origin_workshop_id: w, destination_workshop_id: w, debtor: "redsabbath", creditor: "peony", amount_cents: 1 });
    expect((await t.error(`select gw_create_carryover($1, $2::jsonb)`, [op, same]))?.code).toBe("GW400");
    const missing = JSON.stringify({ origin_workshop_id: w, destination_workshop_id: "00000000-0000-4000-8000-000000000999", debtor: "peony", creditor: "redsabbath", amount_cents: 1 });
    expect((await t.error(`select gw_create_carryover($1, $2::jsonb)`, [op, missing]))?.code).toBe("GW400");

    await t.value(`select gw_delete_carryover($1, $2, 1) v`, [op, id]);
    expect((await audit("carryover", id)).map((r) => r.action)).toEqual(["insert", "delete"]);
  });
});

describe("ripartizione e stato del consuntivo", () => {
  it("percentuale (0–100) e perdita sostenuta da Peony (≥ 0 o null), con storico", async () => {
    await t.value(`select gw_set_peony_pct($1, $2, $3, 40.5) v`, [op, w, await version(w)]);
    expect(Number(await t.value(`select peony_pct v from gw_workshops where id = $1`, [w]))).toBe(40.5);
    expect((await t.error(`select gw_set_peony_pct('${op}', '${w}', ${await version(w)}, 101)`))?.code).toBe("GW400");

    await t.value(`select gw_set_loss_peony($1, $2, $3, 10000) v`, [op, w, await version(w)]);
    expect((await t.error(`select gw_set_loss_peony('${op}', '${w}', ${await version(w)}, -1)`))?.code).toBe("GW400");
    await t.value(`select gw_set_loss_peony($1, $2, $3, null) v`, [op, w, await version(w)]);
    expect(await t.value(`select loss_peony_cents v from gw_workshops where id = $1`, [w])).toBeNull();
    const log = await audit("workshop", w);
    expect(log.some((r) => r.after && "peony_pct" in r.after && Number(r.after.peony_pct) === 40.5)).toBe(true);
    expect(log.some((r) => r.after && r.after.loss_peony_cents === 10000)).toBe(true);
  });

  it("Verificato salva lo snapshot; dalla 024 solo Provvisorio e Verificato (D24); Provvisorio sempre (toglie lo snapshot)", async () => {
    const snapshot = JSON.stringify({ ricavi: 100000, residuo: 95000 });
    expect((await t.error(`select gw_set_settlement_status('${op}', '${w}', ${await version(w)}, 'da_conguagliare', null)`))?.code).toBe("GW400");
    expect((await t.error(`select gw_set_settlement_status('${op}', '${w}', ${await version(w)}, 'verificato', null)`))?.code).toBe("GW400");

    await t.value(`select gw_set_settlement_status($1, $2, $3, 'verificato', $4::jsonb) v`, [op, w, await version(w), snapshot]);
    expect(await t.rows(`select settlement_status::text, verified_snapshot, verified_by = $2 by_op, verified_at is not null at from gw_workshops where id = $1`, [w, op])).toEqual([
      { settlement_status: "verificato", verified_snapshot: { ricavi: 100000, residuo: 95000 }, by_op: true, at: true },
    ]);
    // D24: "Da conguagliare" e "Conguagliato" non sono più stati da premere.
    expect((await t.error(`select gw_set_settlement_status('${op}', '${w}', ${await version(w)}, 'conguagliato', null)`))?.code).toBe("GW400");
    expect((await t.error(`select gw_set_settlement_status('${op}', '${w}', ${await version(w)}, 'da_conguagliare', null)`))?.code).toBe("GW400");
    expect(await t.value(`select verified_snapshot v from gw_workshops where id = $1`, [w])).toEqual({ ricavi: 100000, residuo: 95000 });

    // Nessuno stato blocca le modifiche.
    await t.value(
      `select gw_create_expense($1, $2, '{"description": "Dopo il conguaglio", "amount_cents": 100, "advanced_by": "peony"}'::jsonb) v`,
      [op, w],
    );

    await t.value(`select gw_set_settlement_status($1, $2, $3, 'provvisorio', null) v`, [op, w, await version(w)]);
    expect(await t.rows(`select settlement_status::text, verified_snapshot, verified_at from gw_workshops where id = $1`, [w])).toEqual([
      { settlement_status: "provvisorio", verified_snapshot: null, verified_at: null },
    ]);
    expect((await t.error(`select gw_set_settlement_status('${op}', '${w}', 1, 'provvisorio', null)`))?.code).toBe("GW409");
  });
});

describe("note fiscali (D7) e storico", () => {
  it("lo storico non contiene il testo delle note, nemmeno quando cambiano le impostazioni", async () => {
    await t.value(`select gw_set_tax_notes($1, $2, $3, 'IVA segreta 1234') v`, [op, w, await version(w)]);
    expect(await t.value(`select personal_tax_notes v from gw_workshops where id = $1`, [w])).toBe("IVA segreta 1234");
    await t.value(`select gw_update_workshop_settings($1, $2, $3, '{"default_fee_cents": 45000, "peony_pct": 30}'::jsonb) v`, [op, w, await version(w)]);
    const log = JSON.stringify(await audit("workshop", w));
    expect(log).not.toContain("IVA segreta");
    expect(log).toContain('"personal_tax_notes":"modificate"');
  });

  it("export registrato con l'azione 'export'", async () => {
    await t.value(`select gw_log_export($1, $2, 'xlsx') v`, [op, w]);
    await t.value(`select gw_log_export($1, $2, 'stampa') v`, [op, w]);
    expect((await t.error(`select gw_log_export('${op}', '${w}', 'csv')`))?.code).toBe("GW400");
    const exports = (await audit("workshop", w)).filter((r) => r.action === "export");
    expect(exports.map((r) => r.after)).toEqual([{ consuntivo: "xlsx" }, { consuntivo: "stampa" }]);
  });

  it("funzioni nuove non eseguibili da anon/authenticated", async () => {
    const exposed = await t.rows(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'gw\\_%'
          and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`,
    );
    expect(exposed).toEqual([]);
  });
});

describe("rollback", () => {
  it("toglie funzioni e categoria, lascia le spese; si può riapplicare", async () => {
    const t2 = await createTestDb(MIGRATIONS);
    const op2 = await t2.operator();
    const w3 = await t2.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000183', 'Luxuria rb', '2026-11-14', null) v`, [op2]);
    await t2.value(`select gw_create_expense($1, $2, '{"description": "Sala", "amount_cents": 1000, "advanced_by": "peony", "category": "sala"}'::jsonb) v`, [op2, w3]);
    await t2.value(`select gw_log_export($1, $2, 'xlsx') v`, [op2, w3]);

    expect((await t2.error(readMigration("018_gw_consuntivo_v4")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});

    await t2.db.exec(readMigration("018_gw_consuntivo_v4", "down"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname in ('gw_create_expense', 'gw_log_export', 'gw_set_tax_notes')`)).toBe(0);
    expect(await t2.value(`select count(*)::int v from information_schema.columns where table_name = 'gw_expenses' and column_name = 'category'`)).toBe(0);
    expect(await t2.value(`select count(*)::int v from gw_expenses`)).toBe(1);
    expect(await t2.value(`select count(*)::int v from gw_audit_log where action::text = 'export'`)).toBe(1);
    // gw_update_workshop_settings come in 015.
    await t2.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 1000}'::jsonb) v`, [op2, w3]);

    await t2.db.exec(readMigration("018_gw_consuntivo_v4"));
    expect(await t2.value(`select category::text v from gw_expenses limit 1`)).toBe("altro");
  });
});
