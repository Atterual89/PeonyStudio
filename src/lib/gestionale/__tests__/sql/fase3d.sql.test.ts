// Migrazione 016: collegamento al socio come la pagina admin. association_member_id
// solo per le validazioni manuali, membership_email per libro soci e modulo;
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
] as const;

let t: TestDb;
let op: string;
let eventCounter = 0;

function member(db: TestDb, fields: { first_name: string | null; last_name: string | null; email: string | null; source: string }) {
  return db.value<string>(
    `insert into association_members (first_name, last_name, email, source, membership_starts_at, membership_expires_at, fiscal_code)
     values ($1, $2, $3, $4, '2025-10-01', '2026-12-31', 'XXXYYY00A00Z000Z') returning id v`,
    [fields.first_name, fields.last_name, fields.email, fields.source],
  );
}

function person(db: TestDb, operator: string, fields: Record<string, string>) {
  return db.value<string>(`select gw_create_person($1, $2::jsonb) v`, [operator, JSON.stringify(fields)]);
}

async function link(db: TestDb, id: string) {
  const [row] = await db.rows<{ association_member_id: string | null; membership_email: string | null; first_name: string | null; last_name: string | null; email: string | null }>(
    `select association_member_id, membership_email, first_name, last_name, email from gw_people where id = $1`,
    [id],
  );
  return row;
}

async function workshop(db: TestDb, operator: string) {
  eventCounter += 1;
  const id = await db.value<string>(`select gw_ensure_workshop_for_event($1, $2, $3, '2026-03-14', null) v`, [
    operator,
    `eeeeeeee-0000-4000-8000-${String(eventCounter).padStart(12, "0")}`,
    `Luxuria soci ${eventCounter}`,
  ]);
  await db.value(`select gw_update_workshop_settings($1, $2, (select version from gw_workshops where id = $2), '{"default_fee_cents": 45000}'::jsonb) v`, [
    operator,
    id,
  ]);
  return id;
}

function setLink(db: TestDb, operator: string, id: string, memberId: string | null, email: string | null, first: string | null = null, last: string | null = null) {
  return db.value<number>(
    `select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), $3, $4, $5, $6) v`,
    [operator, id, memberId, email, first, last],
  );
}

beforeAll(async () => {
  t = await createTestDb(ALL);
  op = await t.operator("Admin Prova");
});

describe("collegamento al socio (016)", () => {
  it("validazione manuale: per id, campi vuoti dalla tabella; righe non manuali per id rifiutate", async () => {
    const manual = await member(t, { first_name: "Marta", last_name: "Manuale", email: "Marta@Example.test", source: "manual_override" });
    const book = await member(t, { first_name: "Livia", last_name: "Libro", email: "livia@example.test", source: "official_members_book" });
    const p = await person(t, op, { nickname: "Mar" });

    await setLink(t, op, p, manual, null);
    expect(await link(t, p)).toEqual({ association_member_id: manual, membership_email: null, first_name: "Marta", last_name: "Manuale", email: "marta@example.test" });

    expect((await t.error(`select gw_set_membership_link($1, $2, (select version from gw_people where id = $2), $3, null, null, null)`, [op, p, book]))?.code).toBe("GW400");

    await setLink(t, op, p, null, null);
    expect(await link(t, p)).toMatchObject({ association_member_id: null, membership_email: null });
  });

  it("libro soci / modulo (Google Sheet): per email, campi vuoti dai dati passati dal server", async () => {
    const p = await person(t, op, { nickname: "Gine" });
    await setLink(t, op, p, null, "Ginevra.Sheet@Example.test", "Ginevra", "Sheet");
    expect(await link(t, p)).toEqual({
      association_member_id: null,
      membership_email: "ginevra.sheet@example.test",
      first_name: "Ginevra",
      last_name: "Sheet",
      email: "ginevra.sheet@example.test",
    });
    expect(
      await t.value(`select count(*)::int v from gw_audit_log where entity_id = $1 and action = 'update' and before ? 'membership_email'`, [p]),
    ).toBe(1);
  });

  it("trigger: un id di riga non manuale diventa la sua email (tutte le funzioni esistenti)", async () => {
    const book = await member(t, { first_name: "Olga", last_name: "Ufficiale", email: "olga@example.test", source: "official_members_book" });
    const p = await person(t, op, { first_name: "Olga", association_member_id: book });
    expect(await link(t, p)).toMatchObject({ association_member_id: null, membership_email: "olga@example.test" });
  });

  it("abbinamento automatico di Ale: la persona collegata per email al socio si ritrova", async () => {
    const w = await workshop(t, op);
    await member(t, { first_name: "Priscilla", last_name: "Rami", email: "prisci@example.test", source: "official_members_book" });
    const p = await person(t, op, { nickname: "Prix" });
    await setLink(t, op, p, null, "prisci@example.test");

    const b = await t.value<string>(`select gw_create_booking_entered($1, $2, '["Priscilla Rami"]'::jsonb, 'prenotato', null, null) v`, [op, w]);
    const [row] = await t.rows<{ person_id: string; match_status: string }>(
      `select person_id, match_status::text from gw_booking_participants where booking_id = $1`,
      [b],
    );
    expect(row).toEqual({ person_id: p, match_status: "automatico" });
    // Campi vuoti presi dal socio.
    expect(await link(t, p)).toMatchObject({ first_name: "Priscilla", last_name: "Rami" });
  });

  it("riga da abbinare → 'Collega' a un socio del Google Sheet (gw_resolve_match_membership)", async () => {
    const w = await workshop(t, op);
    const b = await t.value<string>(`select gw_create_booking_entered($1, $2, '["Testo Sconosciuto"]'::jsonb, 'prenotato', null, null) v`, [op, w]);
    const [participant] = await t.rows<{ id: string; person_id: string; match_status: string }>(
      `select id, person_id, match_status::text from gw_booking_participants where booking_id = $1`,
      [b],
    );
    expect(participant.match_status).toBe("da_abbinare");
    const version = await t.value<number>(`select version v from gw_bookings where id = $1`, [b]);

    await t.value(`select gw_resolve_match_membership($1, $2, $3, $4, null, 'sole@example.test', 'Sole', 'Foglio') v`, [op, b, version, participant.id]);
    const [after] = await t.rows<{ person_id: string; match_status: string }>(
      `select person_id, match_status::text from gw_booking_participants where id = $1`,
      [participant.id],
    );
    expect(after.match_status).toBe("confermato");
    expect(await link(t, after.person_id)).toEqual({
      association_member_id: null,
      membership_email: "sole@example.test",
      first_name: "Sole",
      last_name: "Foglio",
      email: "sole@example.test",
    });
    // La persona creata dal testo, non più usata, è stata rimossa.
    expect(await t.value(`select count(*)::int v from gw_people where id = $1`, [participant.person_id])).toBe(0);
  });
});

describe("016 sui dati esistenti e rollback", () => {
  it("i collegamenti a righe non manuali diventano email; le validazioni manuali restano per id", async () => {
    const t2 = await createTestDb(ALL.slice(0, 6));
    const op2 = await t2.operator();
    const book = await member(t2, { first_name: "Quinta", last_name: "Libro", email: "Quinta@Example.test", source: "official_members_book" });
    const form = await member(t2, { first_name: "Rea", last_name: "Modulo", email: "rea@example.test", source: "google_sheet" });
    const manual = await member(t2, { first_name: "Sara", last_name: "Manuale", email: "sara@example.test", source: "manual_override" });
    const pBook = await person(t2, op2, { nickname: "Q", association_member_id: book });
    const pForm = await person(t2, op2, { nickname: "R", association_member_id: form });
    const pManual = await person(t2, op2, { nickname: "S", association_member_id: manual });

    await t2.db.exec(readMigration("016_gw_soci_fonti_admin"));
    expect(await link(t2, pBook)).toMatchObject({ association_member_id: null, membership_email: "quinta@example.test" });
    expect(await link(t2, pForm)).toMatchObject({ association_member_id: null, membership_email: "rea@example.test" });
    expect(await link(t2, pManual)).toMatchObject({ association_member_id: manual, membership_email: null });

    expect((await t2.error(readMigration("016_gw_soci_fonti_admin")))?.message).toContain("già applicata");
    await t2.db.exec("rollback").catch(() => {});

    await t2.db.exec(readMigration("016_gw_soci_fonti_admin", "down"));
    // Rollback: il collegamento per email torna alla riga del libro soci con quella email (il modulo no).
    const [restored] = await t2.rows<{ association_member_id: string | null }>(`select association_member_id from gw_people where id = $1`, [pBook]);
    expect(restored.association_member_id).toBe(book);
    expect(
      await t2.value(`select count(*)::int v from information_schema.columns where table_name = 'gw_people' and column_name = 'membership_email'`),
    ).toBe(0);
    // Le funzioni ripristinate funzionano ancora.
    const again = await person(t2, op2, { nickname: "T", association_member_id: book });
    expect(again).toBeTruthy();

    await t2.db.exec(readMigration("016_gw_soci_fonti_admin"));
    expect(await link(t2, again)).toMatchObject({ association_member_id: null, membership_email: "quinta@example.test" });
  });
});
