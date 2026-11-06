// Migrazione 024 (Fase 4e): correzioni dalla revisione. Solo PGlite, mai il
// database reale. Dati inventati.

import { beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w: string;

const pay = (amount: number, receivedBy = "redsabbath", type = "acconto") =>
  JSON.stringify({ kind: "pagamento", amount_cents: amount, payment_type: type, method: "paypal", paid_on: "2026-10-28", received_by: receivedBy });

const register = (entries: unknown[], status = "prenotato") =>
  t.value<string>(`select gw_create_booking_entered($1, $2, $3::jsonb, $4, null, null) v`, [op, w, JSON.stringify(entries), status]);
const addPayment = (booking: string, amount: number, receivedBy = "redsabbath") =>
  t.value<string>(`select gw_add_payment($1, $2, $3::jsonb) v`, [op, booking, pay(amount, receivedBy)]);
const livePaid = (booking: string) =>
  t.value<number>(`select coalesce(sum(amount_cents), 0)::int v from gw_payments where booking_id = $1 and deleted_at is null`, [booking]);
const versionOf = (table: string, id: string) => t.value<number>(`select version v from ${table} where id = $1`, [id]);
const person = (data: Record<string, unknown>) => t.value<string>(`select gw_create_person($1, $2::jsonb) v`, [op, JSON.stringify(data)]);
const cancel = async (booking: string) =>
  t.value(`select gw_update_registration($1, $2, $3, 'cancellato', null, 'non_richiesta') v`, [op, booking, await versionOf("gw_bookings", booking)]);

async function workshop(event: string): Promise<string> {
  const id = await t.value<string>(`select gw_ensure_workshop_for_event($1, $2, 'Luxuria 4e', '2026-11-14', null) v`, [op, event]);
  await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 40000}'::jsonb) v`, [op, id]);
  return id;
}

beforeEach(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Ale Prova");
  w = await workshop("eeeeeeee-0000-4000-8000-000000000241");
});

describe("#5/#28 — anteprima: sembra già iscritta", () => {
  it("restituisce solo l'iscrizione e il testo di Ale (nickname, altri nomi, email); nessuna persona creata", async () => {
    const nora = await person({ nickname: "Nora", first_name: "Nora", last_name: "Pini", email: "nora@example.com" });
    await t.value(`select gw_add_person_alias($1, $2, 'Brina') v`, [op, nora]);
    const booking = await register(["Nora"]);
    const people = await t.value<number>(`select count(*)::int v from gw_people`);

    const result = await t.value<unknown[]>(`select gw_preview_entered_matches($1, $2::jsonb) v`, [
      w,
      JSON.stringify(["Brina", { text: "Claudia A.", email: "NORA@example.com" }, "Nora Pini", "Sconosciuta", "nora@example.com"]),
    ]);
    const hit = { booking_id: booking, entered_as: "Nora" };
    expect(result).toEqual([hit, hit, hit, null, hit]);
    // Nessun dato anagrafico: solo id dell'iscrizione e testo scritto da Ale.
    expect(Object.keys(result[0] as object).sort()).toEqual(["booking_id", "entered_as"]);
    expect(await t.value(`select count(*)::int v from gw_people`)).toBe(people);
  });

  it("niente segnale se la persona è iscritta a un altro workshop o se l'abbinamento non è unico", async () => {
    await person({ nickname: "Vela" });
    await person({ nickname: "Vela2", first_name: "Vela" });
    const other = await workshop("eeeeeeee-0000-4000-8000-000000000242");
    const nora = await person({ nickname: "Nora" });
    await t.value(`select gw_create_booking_entered($1, $2, '["Nora"]'::jsonb, 'prenotato', null, null) v`, [op, other]);
    expect(nora).toBeTruthy();
    expect(await t.value(`select gw_preview_entered_matches($1, '["Nora", "Vela"]'::jsonb) v`, [w])).toEqual([null, null]);
  });
});

describe("#6 + #9 — box di testo", () => {
  it("senza pagamenti la data non serve; dalla 026 nemmeno con un pagamento senza data", async () => {
    const rows = JSON.stringify([{ people: ["Solo Interesse"], status: "interessato", fee_cents: null, invoice_status: "non_richiesta", notes: null, payments: [] }]);
    expect(await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, rows])).toEqual({ created: 1, updated: 0, payments: 0 });

    const withPayment = JSON.stringify([
      { people: ["Con Acconto"], status: "acconto", fee_cents: null, invoice_status: "non_richiesta", notes: null, payments: [{ amount_cents: 1000, payment_type: "acconto", method: null }] },
    ]);
    // 026: la data del pagamento è facoltativa.
    expect(await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, withPayment])).toEqual({ created: 1, updated: 0, payments: 1 });
    expect(await t.value(`select count(*)::int v from gw_payments where paid_on is null`)).toBe(1);
  });

  it("riga già presente: 'Salva l'email' solo se Ale non ne aveva scritta una", async () => {
    const booking = await register(["Aster"]);
    const row = (email: string) =>
      JSON.stringify([{ booking_id: booking, booking_version: 1, people: [], status: "prenotato", fee_cents: null, invoice_status: "non_richiesta", notes: null, payments: [], entered_email: email }]);
    await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, row("aster@example.com")]);
    const participant = `select bp.entered_email, p.email from gw_booking_participants bp join gw_people p on p.id = bp.person_id where bp.booking_id = $1`;
    expect(await t.rows(participant, [booking])).toEqual([{ entered_email: "aster@example.com", email: "aster@example.com" }]);
    await t.value(`select gw_import_roster($1, $2, null, 'redsabbath', $3::jsonb) v`, [op, w, row("altra@example.com")]);
    expect(await t.rows(participant, [booking])).toEqual([{ entered_email: "aster@example.com", email: "aster@example.com" }]);
  });
});

describe("#2 — Registra rimborso del pagato", () => {
  it("un rimborso per parte che ha incassato; importo controllato; storico", async () => {
    const b = await register(["Bruma"]);
    await addPayment(b, 15000, "redsabbath");
    await addPayment(b, 7000, "peony");
    await cancel(b);
    expect((await t.error(`select gw_refund_booking('${op}', '${b}', 1000, 'contanti', '2026-10-29', null)`))?.detail).toBe(
      "I pagamenti sono cambiati: ricarica la pagina.",
    );
    expect(await t.value(`select gw_refund_booking($1, $2, 22000, 'contanti', '2026-10-29', null) v`, [op, b])).toBe(2);
    expect(await livePaid(b)).toBe(0);
    expect(
      await t.rows(`select received_by::text, amount_cents::int, payment_type::text from gw_payments where booking_id = $1 and kind = 'rimborso' order by received_by`, [b]),
    ).toEqual([
      { received_by: "peony", amount_cents: -7000, payment_type: "altro" },
      { received_by: "redsabbath", amount_cents: -15000, payment_type: "altro" },
    ]);
    expect(await t.value(`select status::text v from gw_bookings where id = $1`, [b])).toBe("cancellato");
    expect((await t.error(`select gw_refund_booking('${op}', '${b}', 0, null, '2026-10-29', null)`))?.detail).toBe("Non ci sono soldi da restituire.");
  });

  it("parte in negativo: si chiede a chi va; con la parte indicata un solo movimento", async () => {
    const b = await register(["Corvo"]);
    await addPayment(b, 20000, "redsabbath");
    await t.value(`select gw_add_payment($1, $2, '{"kind": "rimborso", "amount_cents": 5000, "method": "contanti", "paid_on": "2026-10-28", "received_by": "peony"}'::jsonb) v`, [op, b]);
    expect((await t.error(`select gw_refund_booking('${op}', '${b}', 15000, null, '2026-10-29', null)`))?.detail).toBe("Indica chi restituisce i soldi.");
    expect(await t.value(`select gw_refund_booking($1, $2, 15000, null, '2026-10-29', 'redsabbath') v`, [op, b])).toBe(1);
    expect(await livePaid(b)).toBe(0);
  });
});

describe("#21 — elimina iscrizione e pagamenti insieme", () => {
  it("un solo gruppo: Annulla ripristina iscrizione e pagamenti", async () => {
    const b = await register(["Dalia"]);
    await addPayment(b, 12000);
    await addPayment(b, 3000, "peony");
    const version = await versionOf("gw_bookings", b);
    expect((await t.error(`select gw_delete_booking('${op}', '${b}', ${version})`))?.code).toBe("GW400");
    expect((await t.error(`select gw_delete_booking_with_payments('${op}', '${b}', ${version}, 100)`))?.detail).toBe("I pagamenti sono cambiati: ricarica la pagina.");

    await t.value(`select gw_delete_booking_with_payments($1, $2, $3, 15000) v`, [op, b, version]);
    expect(await t.value(`select count(*)::int v from gw_payments where booking_id = $1 and deleted_at is null`, [b])).toBe(0);
    expect(await t.value(`select count(distinct deleted_at)::int v from (select deleted_at from gw_payments where booking_id = $1 union all select deleted_at from gw_bookings where id = $1) x`, [b])).toBe(1);

    await t.value(`select gw_restore_deleted($1, 'booking', $2) v`, [op, b]);
    expect(await livePaid(b)).toBe(15000);
    expect(await t.value(`select deleted_at is null v from gw_bookings where id = $1`, [b])).toBe(true);
  });
});

describe("#23 — Annulla per gli altri nomi", () => {
  it("ripristina il nome eliminato; rifiuta se intanto è usato da un'altra persona", async () => {
    const nora = await person({ nickname: "Nora" });
    const vela = await person({ nickname: "Vela" });
    const alias = await t.value<string>(`select gw_add_person_alias($1, $2, 'Brina') v`, [op, nora]);
    await t.value(`select gw_delete_person_alias($1, $2) v`, [op, alias]);
    await t.value(`select gw_restore_person_alias($1, $2) v`, [op, alias]);
    expect(await t.value(`select deleted_at is null v from gw_person_aliases where id = $1`, [alias])).toBe(true);

    await t.value(`select gw_delete_person_alias($1, $2) v`, [op, alias]);
    await t.value(`select gw_add_person_alias($1, $2, 'brina') v`, [op, vela]);
    expect((await t.error(`select gw_restore_person_alias('${op}', '${alias}')`))?.detail).toBe("«Brina» è già usato da un'altra persona: non si può ripristinare.");

    const other = await t.operator("Laura Prova");
    const second = await t.value<string>(`select gw_add_person_alias($1, $2, 'Lupa') v`, [op, nora]);
    await t.value(`select gw_delete_person_alias($1, $2) v`, [op, second]);
    expect((await t.error(`select gw_restore_person_alias('${other}', '${second}')`))?.code).toBe("GW400");
  });
});

describe("D24 — stati del consuntivo e migrazione", () => {
  it("la migrazione porta da_conguagliare / conguagliato a verificato (con storico); il rollback torna indietro", async () => {
    const before = await createTestDb(MIGRATIONS.slice(0, MIGRATIONS.indexOf("024_gw_correzioni_revisione")));
    const admin = await before.operator("Admin Prova");
    const ids: string[] = [];
    for (const [index, status] of ["provvisorio", "verificato", "da_conguagliare", "conguagliato"].entries()) {
      const id = await before.value<string>(
        `select gw_ensure_workshop_for_event($1, $2, 'Luxuria stati', '2026-11-14', null) v`,
        [admin, `eeeeeeee-0000-4000-8000-00000000025${index}`],
      );
      ids.push(id);
      const steps = { provvisorio: [], verificato: ["verificato"], da_conguagliare: ["verificato", "da_conguagliare"], conguagliato: ["verificato", "da_conguagliare", "conguagliato"] }[status]!;
      for (const step of steps) {
        await before.value(`select gw_set_settlement_status($1, $2, (select version from gw_workshops where id = $2), $3, $4::jsonb) v`, [
          admin,
          id,
          step,
          step === "verificato" ? '{"residuo": 0}' : null,
        ]);
      }
    }
    await before.db.exec(readMigration("024_gw_correzioni_revisione"));
    const statuses = await before.rows<{ settlement_status: string }>(
      `select settlement_status::text from gw_workshops where id = any($1::uuid[]) order by array_position($1::uuid[], id)`,
      [ids],
    );
    expect(statuses.map((r) => r.settlement_status)).toEqual(["provvisorio", "verificato", "verificato", "verificato"]);
    expect(
      await before.rows(`select before->>'settlement_status' s from gw_audit_log where entity = 'workshop' and after->>'nota' like 'migrazione 024%' order by before->>'settlement_status'`),
    ).toEqual([{ s: "conguagliato" }, { s: "da_conguagliare" }]);
    // Lo snapshot della verifica resta: il banner "da ricontrollare" funziona come prima.
    expect(await before.value(`select verified_snapshot v from gw_workshops where id = $1`, [ids[3]])).toEqual({ residuo: 0 });
    expect((await before.error(readMigration("024_gw_correzioni_revisione")))?.message).toContain("già applicata");
    await before.db.exec("rollback").catch(() => {});

    await before.db.exec(readMigration("024_gw_correzioni_revisione", "down"));
    expect(await before.value(`select to_regprocedure('public.gw_refund_booking(uuid, uuid, bigint, public.gw_payment_method, date, public.gw_party)') is null v`)).toBe(true);
    expect(await before.value(`select count(*)::int v from gw_economic_overview()`)).toBe(4);
    await before.db.exec(readMigration("024_gw_correzioni_revisione"));
  });

  it("gw_economic_overview restituisce anche lo snapshot della verifica", async () => {
    await t.value(`select gw_set_settlement_status($1, $2, $3, 'verificato', '{"ricavi": 0, "residuo": 0}'::jsonb) v`, [op, w, await versionOf("gw_workshops", w)]);
    expect(await t.rows(`select settlement_status::text, verified_snapshot from gw_economic_overview() where workshop_id = $1`, [w])).toEqual([
      { settlement_status: "verificato", verified_snapshot: { ricavi: 0, residuo: 0 } },
    ]);
  });

  it("funzioni nuove eseguibili solo dalla service role", async () => {
    for (const fn of [
      "gw_preview_entered_matches(uuid, jsonb)",
      "gw_refund_booking(uuid, uuid, bigint, public.gw_payment_method, date, public.gw_party)",
      "gw_delete_booking_with_payments(uuid, uuid, integer, bigint)",
      "gw_restore_person_alias(uuid, uuid)",
      "gw_economic_overview()",
    ]) {
      expect(await t.value(`select has_function_privilege('anon', 'public.${fn}', 'execute') v`), fn).toBe(false);
      expect(await t.value(`select has_function_privilege('service_role', 'public.${fn}', 'execute') v`), fn).toBe(true);
    }
  });
});
