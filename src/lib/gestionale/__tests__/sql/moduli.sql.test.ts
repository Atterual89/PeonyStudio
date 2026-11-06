// Moduli compatti (migrazione 023): nell'anteprima del box di testo Ale può
// tenere lo stato scritto nel testo contro quello dei pagamenti
// (forced_status, solo righe nuove, solo interessato / prenotato). Solo
// PGlite. Dati inventati.

import { describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration } from "./pglite";

describe("gw_import_roster con forced_status", () => {
  it("senza: stato dai pagamenti; con: resta quello scelto, con storico; stati economici ignorati; rollback come in 019", async () => {
    const t = await createTestDb(MIGRATIONS);
    const op = await t.operator("Ale Prova");
    const w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000231', 'Luxuria moduli', '2026-11-14', null) v`, [op]);
    await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 50000}'::jsonb) v`, [op, w]);

    const paid = [{ amount_cents: 50000, payment_type: "saldo", method: "contanti" }];
    const rows = JSON.stringify([
      { people: ["Brezza"], status: "prenotato", payments: paid },
      { people: ["Ombra"], status: "prenotato", forced_status: "prenotato", payments: paid },
      { people: ["Fumo"], status: "prenotato", forced_status: "saldato", payments: [{ amount_cents: 10000, payment_type: "acconto", method: null }] },
    ]);
    await t.value(`select gw_import_roster($1, $2, '2026-10-05', 'redsabbath', $3::jsonb) v`, [op, w, rows]);
    const statuses = await t.rows(
      `select bp.entered_as, b.status::text from gw_bookings b join gw_booking_participants bp on bp.booking_id = b.id order by bp.entered_as`,
    );
    expect(statuses).toEqual([
      { entered_as: "Brezza", status: "saldato" },
      { entered_as: "Fumo", status: "acconto" },
      { entered_as: "Ombra", status: "prenotato" },
    ]);
    expect(await t.value(`select count(*)::int v from gw_audit_log where entity = 'booking' and after->>'nota' = 'stato scelto nell''anteprima del testo'`)).toBe(1);

    await t.db.exec(readMigration("023_gw_richieste_associazione", "down"));
    const again = JSON.stringify([{ people: ["Nebbia"], status: "prenotato", forced_status: "prenotato", payments: paid }]);
    await t.value(`select gw_import_roster($1, $2, '2026-10-05', 'redsabbath', $3::jsonb) v`, [op, w, again]);
    expect(await t.value(`select b.status::text v from gw_bookings b join gw_booking_participants bp on bp.booking_id = b.id where bp.entered_as = 'Nebbia'`)).toBe("saldato");
  });
});
