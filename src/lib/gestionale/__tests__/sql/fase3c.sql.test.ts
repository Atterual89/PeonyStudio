// Migrazione 015: ogni prenotazione segue la quota del workshop salvo tariffa
// dedicata (matita), sistemazione dei dati esistenti, rollback. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, readMigration, type TestDb } from "./pglite";

const ALL = [
  "010_gw_schema_v1",
  "011_gw_functions_v2",
  "012_gw_correzioni_v2b",
  "013_gw_ruoli_pagamenti_v3",
  "014_gw_correzioni_admin_v3b",
  "015_gw_quota_workshop_v3c",
] as const;

let t: TestDb;
let op: string;
let eventCounter = 0;

async function workshop(db: TestDb, operator: string, feeCents: number | null) {
  eventCounter += 1;
  const eventId = `eeeeeeee-0000-4000-8000-${String(eventCounter).padStart(12, "0")}`;
  const id = await db.value<string>(`select gw_ensure_workshop_for_event($1, $2, $3, '2026-11-14', null) v`, [
    operator,
    eventId,
    `Luxuria quota ${eventCounter}`,
  ]);
  if (feeCents !== null) await setFee(db, operator, id, feeCents);
  return id;
}

/** Restituisce il risultato di gw_update_workshop_settings (jsonb in 015, versione prima). */
async function setFee(db: TestDb, operator: string, workshopId: string, feeCents: number | null) {
  const version = await db.value<number>(`select version v from gw_workshops where id = $1`, [workshopId]);
  return db.value<unknown>(`select gw_update_workshop_settings($1, $2, $3, $4::jsonb) v`, [
    operator,
    workshopId,
    version,
    JSON.stringify({ default_fee_cents: feeCents, peony_pct: 30 }),
  ]);
}

function enter(db: TestDb, operator: string, workshopId: string, name: string, feeCents: number | null = null, status = "prenotato") {
  return db.value<string>(`select gw_create_booking_entered($1, $2, $3::jsonb, $4, $5, null) v`, [
    operator,
    workshopId,
    JSON.stringify([name]),
    status,
    feeCents,
  ]);
}

async function booking(db: TestDb, id: string) {
  const [row] = await db.rows<{ status: string; fee: number | null; fee_custom: boolean; version: number }>(
    `select status::text, agreed_fee_cents::int fee, fee_custom, version from gw_bookings where id = $1`,
    [id],
  );
  return row;
}

function pay(db: TestDb, operator: string, bookingId: string, euros: number) {
  return db.value<string>(`select gw_add_payment($1, $2, $3::jsonb) v`, [
    operator,
    bookingId,
    JSON.stringify({
      kind: "pagamento",
      amount_cents: euros * 100,
      payment_type: "saldo",
      method: "contanti",
      paid_on: "2026-10-01",
      received_by: "redsabbath",
    }),
  ]);
}

async function setBookingFee(db: TestDb, operator: string, id: string, feeCents: number | null) {
  const { version } = await booking(db, id);
  return db.value<number>(`select gw_set_booking_fee($1, $2, $3, $4) v`, [operator, id, version, feeCents]);
}

beforeAll(async () => {
  t = await createTestDb(ALL);
  op = await t.operator("Ale Prova");
});

describe("D19 — la quota segue il workshop", () => {
  it("cambio quota: le non dedicate la seguono subito (storico, stato), le dedicate e le cancellate no", async () => {
    const w = await workshop(t, op, 45000);
    const normal = await enter(t, op, w, "Aster");
    const settled = await enter(t, op, w, "Brina");
    await pay(t, op, settled, 450);
    const dedicated = await enter(t, op, w, "Corvo", 30000);
    const cancelled = await enter(t, op, w, "Dalia", null, "cancellato");
    expect(await booking(t, settled)).toMatchObject({ status: "saldato", fee: 45000 });
    expect(await booking(t, dedicated)).toMatchObject({ fee: 30000, fee_custom: true });

    const result = await setFee(t, op, w, 50000);
    expect(result).toMatchObject({ unsettled: 1 });
    expect(await booking(t, normal)).toMatchObject({ fee: 50000, fee_custom: false, status: "prenotato" });
    expect(await booking(t, settled)).toMatchObject({ fee: 50000, status: "acconto" });
    expect(await booking(t, dedicated)).toMatchObject({ fee: 30000, fee_custom: true });
    expect(await booking(t, cancelled)).toMatchObject({ fee: 45000, status: "cancellato" });
    expect(
      await t.value(`select count(*)::int v from gw_audit_log where entity_id = $1 and after->>'nota' = 'segue la quota del workshop'`, [normal]),
    ).toBe(1);

    // Riportata a 450: la prenotazione torna saldata, nessun avviso.
    expect(await setFee(t, op, w, 45000)).toMatchObject({ unsettled: 0 });
    expect(await booking(t, settled)).toMatchObject({ fee: 45000, status: "saldato" });
    // Stessa quota (salvo solo le note): niente cambia.
    const versionBefore = (await booking(t, normal)).version;
    expect(await setFee(t, op, w, 45000)).toMatchObject({ unsettled: 0 });
    expect((await booking(t, normal)).version).toBe(versionBefore);
  });

  it("le iscrizioni senza quota prendono quella del workshop appena c'è", async () => {
    const w = await workshop(t, op, null);
    const b = await t.value<string>(`select gw_create_booking($1, $2, $3::jsonb, 'prenotato', null, null) v`, [
      op,
      w,
      JSON.stringify([{ new: { nickname: "Senza Quota" } }]),
    ]);
    expect(await booking(t, b)).toMatchObject({ fee: null, fee_custom: false });
    await setFee(t, op, w, 40000);
    expect(await booking(t, b)).toMatchObject({ fee: 40000, fee_custom: false });
  });

  it("matita: tariffa dedicata (anche se uguale), poi 'Ripristina quota del workshop'", async () => {
    const w = await workshop(t, op, 45000);
    const b = await enter(t, op, w, "Edera");
    await pay(t, op, b, 450);
    expect(await booking(t, b)).toMatchObject({ status: "saldato" });

    await setBookingFee(t, op, b, 58000);
    expect(await booking(t, b)).toMatchObject({ fee: 58000, fee_custom: true, status: "acconto" });
    await setFee(t, op, w, 50000);
    expect(await booking(t, b)).toMatchObject({ fee: 58000, fee_custom: true });

    await setBookingFee(t, op, b, null);
    expect(await booking(t, b)).toMatchObject({ fee: 50000, fee_custom: false, status: "acconto" });
    await setBookingFee(t, op, b, 50000);
    expect(await booking(t, b)).toMatchObject({ fee: 50000, fee_custom: true });

    expect((await t.error(`select gw_set_booking_fee($1, $2, 1, 100)`, [op, b]))?.code).toBe("GW409");
    const { version } = await booking(t, b);
    expect((await t.error(`select gw_set_booking_fee($1, $2, $3, -1)`, [op, b, version]))?.code).toBe("GW400");
  });

  it("Aggiungi: senza quota segue il workshop; con quota (matita) è dedicata anche se uguale", async () => {
    const w = await workshop(t, op, 45000);
    expect(await booking(t, await enter(t, op, w, "Felce"))).toMatchObject({ fee: 45000, fee_custom: false });
    expect(await booking(t, await enter(t, op, w, "Gelso", 45000))).toMatchObject({ fee: 45000, fee_custom: true });
  });

  it("la riga aperta salva stato, note e fattura senza toccare la quota", async () => {
    const w = await workshop(t, op, 45000);
    const b = await enter(t, op, w, "Ibisco");
    const { version } = await booking(t, b);
    await t.value(`select gw_update_registration($1, $2, $3, 'lista_attesa', 'nota', 'richiesta') v`, [op, b, version]);
    expect(await booking(t, b)).toMatchObject({ status: "lista_attesa", fee: 45000, fee_custom: false });
    expect(await t.value(`select count(*)::int v from pg_proc where proname = 'gw_apply_standard_fee'`)).toBe(0);
  });
});

describe("015 sui dati esistenti e rollback", () => {
  it("fee_custom = false se la quota è nulla o una quota standard passata; poi allineamento", async () => {
    const t2 = await createTestDb(ALL.slice(0, 5));
    const op2 = await t2.operator();
    const w = await workshop(t2, op2, 40000);
    const old40 = await enter(t2, op2, w, "Larice");
    await setFee(t2, op2, w, 45000);
    const current = await enter(t2, op2, w, "Melo");
    const dedicated = await enter(t2, op2, w, "Noce", 58000);
    const settled = await enter(t2, op2, w, "Olmo");
    await pay(t2, op2, settled, 450);
    // Prima della 015 "dedicata" se diversa dalla quota del momento: simuliamo
    // quote passate segnate come dedicate e una quota nulla.
    await t2.db.exec(`update gw_bookings set fee_custom = true where id in ('${old40}', '${current}')`);
    await t2.db.exec(`update gw_bookings set agreed_fee_cents = null, fee_custom = true where id = '${settled}'`);
    const cancelled = await enter(t2, op2, w, "Pino", 40000, "cancellato");

    await t2.db.exec(readMigration("015_gw_quota_workshop_v3c"));
    expect(await booking(t2, old40)).toMatchObject({ fee: 45000, fee_custom: false });
    expect(await booking(t2, current)).toMatchObject({ fee: 45000, fee_custom: false });
    expect(await booking(t2, dedicated)).toMatchObject({ fee: 58000, fee_custom: true });
    expect(await booking(t2, settled)).toMatchObject({ fee: 45000, fee_custom: false, status: "saldato" });
    // Cancellata: non dedicata (quota passata) ma la quota non si tocca.
    expect(await booking(t2, cancelled)).toMatchObject({ fee: 40000, fee_custom: false, status: "cancellato" });

    expect((await t2.error(readMigration("015_gw_quota_workshop_v3c")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});

    await t2.db.exec(readMigration("015_gw_quota_workshop_v3c", "down"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname in ('gw_set_booking_fee', 'gw_sync_workshop_fee')`)).toBe(0);
    // Le funzioni ripristinate funzionano ancora (013: la quota non segue).
    expect(typeof (await setFee(t2, op2, w, 50000))).toBe("number");
    expect(await booking(t2, old40)).toMatchObject({ fee: 45000 });
    expect(await t2.value(`select gw_apply_standard_fee($1, $2, 'precedente', 3) v`, [op2, w])).toBe(3);

    await t2.db.exec(readMigration("015_gw_quota_workshop_v3c"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname = 'gw_set_booking_fee'`)).toBe(1);
  });
});
