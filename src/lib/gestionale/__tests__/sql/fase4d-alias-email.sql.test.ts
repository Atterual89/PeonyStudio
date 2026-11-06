// Migrazione 023, parte B2: altri nomi delle persone (anche nell'abbinamento
// automatico) ed email scritta da Ale. Solo PGlite. Dati inventati.

import { beforeEach, describe, expect, it } from "vitest";

import { MIGRATIONS, createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w: string;

beforeEach(async () => {
  t = await createTestDb(MIGRATIONS);
  op = await t.operator("Ale Prova");
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000232', 'Luxuria alias', '2026-11-14', null) v`, [op]);
  await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 50000}'::jsonb) v`, [op, w]);
});

const person = (data: Record<string, unknown>) => t.value<string>(`select gw_create_person($1, $2::jsonb) v`, [op, JSON.stringify(data)]);
const alias = (personId: string, text: string) => t.value<string>(`select gw_add_person_alias($1, $2, $3) v`, [op, personId, text]);
const enter = (entries: unknown[]) =>
  t.value<string>(`select gw_create_booking_entered($1, $2, $3::jsonb, 'prenotato', null, null) v`, [op, w, JSON.stringify(entries)]);
const participants = (booking: string) =>
  t.rows<{ person_id: string; match_status: string; entered_email: string | null }>(
    `select person_id, match_status::text, entered_email from gw_booking_participants where booking_id = $1 order by is_primary desc`,
    [booking],
  );
const emailOf = (id: string) => t.value<string | null>(`select email v from gw_people where id = $1`, [id]);

describe("altri nomi", () => {
  it("l'abbinamento automatico usa anche gli altri nomi (esatto e unico)", async () => {
    const nora = await person({ nickname: "Nora" });
    await alias(nora, "  Brina   Notturna ");
    expect(await t.value(`select alias v from gw_person_aliases where person_id = $1`, [nora])).toBe("Brina Notturna");
    const [entry] = await participants(await enter(["brina notturna"]));
    expect(entry).toMatchObject({ person_id: nora, match_status: "automatico" });
  });

  it("doppione rifiutato: nickname di un'altra persona, alias attivo, proprio nickname; dopo l'eliminazione si può riusare", async () => {
    const nora = await person({ nickname: "Nora" });
    const vela = await person({ nickname: "Vela", first_name: "Vera" });
    expect((await t.error(`select gw_add_person_alias('${op}', '${nora}', 'VELA')`))?.detail).toBe("«VELA» è già usato da Vela.");
    expect((await t.error(`select gw_add_person_alias('${op}', '${nora}', 'nora')`))?.detail).toBe("È già il nickname di questa persona.");
    const id = await alias(nora, "Lupa");
    expect((await t.error(`select gw_add_person_alias('${op}', '${vela}', 'lupà')`))?.detail).toBe("«lupà» è già usato da Nora.");
    await t.value(`select gw_delete_person_alias($1, $2) v`, [op, id]);
    expect(await alias(vela, "Lupa")).toBeTruthy();
    expect(await t.value(`select count(*)::int v from gw_audit_log where entity = 'person_alias'`)).toBe(3);
  });

  it("nuova persona con altri nomi: tutto o niente", async () => {
    await person({ nickname: "Vela" });
    expect((await t.error(`select gw_create_person_with_aliases('${op}', '{"nickname": "Sole"}'::jsonb, '["Raggio", "vela"]'::jsonb)`))?.code).toBe("GW400");
    expect(await t.value(`select count(*)::int v from gw_people where nickname = 'Sole'`)).toBe(0);
    const id = await t.value<string>(`select gw_create_person_with_aliases($1, '{"nickname": "Sole"}'::jsonb, '["Raggio"]'::jsonb) v`, [op]);
    expect(await t.value(`select alias v from gw_person_aliases where person_id = $1`, [id])).toBe("Raggio");
  });
});

describe("email scritta da Ale", () => {
  it("abbina per prima (email esatta), anche se il testo non corrisponde", async () => {
    const ida = await person({ first_name: "Ida", email: "ida@example.test" });
    const [entry] = await participants(await enter([{ text: "Sconosciuta", email: " IDA@example.test " }]));
    expect(entry).toEqual({ person_id: ida, match_status: "automatico", entered_email: "ida@example.test" });
  });

  it("completa la scheda vuota; non sovrascrive un'email diversa; coppia: una per persona", async () => {
    const nebbia = await person({ nickname: "Nebbia" });
    const ortica = await person({ nickname: "Ortica", email: "ortica@example.test" });
    const rows = await participants(
      await enter([
        { text: "Nebbia", email: "nebbia@example.test" },
        { text: "Ortica", email: "altra@example.test" },
      ]),
    );
    expect(rows.map((r) => [r.person_id, r.entered_email])).toEqual([
      [nebbia, "nebbia@example.test"],
      [ortica, "altra@example.test"],
    ]);
    expect(await emailOf(nebbia)).toBe("nebbia@example.test");
    expect(await emailOf(ortica)).toBe("ortica@example.test");
  });

  it("'+ Email' dopo: salva, completa la scheda vuota, rifiuta il formato sbagliato; le voci di solo testo funzionano come prima", async () => {
    const booking = await enter(["Salice"]);
    const [entry] = await participants(booking);
    const participantId = await t.value<string>(`select id v from gw_booking_participants where booking_id = $1`, [booking]);
    expect(entry.entered_email).toBeNull();
    expect((await t.error(`select gw_set_entered_email('${op}', '${participantId}', 'non-una-email')`))?.detail).toBe("Email non valida.");
    await t.value(`select gw_set_entered_email($1, $2, 'salice@example.test') v`, [op, participantId]);
    expect(await emailOf(entry.person_id)).toBe("salice@example.test");
    expect(await t.value(`select entered_email v from gw_booking_participants where id = $1`, [participantId])).toBe("salice@example.test");
  });

  it("rollback e riapplicazione", async () => {
    expect((await t.error(readMigration("023_gw_richieste_associazione")))?.message).toContain("già applicata");
    await t.db.exec("rollback").catch(() => {});
    await t.db.exec(readMigration("023_gw_richieste_associazione", "down"));
    expect(await t.value(`select count(*)::int v from information_schema.columns where column_name = 'entered_email'`)).toBe(0);
    expect(await t.value(`select to_regclass('public.gw_person_aliases') is null v`)).toBe(true);
    // Le iscrizioni di Ale funzionano come prima.
    expect(await enter(["Cardo"])).toBeTruthy();
    await t.db.exec(readMigration("023_gw_richieste_associazione"));
    expect(await t.value(`select to_regclass('public.gw_person_aliases') is not null v`)).toBe(true);
  });
});
