// gw_fill_person_fields per "Completa con i dati del libro soci": persona con
// solo nickname collegata per email; i campi pieni non cambiano; storico.
// Solo PGlite. Dati inventati.

import { describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb } from "./pglite";

describe("completa con i dati del libro soci", () => {
  it("riempie solo i campi vuoti, con storico; seconda volta niente", async () => {
    const t = await createTestDb(MIGRATIONS);
    const op = await t.operator();
    const id = await t.value<string>(`select gw_create_person($1, '{"nickname": "kriko", "membership_email": "quentin@example.test"}'::jsonb) v`, [op]);
    const full = await t.value<string>(`select gw_create_person($1, '{"first_name": "Olmo", "last_name": "Rami", "email": "olmo@example.test"}'::jsonb) v`, [op]);

    expect(await t.value(`select gw_fill_person_fields($1, $2, 'Quentin', 'Brunoir', 'quentin@example.test') v`, [op, id])).toBe(true);
    expect(await t.rows(`select first_name, last_name, email, nickname from gw_people where id = $1`, [id])).toEqual([
      { first_name: "Quentin", last_name: "Brunoir", email: "quentin@example.test", nickname: "kriko" },
    ]);
    const log = await t.rows<{ after: Record<string, unknown> }>(
      `select after from gw_audit_log where entity = 'person' and entity_id = $1 and after->>'nota' = 'campi vuoti presi dal libro soci'`,
      [id],
    );
    expect(log).toHaveLength(1);
    expect(await t.value(`select gw_fill_person_fields($1, $2, 'Quentin', 'Brunoir', 'quentin@example.test') v`, [op, id])).toBe(false);

    expect(await t.value(`select gw_fill_person_fields($1, $2, 'Olmo', 'Ramo', 'altro@example.test') v`, [op, full])).toBe(false);
    expect(await t.rows(`select last_name, email from gw_people where id = $1`, [full])).toEqual([{ last_name: "Rami", email: "olmo@example.test" }]);
  });
});
