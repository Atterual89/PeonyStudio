// Migrazione 019: iscrizione con il primo pagamento nella stessa transazione,
// box di testo con data e note per pagamento, "Modifica" = rettifica + nuovo
// movimento. Solo PGlite. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w: string;

const payment = (amount: number, type = "acconto") =>
  JSON.stringify({ amount_cents: amount, payment_type: type, method: "paypal", paid_on: "2026-10-01", received_by: "redsabbath", description: "primo" });

function register(status: string, pay: string | null, entries = '["Aster"]') {
  return t.value<string>(`select gw_create_registration($1, $2, $3::jsonb, $4, null, null, $5::jsonb) v`, [op, w, entries, status, pay]);
}

const statusOf = (id: string) => t.value<string>(`select status::text v from gw_bookings where id = $1`, [id]);

beforeAll(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Ale Prova");
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000191', 'Luxuria pagamenti', '2026-11-14', null) v`, [op]);
  await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 45000}'::jsonb) v`, [op, w]);
});

describe("gw_create_registration", () => {
  it("Acconto pagato / Saldato senza pagamento: rifiutato, niente salvato", async () => {
    const before = await t.value<number>(`select count(*)::int v from gw_bookings`);
    for (const status of ["acconto", "saldato"]) {
      expect((await t.error(`select gw_create_registration('${op}', '${w}', '["Nessuno"]'::jsonb, '${status}', null, null, null)`))?.detail).toContain(
        "registra il primo pagamento",
      );
    }
    expect(await t.value<number>(`select count(*)::int v from gw_bookings`)).toBe(before);
  });

  it("iscrizione e pagamento insieme; Saldato con pagamento parziale → Acconto pagato", async () => {
    const acconto = await register("acconto", payment(20000));
    expect(await statusOf(acconto)).toBe("acconto");
    expect(await t.rows(`select amount_cents::int, description from gw_payments where booking_id = $1`, [acconto])).toEqual([
      { amount_cents: 20000, description: "primo" },
    ]);

    const saldato = await register("saldato", payment(45000, "saldo"), '["Brina"]');
    expect(await statusOf(saldato)).toBe("saldato");
    const parziale = await register("saldato", payment(10000, "saldo"), '["Corvo"]');
    expect(await statusOf(parziale)).toBe("acconto");

    expect(await statusOf(await register("prenotato", null, '["Dalia"]'))).toBe("prenotato");
  });

  it("importo non valido: niente salvato (stessa transazione)", async () => {
    const before = await t.value<number>(`select count(*)::int v from gw_bookings`);
    expect((await t.error(`select gw_create_registration('${op}', '${w}', '["Elio"]'::jsonb, 'acconto', null, null, '{"amount_cents": 0, "paid_on": "2026-10-01", "received_by": "peony"}'::jsonb)`))?.code).toBe("GW400");
    expect(await t.value<number>(`select count(*)::int v from gw_bookings`)).toBe(before);
  });
});

describe("gw_import_roster (019)", () => {
  it("data e note per pagamento (altrimenti quelle comuni); riga Saldato senza pagamenti rifiutata", async () => {
    const rows = JSON.stringify([
      { people: ["Fiamma"], status: "saldato", payments: [{ amount_cents: 45000, payment_type: "saldo", method: "contanti", paid_on: "2026-09-28", description: "in sala" }] },
      { people: ["Gaia"], status: "prenotato", payments: [{ amount_cents: 10000, payment_type: "acconto", method: null }] },
    ]);
    await t.value(`select gw_import_roster($1, $2, '2026-10-05', 'redsabbath', $3::jsonb) v`, [op, w, rows]);
    expect(
      await t.rows(
        `select bp.entered_as, p.paid_on::text, p.description, b.status::text
           from gw_payments p join gw_bookings b on b.id = p.booking_id
           join gw_booking_participants bp on bp.booking_id = b.id
          where bp.entered_as in ('Fiamma', 'Gaia') order by bp.entered_as`,
      ),
    ).toEqual([
      { entered_as: "Fiamma", paid_on: "2026-09-28", description: "in sala", status: "saldato" },
      { entered_as: "Gaia", paid_on: "2026-10-05", description: "importazione testo", status: "acconto" },
    ]);

    const bad = JSON.stringify([{ people: ["Ilaria"], status: "saldato", payments: [] }]);
    expect((await t.error(`select gw_import_roster($1, $2, '2026-10-05', 'redsabbath', $3::jsonb)`, [op, w, bad]))?.code).toBe("GW400");
  });
});

describe("Modifica di un movimento", () => {
  it("rettifica + nuovo movimento nella stessa transazione, stesso istante (per l'elenco leggibile)", async () => {
    const b = await register("acconto", payment(20000), '["Lia"]');
    const original = await t.value<string>(`select id v from gw_payments where booking_id = $1`, [b]);
    await t.value(
      `select gw_correct_payment($1, $2, '{"amount_cents": 25000, "payment_type": "acconto", "method": "contanti", "paid_on": "2026-10-02", "received_by": "redsabbath"}'::jsonb, 'Modifica') v`,
      [op, original],
    );
    const rows = await t.rows<{ kind: string; amount_cents: number; same: boolean }>(
      `select kind::text, amount_cents::int,
              created_at = (select created_at from gw_payments where corrects_payment_id = $2) same
         from gw_payments where booking_id = $1 and id <> $2 order by kind`,
      [b, original],
    );
    expect(rows).toEqual([
      { kind: "pagamento", amount_cents: 25000, same: true },
      { kind: "rettifica", amount_cents: -20000, same: true },
    ]);
  });
});

describe("rollback 019", () => {
  it("toglie gw_create_registration, gw_import_roster torna come in 013; si può riapplicare", async () => {
    const t2 = await createTestDb(MIGRATIONS);
    expect((await t2.error(readMigration("019_gw_pagamenti_stato")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});
    await t2.db.exec(readMigration("019_gw_pagamenti_stato", "down"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname = 'gw_create_registration'`)).toBe(0);
    expect(await t2.value(`select count(*)::int v from pg_proc where proname = 'gw_import_roster'`)).toBe(1);
    await t2.db.exec(readMigration("019_gw_pagamenti_stato"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname = 'gw_create_registration'`)).toBe(1);
  });
});
