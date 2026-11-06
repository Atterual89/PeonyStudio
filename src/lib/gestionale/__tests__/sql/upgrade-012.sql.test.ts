// Passaggio 011 → 012 sui dati già presenti in produzione, e rollback.

import { describe, expect, it } from "vitest";

import { createTestDb, readMigration } from "./pglite";

describe("012 su dati esistenti", () => {
  it("'confermato' diventa 'prenotato'; il primo partecipante diventa principale; rollback e riapplicazione", async () => {
    const t = await createTestDb(["010_gw_schema_v1", "011_gw_functions_v2"]);
    const op = await t.operator();
    const w = await t.value<string>(`select gw_create_workshop($1, '{"name":"Prova","starts_on":"2026-11-14"}'::jsonb) v`, [op]);
    const couple = await t.value<string>(
      `select gw_create_booking($1, $2, '[{"new":{"nickname":"Primo"}},{"new":{"nickname":"Secondo"}}]'::jsonb, 'confermato', 45000, null) v`,
      [op, w],
    );
    const single = await t.value<string>(
      `select gw_create_booking($1, $2, '[{"new":{"nickname":"Terzo"}}]'::jsonb, 'interessato', null, null) v`,
      [op, w],
    );

    await t.db.exec(readMigration("012_gw_correzioni_v2b"));

    expect(await t.value(`select status::text v from gw_bookings where id = $1`, [couple])).toBe("prenotato");
    expect(await t.value(`select status::text v from gw_bookings where id = $1`, [single])).toBe("interessato");
    const primaries = await t.rows<{ nickname: string; is_primary: boolean }>(
      `select p.nickname, bp.is_primary from gw_booking_participants bp join gw_people p on p.id = bp.person_id
        where bp.booking_id = $1 order by bp.is_primary desc, p.nickname`,
      [couple],
    );
    expect(primaries).toEqual([
      { nickname: "Primo", is_primary: true },
      { nickname: "Secondo", is_primary: false },
    ]);

    // Seconda applicazione: si ferma.
    expect((await t.error(readMigration("012_gw_correzioni_v2b")))?.message).toContain("già applicata");
    await t.db.exec("rollback").catch(() => {});

    // Rollback: acconto/saldato tornano a confermato, colonne e funzioni nuove eliminate, dati intatti.
    await t.db.query(`update gw_bookings set status = 'saldato' where id = $1`, [couple]);
    await t.db.exec(readMigration("012_gw_correzioni_v2b", "down"));
    expect(await t.value(`select status::text v from gw_bookings where id = $1`, [couple])).toBe("confermato");
    expect(
      await t.value(
        `select count(*)::int v from information_schema.columns where table_name in ('gw_booking_participants','gw_workshops') and column_name in ('is_primary','event_id')`,
      ),
    ).toBe(0);
    expect(await t.value(`select count(*)::int v from pg_proc where proname in ('gw_ensure_workshop_for_event','gw_rename_operator')`)).toBe(0);
    expect(await t.value(`select count(*)::int v from gw_people`)).toBe(3);
    // Le funzioni 011 ripristinate funzionano di nuovo con 'confermato'.
    await t.value(`select gw_create_booking($1, $2, '[{"new":{"nickname":"Quarto"}}]'::jsonb, null, null, null) v`, [op, w]);
    expect(await t.value(`select count(*)::int v from gw_bookings where status = 'confermato'`)).toBe(2);

    // Riapplicazione dopo il rollback (acconto/saldato sono rimasti nel tipo: "if not exists").
    await t.db.exec(readMigration("012_gw_correzioni_v2b"));
    expect(await t.value(`select count(*)::int v from gw_bookings where status = 'prenotato'`)).toBe(2);
  });
});
