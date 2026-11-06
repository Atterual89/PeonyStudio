// Migrazione 017: riga persona semplificata. Modifica dati / collegamento al
// libro soci confermano l'abbinamento; nome e cognome separati dal libro soci;
// dati esistenti; rollback. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, readMigration, type TestDb } from "./pglite";

const ALL = [
  "010_gw_schema_v1",
  "011_gw_functions_v2",
  "012_gw_correzioni_v2b",
  "013_gw_ruoli_pagamenti_v3",
  "014_gw_correzioni_admin_v3b",
  "015_gw_quota_workshop_v3c",
  "016_gw_soci_fonti_admin",
  "017_gw_riga_persona",
] as const;

let t: TestDb;
let op: string;
let w: string;

function member(db: TestDb, fields: { first_name: string; last_name: string; email: string | null; source: string }) {
  return db.value<string>(
    `insert into association_members (first_name, last_name, email, source, membership_starts_at, membership_expires_at)
     values ($1, $2, $3, $4, '2025-10-01', '2026-12-31') returning id v`,
    [fields.first_name, fields.last_name, fields.email, fields.source],
  );
}

function person(db: TestDb, operator: string, fields: Record<string, string>) {
  return db.value<string>(`select gw_create_person($1, $2::jsonb) v`, [operator, JSON.stringify(fields)]);
}

async function names(db: TestDb, id: string) {
  const [row] = await db.rows<{ first_name: string | null; last_name: string | null; email: string | null }>(
    `select first_name, last_name, email from gw_people where id = $1`,
    [id],
  );
  return row;
}

async function enter(text: string) {
  const b = await t.value<string>(`select gw_create_booking_entered($1, $2, $3::jsonb, 'prenotato', null, null) v`, [op, w, JSON.stringify([text])]);
  const [participant] = await t.rows<{ id: string; person_id: string; match_status: string }>(
    `select id, person_id, match_status::text from gw_booking_participants where booking_id = $1`,
    [b],
  );
  return { bookingId: b, ...participant };
}

async function participant(id: string) {
  const [row] = await t.rows<{ match_status: string; auto_created_person: boolean }>(
    `select match_status::text, auto_created_person from gw_booking_participants where id = $1`,
    [id],
  );
  return row;
}

beforeAll(async () => {
  t = await createTestDb(ALL);
  op = await t.operator("Admin Prova");
  w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'eeeeeeee-0000-4000-8000-000000000171', 'Luxuria riga', '2026-03-14', null) v`, [op]);
  await t.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 45000}'::jsonb) v`, [op, w]);
});

describe("l'admin conferma l'abbinamento modificando o collegando la persona", () => {
  it("Modifica dati → da abbinare diventa confermato (persona tenuta), con storico", async () => {
    const entry = await enter("Persona Ignota");
    expect(entry.match_status).toBe("da_abbinare");
    const version = await t.value<number>(`select version v from gw_people where id = $1`, [entry.person_id]);
    await t.value(`select gw_update_person($1, $2, $3, $4::jsonb) v`, [
      op,
      entry.person_id,
      version,
      JSON.stringify({ first_name: "Persona", last_name: "Ignota", email: "ignota@example.test" }),
    ]);
    expect(await participant(entry.id)).toEqual({ match_status: "confermato", auto_created_person: false });
    expect(
      await t.value(`select count(*)::int v from gw_audit_log where entity = 'booking' and entity_id = $1 and action = 'update'`, [entry.bookingId]),
    ).toBe(1);
  });

  it("collegamento al libro soci → confermato; scollegare non conferma", async () => {
    const entry = await enter("Altra Ignota");
    const unlink = await t.value<number>(
      `select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), null, null, null, null) v`,
      [op, entry.person_id],
    );
    expect(unlink).toBeGreaterThan(0);
    expect((await participant(entry.id)).match_status).toBe("da_abbinare");

    await t.value(`select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), null, 'altra@example.test', 'Altra', 'Ignota') v`, [
      op,
      entry.person_id,
    ]);
    expect((await participant(entry.id)).match_status).toBe("confermato");
  });
});

describe("nome e cognome separati dal libro soci", () => {
  it("nome con nome e cognome insieme e cognome vuoto → separati (anche in ordine inverso)", async () => {
    const m = await member(t, { first_name: "Livia", last_name: "Libro", email: "livia@example.test", source: "manual_override" });
    const p1 = await person(t, op, { first_name: "Livia Libro" });
    await t.value(`select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), $3, null, null, null) v`, [op, p1, m]);
    expect(await names(t, p1)).toEqual({ first_name: "Livia", last_name: "Libro", email: "livia@example.test" });

    const p2 = await person(t, op, { first_name: "Libro Livia", email: "mia@example.test" });
    await t.value(`select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), null, 'x@example.test', 'Livia', 'Libro') v`, [op, p2]);
    expect(await names(t, p2)).toEqual({ first_name: "Livia", last_name: "Libro", email: "mia@example.test" });
  });

  it("nome diverso o cognome già pieno: non si tocca", async () => {
    const p = await person(t, op, { first_name: "Livietta Rossa" });
    await t.value(`select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), null, 'y@example.test', 'Livia', 'Libro') v`, [op, p]);
    expect(await names(t, p)).toMatchObject({ first_name: "Livietta Rossa", last_name: null });

    const q = await person(t, op, { first_name: "Livia Libro", last_name: "Altro" });
    await t.value(`select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), null, 'z@example.test', 'Livia', 'Libro') v`, [op, q]);
    expect(await names(t, q)).toMatchObject({ first_name: "Livia Libro", last_name: "Altro" });
  });
});

describe("017 sui dati esistenti e rollback", () => {
  it("separa e compila nome e cognome dal libro soci per le persone collegate o con la stessa email", async () => {
    const t2 = await createTestDb(ALL.slice(0, 7));
    const op2 = await t2.operator();
    await member(t2, { first_name: "Nora", last_name: "Vento", email: "nora@example.test", source: "official_members_book" });
    await member(t2, { first_name: "Olmo", last_name: "Rami", email: "olmo@example.test", source: "official_members_book" });
    // Omonimi diversi con la stessa email: nessuna modifica.
    await member(t2, { first_name: "Pia", last_name: "Uno", email: "doppia@example.test", source: "official_members_book" });
    await member(t2, { first_name: "Pia", last_name: "Due", email: "doppia@example.test", source: "google_sheet" });

    const together = await person(t2, op2, { first_name: "Nora Vento", email: "nora@example.test" });
    const nickname = await person(t2, op2, { nickname: "Olm", membership_email: "olmo@example.test" });
    const ambiguous = await person(t2, op2, { first_name: "Pia", email: "doppia@example.test" });

    await t2.db.exec(readMigration("017_gw_riga_persona"));
    expect(await names(t2, together)).toEqual({ first_name: "Nora", last_name: "Vento", email: "nora@example.test" });
    expect(await names(t2, nickname)).toEqual({ first_name: "Olmo", last_name: "Rami", email: "olmo@example.test" });
    expect(await names(t2, ambiguous)).toEqual({ first_name: "Pia", last_name: null, email: "doppia@example.test" });

    expect((await t2.error(readMigration("017_gw_riga_persona")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});

    await t2.db.exec(readMigration("017_gw_riga_persona", "down"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname = 'gw_confirm_person_matches'`)).toBe(0);
    // Le funzioni ripristinate funzionano ancora; i nomi separati restano.
    const version = await t2.value<number>(`select version v from gw_people where id = $1`, [together]);
    await t2.value(`select gw_update_person($1, $2, $3, '{"first_name": "Nora", "last_name": "Vento"}'::jsonb) v`, [op2, together, version]);
    expect(await names(t2, nickname)).toMatchObject({ first_name: "Olmo", last_name: "Rami" });

    await t2.db.exec(readMigration("017_gw_riga_persona"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname = 'gw_confirm_person_matches'`)).toBe(1);
  });
});
