// Migrazione 025: anteprima del box di testo a moduli per persona, ogni
// pagamento con il suo "Incassato da". Solo PGlite, mai il database reale.
// Dati inventati.

import { beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w: string;

const row = (payments: unknown[]) =>
  JSON.stringify([{ people: ["Brina"], status: "prenotato", fee_cents: null, invoice_status: "non_richiesta", notes: null, payments }]);
const received = () =>
  t.rows(`select amount_cents::int, payment_type::text, paid_on::text, received_by::text from gw_payments order by paid_on, received_by`);

beforeEach(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Ale Prova");
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000251', 'Luxuria 025', '2026-11-14', null) v`, [op]);
  await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [op, w]);
});

describe("025 — gw_import_roster: data e Incassato da di ogni pagamento", () => {
  it("due pagamenti con lo stesso importo, ognuno con la sua data e chi ha incassato", async () => {
    const payments = [
      { amount_cents: 20000, payment_type: "acconto", method: "paypal", paid_on: "2026-10-20", received_by: "peony" },
      { amount_cents: 20000, payment_type: "saldo", method: "contanti", paid_on: "2026-10-28", received_by: "redsabbath" },
    ];
    expect(await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, row(payments)])).toEqual({ created: 1, updated: 0, payments: 2 });
    expect(await received()).toEqual([
      { amount_cents: 20000, payment_type: "acconto", paid_on: "2026-10-20", received_by: "peony" },
      { amount_cents: 20000, payment_type: "saldo", paid_on: "2026-10-28", received_by: "redsabbath" },
    ]);
  });

  it("senza received_by vale quello comune, come prima", async () => {
    const payments = [{ amount_cents: 5000, payment_type: "acconto", method: "contanti", paid_on: "2026-10-21" }];
    await t.value(`select gw_import_roster($1, $2, null, 'peony', $3::jsonb) v`, [op, w, row(payments)]);
    expect(await received()).toEqual([{ amount_cents: 5000, payment_type: "acconto", paid_on: "2026-10-21", received_by: "peony" }]);
  });

  it("il rollback torna alla 024 (Incassato da comune); si può riapplicare", async () => {
    const payments = [{ amount_cents: 5000, payment_type: "acconto", method: "contanti", paid_on: "2026-10-21", received_by: "peony" }];
    await t.db.exec(readMigration("025_gw_anteprima_moduli", "down"));
    await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, row(payments)]);
    expect((await received())[0]).toMatchObject({ received_by: "redsabbath" });
    await t.db.exec(readMigration("025_gw_anteprima_moduli"));
    await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, row([{ ...payments[0], paid_on: "2026-10-22" }])]);
    expect((await received())[1]).toMatchObject({ paid_on: "2026-10-22", received_by: "peony" });
  });

  it("si ferma se la 024 non è applicata", async () => {
    const before = await createTestDb(MIGRATIONS.slice(0, MIGRATIONS.indexOf("024_gw_correzioni_revisione")));
    expect((await before.error(readMigration("025_gw_anteprima_moduli")))?.message).toContain("applica prima 024");
  });
});
