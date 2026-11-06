// Migrazione 020 (Fase 4b, D22): eliminazioni logiche con storico, guardie,
// Annulla, rollback. Solo PGlite. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let other: string;
let w: string;

const pay = (amount: number, type = "acconto", receivedBy = "redsabbath") =>
  JSON.stringify({ kind: "pagamento", amount_cents: amount, payment_type: type, method: "paypal", paid_on: "2026-10-28", received_by: receivedBy });

async function register(entries: string[], workshop = w, status = "prenotato"): Promise<string> {
  return t.value<string>(`select gw_create_registration($1, $2, $3::jsonb, $4, null, null, null) v`, [op, workshop, JSON.stringify(entries), status]);
}
const addPayment = (booking: string, amount: number, type = "acconto", receivedBy = "redsabbath") =>
  t.value<string>(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, booking, pay(amount, type, receivedBy)]);
const statusOf = (id: string) => t.value<string>(`select status::text v from gw_bookings where id = $1`, [id]);
const versionOf = (table: string, id: string) => t.value<number>(`select version v from ${table} where id = $1`, [id]);
const livePaid = (booking: string) =>
  t.value<number>(`select coalesce(sum(amount_cents), 0)::int v from gw_payments where booking_id = $1 and deleted_at is null`, [booking]);
const audit = (entity: string, id: string) =>
  t.rows<{ action: string; operator_id: string; after: Record<string, unknown> }>(
    `select action::text, operator_id, after from gw_audit_log where entity = $1 and entity_id = $2 order by id`,
    [entity, id],
  );

async function manualWorkshop(name: string): Promise<string> {
  return t.value<string>(`select gw_create_workshop($1, $2::jsonb) v`, [op, JSON.stringify({ name, starts_on: "2026-12-05" })]);
}

beforeAll(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Ale Prova");
  other = await t.operator("Laura Prova");
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000201', 'Luxuria eliminazioni', '2026-11-14', null) v`, [op]);
  await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [op, w]);
});

describe("pagamenti", () => {
  it("eliminato: non conta più, stato automatico ricalcolato, storico; Annulla lo ripristina", async () => {
    const b = await register(["Aster"]);
    await addPayment(b, 15000);
    const saldo = await addPayment(b, 25000, "saldo");
    expect(await statusOf(b)).toBe("saldato");

    expect(await t.value(`select gw_delete_payment($1, $2) v`, [op, saldo])).toBe(1);
    expect(await livePaid(b)).toBe(15000);
    expect(await statusOf(b)).toBe("acconto");
    expect(await t.rows(`select (deleted_at is not null) deleted, deleted_by from gw_payments where id = $1`, [saldo])).toEqual([
      { deleted: true, deleted_by: op },
    ]);
    const log = await audit("payment", saldo);
    expect(log.map((r) => r.action)).toEqual(["insert", "delete"]);
    expect(log[1].operator_id).toBe(op);

    // Già eliminato: non trovato.
    expect((await t.error(`select gw_delete_payment('${op}', '${saldo}')`))?.code).toBe("GW404");
    // Annulla: solo chi ha eliminato.
    expect((await t.error(`select gw_restore_deleted('${other}', 'payment', '${saldo}')`))?.detail).toContain("Non si può più annullare");
    await t.value(`select gw_restore_deleted($1, 'payment', $2) v`, [op, saldo]);
    expect(await livePaid(b)).toBe(40000);
    expect(await statusOf(b)).toBe("saldato");
    expect((await audit("payment", saldo)).map((r) => r.action)).toEqual(["insert", "delete", "update"]);
  });

  it("modificato (anche due volte): spariscono movimento valido, rettifiche e originali", async () => {
    const b = await register(["Brina"]);
    const original = await addPayment(b, 20000);
    const keep = await addPayment(b, 5000, "saldo");
    await t.value(`select gw_correct_payment($1, $2, $3::jsonb, 'Modifica') v`, [op, original, pay(25000)]);
    const second = await t.value<string>(
      `select id v from gw_payments where booking_id = $1 and kind = 'pagamento' and amount_cents = 25000`,
      [b],
    );
    await t.value(`select gw_correct_payment($1, $2, $3::jsonb, 'Modifica') v`, [op, second, pay(30000)]);
    const current = await t.value<string>(
      `select id v from gw_payments where booking_id = $1 and kind = 'pagamento' and amount_cents = 30000`,
      [b],
    );
    expect(await livePaid(b)).toBe(35000);

    // Un movimento già annullato o una rettifica collegata non si eliminano da soli.
    expect((await t.error(`select gw_delete_payment('${op}', '${original}')`))?.detail).toContain("già stato annullato");
    const fix = await t.value<string>(`select id v from gw_payments where corrects_payment_id = $1`, [original]);
    expect((await t.error(`select gw_delete_payment('${op}', '${fix}')`))?.detail).toContain("rettifica");

    expect(await t.value(`select gw_delete_payment($1, $2) v`, [op, current])).toBe(5);
    expect(await livePaid(b)).toBe(5000);
    expect(await t.rows(`select id from gw_payments where booking_id = $1 and deleted_at is null`, [b])).toEqual([{ id: keep }]);

    await t.value(`select gw_restore_deleted($1, 'payment', $2) v`, [op, current]);
    expect(await livePaid(b)).toBe(35000);
  });

  it("rettifica parziale: si elimina col movimento che corregge", async () => {
    // gw_correct_payment senza sostituto annulla tutto: qui una rettifica parziale a mano.
    const b2 = await register(["Corvo"]);
    const p2 = await addPayment(b2, 20000);
    await t.value(
      `select gw_insert_payment($1, $2, 'rettifica', -5000, 'acconto', 'paypal', '2026-10-29', 'redsabbath', 'parziale', $3, 'test') v`,
      [op, b2, p2],
    );
    expect(await livePaid(b2)).toBe(15000);
    expect(await t.value(`select gw_delete_payment($1, $2) v`, [op, p2])).toBe(2);
    expect(await livePaid(b2)).toBe(0);
    expect(await statusOf(b2)).toBe("prenotato");
  });
});

describe("trigger su gw_payments", () => {
  it("consente solo deleted_at/deleted_by; niente DELETE né modifiche, anche dopo l'eliminazione", async () => {
    const b = await register(["Dalia"]);
    const p = await addPayment(b, 10000);
    expect((await t.error(`delete from gw_payments where id = '${p}'`))?.message).toContain("non si cancellano");
    for (const set of ["amount_cents = 1", "description = 'x'", "method = 'contanti'", "paid_on = '2026-01-01'", "payment_type = 'saldo'"]) {
      expect((await t.error(`update gw_payments set ${set} where id = '${p}'`))?.message).toContain("si possono solo eliminare");
    }
    expect(await t.error(`update gw_payments set deleted_at = now(), deleted_by = '${op}' where id = '${p}'`)).toBeNull();
    expect((await t.error(`update gw_payments set deleted_by = '${other}' where id = '${p}'`))?.code).toBe("GW404");
    expect(await t.error(`update gw_payments set deleted_at = null, deleted_by = null where id = '${p}'`)).toBeNull();
  });
});

describe("iscrizioni", () => {
  it("con pagamenti validi: rifiutata; eliminati i pagamenti: consentita; si può iscrivere di nuovo", async () => {
    const b = await register(["Elio"]);
    const p = await addPayment(b, 25000);
    expect((await t.error(`select gw_delete_booking('${op}', '${b}', ${await versionOf("gw_bookings", b)})`))?.detail).toBe(
      "Ha 250 € di pagamenti: eliminali o registra un rimborso prima.",
    );

    await t.value(`select gw_delete_payment($1, $2) v`, [op, p]);
    await t.value(`select gw_delete_booking($1, $2, $3) v`, [op, b, await versionOf("gw_bookings", b)]);
    expect(await t.value(`select count(*)::int v from gw_booking_participants where booking_id = $1 and deleted_at is null`, [b])).toBe(0);
    expect((await audit("booking", b)).at(-1)?.action).toBe("delete");

    // Una riga eliminata non si modifica più.
    expect((await t.error(`select gw_update_booking_notes('${op}', '${b}', ${await versionOf("gw_bookings", b)}, 'x')`))?.code).toBe("GW404");
    expect((await t.error(`select gw_add_payment('${op}', '${b}', '${pay(100)}'::jsonb)`))?.code).toBe("GW404");

    // La stessa persona di nuovo nello stesso workshop: abbinata alla stessa scheda.
    const person = await t.value<string>(`select person_id v from gw_booking_participants where booking_id = $1`, [b]);
    const again = await register(["Elio"]);
    expect(await t.value(`select person_id v from gw_booking_participants where booking_id = $1`, [again])).toBe(person);

    // Annulla rifiutato: la persona è già iscritta di nuovo.
    expect((await t.error(`select gw_restore_deleted('${op}', 'booking', '${b}')`))?.detail).toContain("iscritta di nuovo");
  });

  it("rimborso registrato (pagato netto 0): consentita, con i movimenti; Annulla ripristina tutto", async () => {
    const b = await register(["Fiamma"]);
    const p = await addPayment(b, 10000);
    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [
      op,
      b,
      JSON.stringify({ kind: "rimborso", amount_cents: 10000, method: "paypal", paid_on: "2026-10-29", received_by: "redsabbath" }),
    ]);
    await t.value(`select gw_delete_booking($1, $2, $3) v`, [op, b, await versionOf("gw_bookings", b)]);
    expect(await t.value(`select count(*)::int v from gw_payments where booking_id = $1 and deleted_at is null`, [b])).toBe(0);

    await t.value(`select gw_restore_deleted($1, 'booking', $2) v`, [op, b]);
    expect(await t.value(`select count(*)::int v from gw_payments where booking_id = $1 and deleted_at is null`, [b])).toBe(2);
    expect(await t.value(`select (deleted_at is null) v from gw_payments where id = $1`, [p])).toBe(true);
  });

  it("pagamento e rimborso di parti diverse: rifiutata", async () => {
    const b = await register(["Gaia"]);
    await addPayment(b, 10000, "acconto", "redsabbath");
    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [
      op,
      b,
      JSON.stringify({ kind: "rimborso", amount_cents: 10000, method: "contanti", paid_on: "2026-10-29", received_by: "peony" }),
    ]);
    expect((await t.error(`select gw_delete_booking('${op}', '${b}', ${await versionOf("gw_bookings", b)})`))?.detail).toContain("parti diverse");
  });

  it("le funzioni in blocco ignorano le iscrizioni eliminate (quota del workshop, conferma abbinamenti)", async () => {
    const b = await register(["Iris"]);
    const person = await t.value<string>(`select person_id v from gw_booking_participants where booking_id = $1`, [b]);
    await t.value(`select gw_delete_booking($1, $2, $3) v`, [op, b, await versionOf("gw_bookings", b)]);
    const fee = await t.value<number>(`select agreed_fee_cents::int v from gw_bookings where id = $1`, [b]);

    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 42000}'::jsonb) v`, [op, w]);
    expect(await t.value(`select agreed_fee_cents::int v from gw_bookings where id = $1`, [b])).toBe(fee);
    expect(await t.value<number>(`select gw_confirm_person_matches($1, $2) v`, [op, person])).toBe(0);
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [op, w]);
  });
});

describe("persone", () => {
  it("con iscrizioni: rifiutata ed elenca i workshop; senza: consentita; poi non si abbina più", async () => {
    const b = await register(["Lupo Grigio"]);
    const person = await t.value<string>(`select person_id v from gw_booking_participants where booking_id = $1`, [b]);
    expect((await t.error(`select gw_delete_person('${op}', '${person}', ${await versionOf("gw_people", person)})`))?.detail).toBe(
      "È iscritta a: Luxuria eliminazioni. Elimina prima le iscrizioni.",
    );

    await t.value(`select gw_delete_booking($1, $2, $3) v`, [op, b, await versionOf("gw_bookings", b)]);
    await t.value(`select gw_delete_person($1, $2, $3) v`, [op, person, await versionOf("gw_people", person)]);
    expect((await audit("person", person)).at(-1)?.action).toBe("delete");
    // L'iscrizione eliminata resta collegata per lo storico.
    expect(await t.value(`select person_id v from gw_booking_participants where booking_id = $1`, [b])).toBe(person);

    // Lo stesso testo crea una persona nuova invece di abbinare quella eliminata.
    const again = await register(["Lupo Grigio"]);
    expect(await t.value(`select person_id v from gw_booking_participants where booking_id = $1`, [again])).not.toBe(person);
    expect((await t.error(`select gw_update_person('${op}', '${person}', ${await versionOf("gw_people", person)}, '{"first_name": "X"}'::jsonb)`))?.code).toBe("GW404");

    await t.value(`select gw_restore_deleted($1, 'person', $2) v`, [op, person]);
    expect(await t.value(`select (deleted_at is null) v from gw_people where id = $1`, [person])).toBe(true);
  });
});

describe("workshop", () => {
  it("manuale: eliminato con tutto il contenuto (anche i riporti verso altri workshop); Annulla ripristina", async () => {
    const m = await manualWorkshop("Prova manuale");
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 30000}'::jsonb) v`, [op, m]);
    const b = await register(["Nuvola"], m);
    await addPayment(b, 30000, "saldo");
    const e = await t.value<string>(`select gw_create_expense($1, $2, '{"description": "Sala", "amount_cents": 5000, "advanced_by": "peony"}'::jsonb) v`, [op, m]);
    const tr = await t.value<string>(`select gw_create_transfer($1, $2, '{"from_party": "redsabbath", "to_party": "peony", "amount_cents": 1000}'::jsonb) v`, [op, m]);
    const out = await t.value<string>(`select gw_create_carryover($1, $2::jsonb) v`, [
      op,
      JSON.stringify({ origin_workshop_id: m, destination_workshop_id: w, debtor: "redsabbath", creditor: "peony", amount_cents: 2000 }),
    ]);
    const version = await versionOf("gw_workshops", m);

    expect((await t.error(`select gw_delete_workshop('${op}', '${m}', ${version}, 'Altro nome')`))?.detail).toContain("Scrivi il nome");
    await t.value(`select gw_delete_workshop($1, $2, $3, '  prova MANUALE ') v`, [op, m, version]);

    for (const [table, where] of [
      ["gw_workshops", `id = '${m}'`],
      ["gw_bookings", `workshop_id = '${m}'`],
      ["gw_booking_participants", `workshop_id = '${m}'`],
      ["gw_payments", `booking_id = '${b}'`],
      ["gw_expenses", `id = '${e}'`],
      ["gw_transfers", `id = '${tr}'`],
      ["gw_carryovers", `id = '${out}'`],
    ]) {
      expect(await t.value(`select bool_and(deleted_at is not null) v from ${table} where ${where}`)).toBe(true);
    }
    const log = await audit("workshop", m);
    expect(log.at(-1)).toMatchObject({ action: "delete", after: { contenuto: { iscrizioni: 1, pagamenti: 1, spese: 1, trasferimenti: 1, riporti: 1 } } });

    // Niente di nuovo dentro un workshop eliminato.
    expect((await t.error(`select gw_create_expense('${op}', '${m}', '{"description": "x", "amount_cents": 1, "advanced_by": "peony"}'::jsonb)`))?.code).toBe("GW404");
    expect((await t.error(`select gw_create_registration('${op}', '${m}', '["Ombra"]'::jsonb, 'prenotato', null, null, null)`))?.code).toBe("GW404");

    await t.value(`select gw_restore_deleted($1, 'workshop', $2) v`, [op, m]);
    for (const table of ["gw_bookings", "gw_expenses", "gw_transfers"]) {
      expect(await t.value(`select count(*)::int v from ${table} where workshop_id = $1 and deleted_at is null`, [m])).toBe(1);
    }
    expect(await livePaid(b)).toBe(30000);
    expect(await t.value(`select (deleted_at is null) v from gw_carryovers where id = $1`, [out])).toBe(true);
  });

  it("collegato a Ticket Tailor: rifiutato", async () => {
    expect((await t.error(`select gw_delete_workshop('${op}', '${w}', ${await versionOf("gw_workshops", w)}, 'Luxuria eliminazioni')`))?.detail).toContain(
      "Ticket Tailor",
    );
  });
});

describe("spese, trasferimenti, riporti", () => {
  it("eliminazione logica con storico e Annulla", async () => {
    const e = await t.value<string>(`select gw_create_expense($1, $2, '{"description": "Volo", "amount_cents": 9000, "advanced_by": "peony"}'::jsonb) v`, [op, w]);
    await t.value(`select gw_delete_expense($1, $2, 1) v`, [op, e]);
    expect(await t.value(`select (deleted_at is not null) v from gw_expenses where id = $1`, [e])).toBe(true);
    expect((await t.error(`select gw_update_expense('${op}', '${e}', 1, '{"description": "x", "amount_cents": 1, "advanced_by": "peony"}'::jsonb)`))?.code).toBe("GW404");
    await t.value(`select gw_restore_deleted($1, 'expense', $2) v`, [op, e]);
    expect(await t.value(`select (deleted_at is null) v from gw_expenses where id = $1`, [e])).toBe(true);
    expect((await audit("expense", e)).map((r) => r.action)).toEqual(["insert", "delete", "update"]);
  });

  it("Annulla dopo 10 minuti: rifiutato", async () => {
    const tr = await t.value<string>(`select gw_create_transfer($1, $2, '{"from_party": "peony", "to_party": "redsabbath", "amount_cents": 500}'::jsonb) v`, [op, w]);
    await t.value(`select gw_delete_transfer($1, $2, 1) v`, [op, tr]);
    await t.db.exec(`alter table gw_transfers disable trigger user; update gw_transfers set deleted_at = now() - interval '11 minutes' where id = '${tr}'; alter table gw_transfers enable trigger user;`);
    expect((await t.error(`select gw_restore_deleted('${op}', 'transfer', '${tr}')`))?.detail).toContain("Non si può più annullare");
  });
});

describe("rollback e riapplicazione della 020", () => {
  it("con righe eliminate si interrompe; senza toglie tutto; si riapplica", async () => {
    // I rollback vanno in ordine inverso: qui fino alla 022 (la 023 usa le guardie della 020).
    const t2 = await createTestDb(MIGRATIONS.slice(0, MIGRATIONS.indexOf("023_gw_richieste_associazione")));
    const op2 = await t2.operator();
    const w2 = await t2.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000202', 'Luxuria rb', '2026-11-14', null) v`, [op2]);
    const e = await t2.value<string>(`select gw_create_expense($1, $2, '{"description": "Sala", "amount_cents": 1000, "advanced_by": "peony"}'::jsonb) v`, [op2, w2]);

    expect((await t2.error(readMigration("020_gw_eliminazioni")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});

    await t2.value(`select gw_delete_expense($1, $2, 1) v`, [op2, e]);
    expect((await t2.error(readMigration("020_gw_eliminazioni", "down")))?.message).toContain("righe eliminate in gw_expenses");
    await t2.db.exec("rollback").catch(() => {});
    await t2.value(`select gw_restore_deleted($1, 'expense', $2) v`, [op2, e]);

    await t2.db.exec(readMigration("020_gw_eliminazioni", "down"));
    expect(await t2.value(`select count(*)::int v from information_schema.columns where column_name = 'deleted_at' and table_name like 'gw\\_%'`)).toBe(0);
    expect(await t2.value(`select count(*)::int v from pg_proc where proname in ('gw_restore_deleted', 'gw_delete_payment', 'gw_deleted_row_guard')`)).toBe(0);
    expect(await t2.value(`select count(*)::int v from gw_expenses`)).toBe(1);
    // Indice delle iscrizioni attive come in 010.
    expect(await t2.value(`select indexdef v from pg_indexes where indexname = 'gw_booking_participants_active_key'`)).not.toContain("deleted_at");

    await t2.db.exec(readMigration("020_gw_eliminazioni"));
    await t2.value(`select gw_delete_expense($1, $2, 1) v`, [op2, e]);
    expect(await t2.value(`select (deleted_at is not null) v from gw_expenses where id = $1`, [e])).toBe(true);
  });
});
