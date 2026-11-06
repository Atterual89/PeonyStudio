// Migrazione 023, parte B: richieste di associazione e solleciti per persona
// e periodo associativo. Solo PGlite. Dati inventati.

import { beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;

beforeEach(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator();
});

const person = (data: Record<string, unknown>) => t.value<string>(`select gw_create_person($1, $2::jsonb) v`, [op, JSON.stringify(data)]);
const add = (personId: string, period = "2025-09-01", sentOn = "2026-10-12", note: string | null = null) =>
  t.value<{ id: string; kind: string; number: number }>(`select gw_add_membership_contact($1, $2, $3, $4::date, $5) v`, [op, personId, period, sentOn, note]);
const numbers = (personId: string, period = "2025-09-01") =>
  t.rows(
    `select kind::text, number from gw_membership_contacts where person_id = $1 and period_key = $2 and deleted_at is null order by number`,
    [personId, period],
  );

describe("gw_membership_contacts", () => {
  it("richiesta = 0, poi solleciti 1, 2…; dopo un'eliminazione il successivo è il massimo valido + 1", async () => {
    const p = await person({ first_name: "Viola", last_name: "Prova" });
    expect(await add(p, "2025-09-01", "2026-10-12", "  prima  ")).toMatchObject({ kind: "richiesta", number: 0 });
    const s1 = await add(p);
    const s2 = await add(p);
    expect([s1.number, s2.number]).toEqual([1, 2]);
    expect(await t.value(`select note v from gw_membership_contacts where number = 0`)).toBe("prima");

    // Elimino il sollecito 2: il successivo torna 2. Elimino il 1 con il 2 valido: il successivo è 3.
    await t.value(`select gw_delete_membership_contact($1, $2) v`, [op, s2.id]);
    expect((await add(p)).number).toBe(2);
    await t.value(`select gw_delete_membership_contact($1, $2) v`, [op, s1.id]);
    expect((await add(p)).number).toBe(3);
    expect(await numbers(p)).toEqual([
      { kind: "richiesta", number: 0 },
      { kind: "sollecito", number: 2 },
      { kind: "sollecito", number: 3 },
    ]);
    // Storico: inserimenti ed eliminazioni.
    expect(await t.value(`select count(*)::int v from gw_audit_log where entity = 'membership_contact'`)).toBe(7);
  });

  it("periodo diverso = storico separato; la stessa persona in due workshop dello stesso periodo ha un solo storico", async () => {
    const p = await person({ nickname: "Nebbia" });
    await add(p, "2025-09-01");
    await add(p, "2025-09-01");
    expect((await add(p, "2027-01-01")).kind).toBe("richiesta");
    expect(await numbers(p, "2025-09-01")).toHaveLength(2);
    expect(await numbers(p, "2027-01-01")).toHaveLength(1);
  });

  it("tutti insieme: richiesta o sollecito successivo per ognuno, in una transazione", async () => {
    const a = await person({ nickname: "Ortica" });
    const b = await person({ nickname: "Salice" });
    await add(b);
    expect(await t.value(`select gw_add_membership_contacts($1, $2::uuid[], '2025-09-01', '2026-10-20') v`, [op, [a, b, a]])).toBe(2);
    expect(await numbers(a)).toEqual([{ kind: "richiesta", number: 0 }]);
    expect(await numbers(b)).toEqual([
      { kind: "richiesta", number: 0 },
      { kind: "sollecito", number: 1 },
    ]);
    // Una persona eliminata blocca tutto: nessun contatto scritto.
    const gone = await person({ nickname: "Cardo" });
    await t.value(`select gw_delete_person($1, $2, 1) v`, [op, gone]);
    expect((await t.error(`select gw_add_membership_contacts('${op}', array['${a}', '${gone}']::uuid[], '2025-09-01', '2026-10-21')`))?.code).toBe(
      "GW404",
    );
    expect(await numbers(a)).toHaveLength(1);
  });

  it("annulla solo chi ha eliminato; riga eliminata non modificabile; dati non validi rifiutati", async () => {
    const p = await person({ nickname: "Ramo" });
    const c = await add(p);
    await t.value(`select gw_delete_membership_contact($1, $2) v`, [op, c.id]);
    expect((await t.error(`update gw_membership_contacts set note = 'x' where id = '${c.id}'`))?.code).toBe("GW404");
    const other = await t.operator("Altra Operatrice");
    expect((await t.error(`select gw_restore_membership_contact('${other}', '${c.id}')`))?.code).toBe("GW400");
    await t.value(`select gw_restore_membership_contact($1, $2) v`, [op, c.id]);
    expect(await numbers(p)).toHaveLength(1);
    expect((await t.error(`select gw_add_membership_contact('${op}', '${p}', '2025', '2026-10-12', null)`))?.code).toBe("GW400");
  });

  it("sicurezza: RLS, niente accesso per anon/authenticated; rollback e riapplicazione", async () => {
    expect(await t.value(`select relrowsecurity v from pg_class where relname = 'gw_membership_contacts'`)).toBe(true);
    expect(await t.value(`select has_table_privilege('anon', 'public.gw_membership_contacts', 'select') v`)).toBe(false);
    expect(await t.value(`select has_function_privilege('authenticated', 'public.gw_add_membership_contact(uuid, uuid, text, date, text)', 'execute') v`)).toBe(false);

    expect((await t.error(readMigration("023_gw_richieste_associazione")))?.message).toContain("già applicata");
    await t.db.exec("rollback").catch(() => {});
    await t.db.exec(readMigration("023_gw_richieste_associazione", "down"));
    expect(await t.value(`select to_regclass('public.gw_membership_contacts') is null v`)).toBe(true);
    await t.db.exec(readMigration("023_gw_richieste_associazione"));
    expect(await t.value(`select to_regclass('public.gw_membership_contacts') is not null v`)).toBe(true);
  });
});
