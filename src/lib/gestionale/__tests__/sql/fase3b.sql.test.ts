// Migrazione 014: campi vuoti presi dal libro soci, note della prenotazione
// per gli admin, rollback. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, readMigration, type TestDb } from "./pglite";

const ALL = [
  "010_gw_schema_v1",
  "011_gw_functions_v2",
  "012_gw_correzioni_v2b",
  "013_gw_ruoli_pagamenti_v3",
  "014_gw_correzioni_admin_v3b",
] as const;

let t: TestDb;
let op: string;

function member(db: TestDb, fields: { first_name: string | null; last_name: string | null; email: string | null; source?: string }) {
  return db.value<string>(
    `insert into association_members (first_name, last_name, email, source, membership_starts_at, membership_expires_at)
     values ($1, $2, $3, coalesce($4, 'official_members_book'), '2026-01-01', '2026-12-31') returning id v`,
    [fields.first_name, fields.last_name, fields.email, fields.source ?? null],
  );
}

function person(db: TestDb, operator: string, fields: Record<string, string>) {
  return db.value<string>(`select gw_create_person($1, $2::jsonb) v`, [operator, JSON.stringify(fields)]);
}

async function fields(db: TestDb, id: string) {
  const [row] = await db.rows<{ first_name: string | null; last_name: string | null; email: string | null; nickname: string | null }>(
    `select first_name, last_name, email, nickname from gw_people where id = $1`,
    [id],
  );
  return row;
}

function link(db: TestDb, operator: string, personId: string, memberId: string) {
  return db.value<number>(
    `select gw_link_association_member($1, $2, (select version from gw_people where id = $2), $3) v`,
    [operator, personId, memberId],
  );
}

beforeAll(async () => {
  t = await createTestDb(ALL);
  op = await t.operator("Admin Prova");
});

describe("collegamento al libro soci: si riempiono solo i campi vuoti", () => {
  it("'Cerca nel libro soci': vuoti riempiti, pieni invariati, con storico", async () => {
    const m = await member(t, { first_name: "Lavinia", last_name: "Corsi", email: "Lavinia.Corsi@Example.test" });
    const p = await person(t, op, { nickname: "Lavi", first_name: "Lavinia Maria" });
    const version = await link(t, op, p, m);
    expect(await fields(t, p)).toEqual({
      first_name: "Lavinia Maria",
      last_name: "Corsi",
      email: "lavinia.corsi@example.test",
      nickname: "Lavi",
    });
    expect(version).toBe(await t.value(`select version v from gw_people where id = $1`, [p]));
    expect(
      await t.value(`select count(*)::int v from gw_audit_log where entity_id = $1 and after->>'nota' = 'campi vuoti presi dal libro soci'`, [p]),
    ).toBe(1);
  });

  it("socio senza email: l'email resta vuota; se un'altra riga dello stesso socio ce l'ha (una sola), si usa quella", async () => {
    const noEmail = await member(t, { first_name: "Senza", last_name: "Posta", email: null });
    const p1 = await person(t, op, { nickname: "Sp" });
    await link(t, op, p1, noEmail);
    expect(await fields(t, p1)).toMatchObject({ first_name: "Senza", last_name: "Posta", email: null });

    const oldRow = await member(t, { first_name: "Remo", last_name: "Valli", email: null });
    await member(t, { first_name: "Remo", last_name: "Valli", email: "remo@example.test" });
    const p2 = await person(t, op, { nickname: "Remo" });
    await link(t, op, p2, oldRow);
    expect((await fields(t, p2)).email).toBe("remo@example.test");
  });

  it("abbinamento automatico a un socio già collegato: riempie i campi vuoti della persona", async () => {
    const m = await member(t, { first_name: "Brezza", last_name: "Lieve", email: "brezza@example.test" });
    const p = await person(t, op, { nickname: "Brez", association_member_id: m });
    const w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'abababab-0000-4000-8000-0000000000ab', 'Luxuria', '2026-11-14', null) v`, [op]);
    await t.value(`select gw_update_workshop_settings($1, $2, 1, '{"default_fee_cents": 45000}'::jsonb) v`, [op, w]);
    const b = await t.value<string>(`select gw_create_booking_entered($1, $2, '["brezza@example.test"]'::jsonb, 'prenotato', null, null) v`, [op, w]);
    expect(await t.value(`select person_id v from gw_booking_participants where booking_id = $1`, [b])).toBe(p);
    expect(await fields(t, p)).toEqual({ first_name: "Brezza", last_name: "Lieve", email: "brezza@example.test", nickname: "Brez" });
  });
});

describe("admin: solo le note della prenotazione", () => {
  it("gw_update_booking_notes non tocca stato né quota", async () => {
    const w = await t.value<string>(`select gw_ensure_workshop_for_event($1, 'cdcdcdcd-0000-4000-8000-0000000000cd', 'Luxuria 2', '2026-11-14', null) v`, [op]);
    await t.value(`select gw_update_workshop_settings($1, $2, 1, '{"default_fee_cents": 45000}'::jsonb) v`, [op, w]);
    const b = await t.value<string>(`select gw_create_booking_entered($1, $2, '["Nota"]'::jsonb, 'acconto', null, null) v`, [op, w]);
    const version = await t.value<number>(`select version v from gw_bookings where id = $1`, [b]);
    await t.value(`select gw_update_booking_notes($1, $2, $3, '  da richiamare ') v`, [op, b, version]);
    expect(await t.rows(`select status::text, agreed_fee_cents::int, notes from gw_bookings where id = $1`, [b])).toEqual([
      { status: "acconto", agreed_fee_cents: 45000, notes: "da richiamare" },
    ]);
    expect((await t.error(`select gw_update_booking_notes($1, $2, $3, 'x')`, [op, b, version]))?.code).toBe("GW409");
  });
});

describe("014 su dati esistenti e rollback", () => {
  it("riempie i campi vuoti delle persone già collegate; rollback e riapplicazione", async () => {
    const t2 = await createTestDb(ALL.slice(0, 4));
    const op2 = await t2.operator();
    const m = await member(t2, { first_name: "Quercia", last_name: "Alta", email: "quercia@example.test" });
    const linked = await person(t2, op2, { nickname: "Q", association_member_id: m });
    const full = await person(t2, op2, { first_name: "Diverso", last_name: "Nome", email: "altra@example.test", association_member_id: m });

    await t2.db.exec(readMigration("014_gw_correzioni_admin_v3b"));
    expect(await fields(t2, linked)).toEqual({ first_name: "Quercia", last_name: "Alta", email: "quercia@example.test", nickname: "Q" });
    expect(await fields(t2, full)).toEqual({ first_name: "Diverso", last_name: "Nome", email: "altra@example.test", nickname: null });

    expect((await t2.error(readMigration("014_gw_correzioni_admin_v3b")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});

    await t2.db.exec(readMigration("014_gw_correzioni_admin_v3b", "down"));
    expect(await t2.value(`select count(*)::int v from pg_proc where proname in ('gw_fill_person_from_member','gw_member_email','gw_update_booking_notes')`)).toBe(0);
    // Le funzioni ripristinate funzionano ancora.
    const other = await person(t2, op2, { nickname: "Altro" });
    await link(t2, op2, other, m);
    expect((await fields(t2, other)).first_name).toBeNull();

    await t2.db.exec(readMigration("014_gw_correzioni_admin_v3b"));
    expect((await fields(t2, other)).first_name).toBe("Quercia");
  });
});
