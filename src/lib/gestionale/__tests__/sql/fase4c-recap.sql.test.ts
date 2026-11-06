// Migrazione 021 (Fase 4c, D23): la lettura aggregata della home dà gli
// stessi numeri del tab Conti (buildAccounts) per lo stesso workshop. Solo
// PGlite. Dati inventati: coppie, rimborsi, pagamenti e spese eliminati,
// cancellati con soldi, lista d'attesa, utile negativo, workshop vuoto.

import { beforeAll, describe, expect, it } from "vitest";

import { buildAccounts } from "../../accounts";
import { toOverviewRow, workshopRecap, sumRecaps, type OverviewRecord } from "../../recap";
import type { Payment, Registration } from "../../types";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let a: string;
let b: string;
let empty: string;

const pay = (amount: number, receivedBy = "redsabbath", kind = "pagamento", method = "paypal") =>
  JSON.stringify({ kind, amount_cents: amount, payment_type: "acconto", method, paid_on: "2026-10-28", received_by: receivedBy });

async function register(workshop: string, entries: string[], status = "prenotato"): Promise<string> {
  return t.value<string>(`select gw_create_registration($1, $2, $3::jsonb, $4, null, null, null) v`, [op, workshop, JSON.stringify(entries), status]);
}
const addPayment = (booking: string, amount: number, receivedBy = "redsabbath", kind = "pagamento") =>
  t.value<string>(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, booking, pay(amount, receivedBy, kind)]);
const setStatus = async (booking: string, status: string) =>
  t.value(
    `select gw_update_registration($1, $2, (select version from gw_bookings where id = $2), $3, null, 'non_richiesta') v`,
    [op, booking, status],
  );
const expense = (workshop: string, amount: number, by = "peony") =>
  t.value<string>(`select gw_create_expense($1, $2, $3::jsonb) v`, [op, workshop, JSON.stringify({ description: "Spesa", amount_cents: amount, advanced_by: by })]);

/** Il tab Conti come lo costruisce il server: righe non eliminate, poi buildAccounts. */
async function accountsOf(workshop: string) {
  const bookings = await t.rows<{ id: string; status: Registration["status"]; agreed_fee_cents: number | null; fee_custom: boolean }>(
    `select id, status::text, agreed_fee_cents::int, fee_custom from gw_bookings where workshop_id = $1 and deleted_at is null order by created_at`,
    [workshop],
  );
  const registrations: Registration[] = [];
  for (const booking of bookings) {
    const payments = await t.rows<{ id: string; kind: Payment["kind"]; amount_cents: number; received_by: Payment["receivedBy"]; method: Payment["method"] }>(
      `select id, kind::text, amount_cents::int, received_by::text, method::text from gw_payments where booking_id = $1 and deleted_at is null`,
      [booking.id],
    );
    registrations.push({
      bookingId: booking.id,
      version: 1,
      status: booking.status,
      present: false,
      notes: null,
      invoiceStatus: "non_richiesta",
      agreedFeeCents: booking.agreed_fee_cents,
      feeCustom: booking.fee_custom,
      createdAt: "",
      createdByRole: "organizzatrice",
      people: [],
      payments: payments.map((p) => ({
        id: p.id,
        kind: p.kind,
        amountCents: p.amount_cents,
        paymentType: "acconto",
        paidOn: "2026-10-28",
        method: p.method,
        receivedBy: p.received_by,
        description: null,
        correctsPaymentId: null,
        createdAt: "",
      })),
    });
  }
  const settings = (await t.rows<{ peony_pct: string; loss_peony_cents: number | null }>(
    `select peony_pct::text, loss_peony_cents::int from gw_workshops where id = $1`,
    [workshop],
  ))[0];
  const expenses = await t.rows<{ id: string; amount_cents: number; advanced_by: "peony" | "redsabbath" }>(
    `select id, amount_cents::int, advanced_by::text from gw_expenses where workshop_id = $1 and deleted_at is null`,
    [workshop],
  );
  const transfers = await t.rows<{ id: string; amount_cents: number; from_party: "peony" | "redsabbath"; to_party: "peony" | "redsabbath"; status: "eseguito" | "da_eseguire" }>(
    `select id, amount_cents::int, from_party::text, to_party::text, status::text from gw_transfers where workshop_id = $1 and deleted_at is null`,
    [workshop],
  );
  const carryovers = await t.rows<{ id: string; amount_cents: number; debtor: "peony" | "redsabbath"; creditor: "peony" | "redsabbath"; origin_workshop_id: string }>(
    `select id, amount_cents::int, debtor::text, creditor::text, origin_workshop_id from gw_carryovers
      where $1 in (origin_workshop_id, destination_workshop_id) and deleted_at is null`,
    [workshop],
  );
  const toCarryover = (c: (typeof carryovers)[number]) => ({
    id: c.id,
    version: 1,
    otherWorkshop: { id: "x", name: "x" },
    debtor: c.debtor,
    creditor: c.creditor,
    amountCents: c.amount_cents,
    status: "aperto" as const,
    notes: null,
  });
  return buildAccounts({
    workshop: {
      id: workshop,
      version: 1,
      name: "x",
      startsOn: "2026-11-14",
      endsOn: null,
      peonyPct: Number(settings.peony_pct),
      lossPeonyCents: settings.loss_peony_cents,
      status: "provvisorio",
      verifiedSnapshot: null,
      verifiedAt: null,
      verifiedByRole: null,
    },
    registrations,
    expenses: expenses.map((e) => ({ id: e.id, version: 1, description: "Spesa", amountCents: e.amount_cents, advancedBy: e.advanced_by, category: "altro", spentOn: null, createdByRole: null })),
    transfers: transfers.map((x) => ({ id: x.id, version: 1, fromParty: x.from_party, toParty: x.to_party, amountCents: x.amount_cents, status: x.status, executedOn: null, notes: null })),
    carryoversIn: carryovers.filter((c) => c.origin_workshop_id !== workshop).map(toCarryover),
    carryoversOut: carryovers.filter((c) => c.origin_workshop_id === workshop).map(toCarryover),
  });
}

async function overview() {
  const records = await t.rows<OverviewRecord>(`select * from gw_economic_overview()`);
  return new Map(records.map((record) => [record.workshop_id, workshopRecap(toOverviewRow(record))]));
}

beforeAll(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Ale Prova");
  const ensure = (event: string, name: string, starts: string) =>
    t.value<string>(`select gw_ensure_workshop_for_event($1, $2, $3, $4, null) v`, [op, event, name, starts]);
  a = await ensure("eeeeeeee-0000-4000-8000-000000000211", "Luxuria recap A", "2026-11-14");
  b = await ensure("eeeeeeee-0000-4000-8000-000000000212", "Luxuria recap B", "2027-02-06");
  empty = await ensure("eeeeeeee-0000-4000-8000-000000000213", "Luxuria recap vuoto", "2026-12-12");
  for (const w of [a, b]) {
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 45000}'::jsonb) v`, [op, w]);
  }

  // A: coppia saldata (pagata da due parti), acconto, rimborso, pagamento
  // eliminato, cancellato con soldi, lista d'attesa, spesa eliminata,
  // trasferimento eseguito, riporto verso B.
  const couple = await register(a, ["Aster", "Brina"]);
  await addPayment(couple, 20000, "redsabbath");
  await addPayment(couple, 25000, "peony");
  const partial = await register(a, ["Corvo"]);
  await addPayment(partial, 30000);
  await addPayment(partial, 5000, "redsabbath", "rimborso");
  const wrong = await addPayment(partial, 9900);
  await t.value(`select gw_delete_payment($1, $2) v`, [op, wrong]);
  const cancelled = await register(a, ["Dalia"]);
  await addPayment(cancelled, 10000);
  await setStatus(cancelled, "cancellato");
  await register(a, ["Elio"], "lista_attesa");
  await expense(a, 12000, "peony");
  const deletedExpense = await expense(a, 50000, "redsabbath");
  await t.value(`select gw_delete_expense($1, $2, 1) v`, [op, deletedExpense]);
  await t.value(`select gw_create_transfer($1, $2, '{"from_party": "redsabbath", "to_party": "peony", "amount_cents": 3000, "status": "eseguito"}'::jsonb) v`, [op, a]);
  await t.value(`select gw_create_carryover($1, $2::jsonb) v`, [
    op,
    JSON.stringify({ origin_workshop_id: a, destination_workshop_id: b, debtor: "redsabbath", creditor: "peony", amount_cents: 1000 }),
  ]);

  // B: utile negativo.
  const solo = await register(b, ["Fiamma"]);
  await addPayment(solo, 45000);
  await expense(b, 60000, "peony");
});

describe("home = card = tab Conti", () => {
  it("stessi Entrate · Uscite · Rimane · Da incassare e stesso residuo per ogni workshop", async () => {
    const recaps = await overview();
    for (const w of [a, b, empty]) {
      const accounts = await accountsOf(w);
      const recap = recaps.get(w)!;
      expect({ entrate: recap.entrate, uscite: recap.uscite, rimane: recap.rimane, daIncassare: recap.daIncassare }).toEqual(accounts.recap);
      expect(recap.residuo).toBe(accounts.settlement.residuo);
    }
  });

  it("valori attesi: eliminati esclusi, cancellati con soldi inclusi, lista d'attesa fuori dal da incassare", async () => {
    const recaps = await overview();
    // Entrate A: 20000 + 25000 + 30000 − 5000 + 10000 (il pagamento eliminato non c'è).
    expect(recaps.get(a)).toMatchObject({ entrate: 80000, uscite: 12000, rimane: 68000, daIncassare: 20000, movimenti: true });
    expect(recaps.get(b)).toMatchObject({ entrate: 45000, uscite: 60000, rimane: -15000, daIncassare: 0, residuo: null });
    expect(recaps.get(empty)).toMatchObject({ entrate: 0, uscite: 0, rimane: 0, daIncassare: 0, movimenti: false });
  });

  it("totali: somma dei workshop", async () => {
    const recaps = await overview();
    expect(sumRecaps([...recaps.values()])).toMatchObject({ entrate: 125000, uscite: 72000, rimane: 53000, daIncassare: 20000 });
  });

  it("nessun dato di persone nella lettura aggregata", async () => {
    const records = await t.rows<Record<string, unknown>>(`select * from gw_economic_overview()`);
    expect(JSON.stringify(records)).not.toMatch(/Aster|Brina|entered_as|person|email/);
  });

  it("rollback e riapplicazione della 021", async () => {
    const t2 = await createTestDb(MIGRATIONS);
    expect((await t2.error(readMigration("021_gw_recap_economico")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});
    await t2.db.exec(readMigration("021_gw_recap_economico", "down"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname = 'gw_economic_overview'`)).toBe(0);
    await t2.db.exec(readMigration("021_gw_recap_economico"));
    expect(await t2.rows(`select * from gw_economic_overview()`)).toEqual([]);
  });
});
