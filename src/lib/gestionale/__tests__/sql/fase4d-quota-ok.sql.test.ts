// Migrazione 022: gw_membership_overrides non si usa più, le correzioni "in
// regola" diventano validazioni manuali (manual_override, come la pagina
// admin); storico delle validazioni dal gestionale. Solo PGlite. Dati inventati.

import { describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration } from "./pglite";

const BEFORE_022 = MIGRATIONS.slice(0, MIGRATIONS.indexOf("022_gw_quota_ok"));

describe("conversione di gw_membership_overrides", () => {
  it("in regola con email o nome e cognome → validazione manuale del periodo; le altre no", async () => {
    const t = await createTestDb(BEFORE_022);
    const op = await t.operator();
    const person = (data: Record<string, unknown>) => t.value<string>(`select gw_create_person($1, $2::jsonb) v`, [op, JSON.stringify(data)]);
    const withEmail = await person({ first_name: "Viola", email: "Viola@Example.test" });
    const withName = await person({ first_name: "Bruno", last_name: "Nomi" });
    const nickOnly = await person({ nickname: "Solo" });
    const negative = await person({ first_name: "Nadia", last_name: "Neg", email: "nadia@example.test" });
    const override = (personId: string, year: number, status: string) =>
      t.value(`insert into gw_membership_overrides (person_id, year, status) values ($1, $2, $3) returning id v`, [personId, year, status]);
    await override(withEmail, 2026, "in_regola");
    await override(withName, 2027, "in_regola");
    await override(nickOnly, 2026, "in_regola");
    await override(negative, 2026, "non_associato");

    await t.db.exec(readMigration("022_gw_quota_ok"));

    expect(
      await t.rows(
        `select first_name, last_name, email, membership_status, membership_starts_at::text, membership_expires_at::text, source
           from association_members order by first_name`,
      ),
    ).toEqual([
      { first_name: "Bruno", last_name: "Nomi", email: null, membership_status: "verified", membership_starts_at: "2027-01-01", membership_expires_at: "2027-12-31", source: "manual_override" },
      { first_name: "Viola", last_name: null, email: "viola@example.test", membership_status: "verified", membership_starts_at: "2025-09-01", membership_expires_at: "2026-12-31", source: "manual_override" },
    ]);
    // La tabella resta, per lo storico.
    expect(await t.value(`select count(*)::int v from gw_membership_overrides`)).toBe(4);
  });

  it("storico delle validazioni dal gestionale; rollback e riapplicazione", async () => {
    const t = await createTestDb(MIGRATIONS);
    const op = await t.operator();
    const p = await t.value<string>(`select gw_create_person($1, '{"first_name": "Iris", "last_name": "Prova"}'::jsonb) v`, [op]);
    await t.value(`select gw_log_member_validation($1, $2, 'quota_ok', '{"periodo": {"paymentsFrom": "2025-09-01"}}'::jsonb) v`, [op, p]);
    expect(await t.rows(`select action::text, after from gw_audit_log where entity = 'person' and entity_id = $1 and action = 'update'`, [p])).toEqual([
      { action: "update", after: { validazione_manuale: "quota_ok", periodo: { paymentsFrom: "2025-09-01" } } },
    ]);
    expect((await t.error(`select gw_log_member_validation('${op}', '${p}', 'altro', null)`))?.code).toBe("GW400");

    expect((await t.error(readMigration("022_gw_quota_ok")))?.message).toContain("già applicata");
    await t.db.exec("rollback").catch(() => {});
    await t.db.exec(readMigration("022_gw_quota_ok", "down"));
    expect(await t.value(`select count(*)::int v from pg_proc where proname = 'gw_log_member_validation'`)).toBe(0);
    await t.db.exec(readMigration("022_gw_quota_ok"));
    expect(await t.value(`select count(*)::int v from pg_proc where proname = 'gw_log_member_validation'`)).toBe(1);
  });
});
