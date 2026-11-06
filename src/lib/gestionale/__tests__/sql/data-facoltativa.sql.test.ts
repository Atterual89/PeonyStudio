// Migrazione 026: data del pagamento facoltativa. Solo PGlite, mai il
// database reale. Dati inventati.

import { beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w: string;
let b: string;

const payment = (paidOn: string | null) =>
  JSON.stringify({ kind: "pagamento", amount_cents: 10000, payment_type: "acconto", method: "paypal", paid_on: paidOn, received_by: "redsabbath" });
const dates = () => t.rows(`select kind::text, amount_cents::int, paid_on::text from gw_payments order by created_at, id`);

beforeEach(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Ale Prova");
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000261', 'Luxuria 026', '2026-11-14', null) v`, [op]);
  await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [op, w]);
  b = await t.value<string>(`select gw_create_booking_entered($1, $2, '["Brina"]'::jsonb, 'prenotato', null, null) v`, [op, w]);
});

describe("026 — data del pagamento facoltativa", () => {
  it("un pagamento senza data si salva (paid_on nullo) e aggiorna lo stato", async () => {
    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, b, payment(null)]);
    expect(await dates()).toEqual([{ kind: "pagamento", amount_cents: 10000, paid_on: null }]);
    expect(await t.value(`select status::text v from gw_bookings where id = $1`, [b])).toBe("acconto");
  });

  it("Incassato da resta obbligatorio", async () => {
    const noParty = JSON.stringify({ kind: "pagamento", amount_cents: 10000, payment_type: "acconto", paid_on: null });
    expect((await t.error(`select gw_add_payment($1, $2, $3::jsonb)`, [op, b, noParty]))?.detail).toBe("Incassato da è obbligatorio.");
  });

  it("Modifica: data vuota = senza data; data assente = quella dell'originale", async () => {
    const id = await t.value<string>(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, b, payment("2026-10-20")]);
    const cleared = await t.value<string>(`select gw_correct_payment($1, $2, $3::jsonb, 'Modifica') v`, [
      op,
      id,
      JSON.stringify({ amount_cents: 12000, method: "paypal", paid_on: null, received_by: "redsabbath" }),
    ]);
    expect(cleared).toBeTruthy();
    const replacement = await t.value<string>(`select id v from gw_payments where kind = 'pagamento' and amount_cents = 12000`);
    expect(await t.value(`select paid_on::text v from gw_payments where id = $1`, [replacement])).toBeNull();

    await t.value(`select gw_correct_payment($1, $2, $3::jsonb, 'Modifica') v`, [
      op,
      replacement,
      JSON.stringify({ amount_cents: 13000, method: "paypal", received_by: "redsabbath" }),
    ]);
    expect(await t.value(`select paid_on::text v from gw_payments where kind = 'pagamento' and amount_cents = 13000`)).toBeNull();

    const dated = await t.value<string>(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, b, payment("2026-10-22")]);
    await t.value(`select gw_correct_payment($1, $2, $3::jsonb, 'Modifica') v`, [
      op,
      dated,
      JSON.stringify({ amount_cents: 9000, method: "paypal", received_by: "redsabbath" }),
    ]);
    expect(await t.value(`select paid_on::text v from gw_payments where kind = 'pagamento' and amount_cents = 9000`)).toBe("2026-10-22");
  });

  it("box di testo e rimborso senza data", async () => {
    const rows = JSON.stringify([
      { people: ["Corvo"], status: "prenotato", fee_cents: null, invoice_status: "non_richiesta", notes: null, payments: [{ amount_cents: 5000, payment_type: "acconto", method: null }] },
    ]);
    expect(await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, rows])).toEqual({ created: 1, updated: 0, payments: 1 });

    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, b, payment("2026-10-20")]);
    await t.value(`select gw_update_registration($1, $2, (select version from gw_bookings where id = $2), 'cancellato', null, 'non_richiesta') v`, [op, b]);
    expect(await t.value(`select gw_refund_booking($1, $2, 10000, null, null, null) v`, [op, b])).toBe(1);
    expect(await t.value(`select count(*)::int v from gw_payments where paid_on is null`)).toBe(2);
  });

  it("il rollback dà ai pagamenti senza data la data di inserimento; si può riapplicare", async () => {
    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, b, payment(null)]);
    await t.db.exec(readMigration("026_gw_data_pagamento_facoltativa", "down"));
    expect(await t.value(`select count(*)::int v from gw_payments where paid_on is null`)).toBe(0);
    expect(await t.value(`select count(*)::int v from gw_audit_log where after->>'nota' = 'rollback 026: data di inserimento'`)).toBe(1);
    expect((await t.error(`select gw_add_payment($1, $2, $3::jsonb)`, [op, b, payment(null)]))?.detail).toBe("Data e incassato da sono obbligatori.");

    await t.db.exec(readMigration("026_gw_data_pagamento_facoltativa"));
    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, b, payment(null)]);
    expect(await t.value(`select count(*)::int v from gw_payments where paid_on is null`)).toBe(1);
  });

  it("si ferma se la 024 non è applicata, o se è già applicata", async () => {
    const before = await createTestDb(MIGRATIONS.slice(0, MIGRATIONS.indexOf("024_gw_correzioni_revisione")));
    expect((await before.error(readMigration("026_gw_data_pagamento_facoltativa")))?.message).toContain("applica prima 024");
    expect((await t.error(readMigration("026_gw_data_pagamento_facoltativa")))?.message).toContain("sembra già applicata");
  });
});
