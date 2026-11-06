// Fase 3 (migrazione 013): ruoli, abbinamento automatico, quota, pagamenti e
// stato automatico, importazione dal testo. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, readMigration, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w: string;

const ALL = ["010_gw_schema_v1", "011_gw_functions_v2", "012_gw_correzioni_v2b", "013_gw_ruoli_pagamenti_v3"] as const;

let eventCounter = 0;
async function workshop(feeCents: number | null = 50000) {
  eventCounter += 1;
  const eventId = `eeeeeeee-0000-4000-8000-${String(eventCounter).padStart(12, "0")}`;
  const id = await t.value<string>(`select gw_ensure_workshop_for_event($1, $2, $3, '2026-11-14', null) v`, [
    op,
    eventId,
    `Luxuria prova ${eventCounter}`,
  ]);
  if (feeCents !== null) await setFee(id, feeCents);
  return id;
}

async function setFee(workshopId: string, feeCents: number | null) {
  const version = await t.value<number>(`select version v from gw_workshops where id = $1`, [workshopId]);
  await t.value(`select gw_update_workshop_settings($1, $2, $3, $4::jsonb) v`, [
    op,
    workshopId,
    version,
    JSON.stringify({ default_fee_cents: feeCents, peony_pct: 30 }),
  ]);
}

function person(fields: Record<string, string>) {
  return t.value<string>(`select gw_create_person($1, $2::jsonb) v`, [op, JSON.stringify(fields)]);
}

function member(fields: Record<string, string | null>) {
  return t.value<string>(
    `insert into association_members (first_name, last_name, email, source, membership_starts_at, membership_expires_at, fiscal_code, birth_date, membership_card_number)
     values ($1, $2, $3, coalesce($4, 'official_members_book'), '2026-01-01', '2026-12-31', 'XXXYYY00A00Z000Z', '1990-01-01', 'T-001') returning id v`,
    [fields.first_name ?? null, fields.last_name ?? null, fields.email ?? null, fields.source ?? null],
  );
}

function enter(workshopId: string, entries: string[], status = "prenotato", feeCents: number | null = null) {
  return t.value<string>(`select gw_create_booking_entered($1, $2, $3::jsonb, $4, $5, null) v`, [
    op,
    workshopId,
    JSON.stringify(entries),
    status,
    feeCents,
  ]);
}

type ParticipantRow = {
  id: string;
  person_id: string;
  entered_as: string;
  match_status: string;
  auto_created_person: boolean;
  possible_duplicate_person_id: string | null;
};

async function participants(bookingId: string) {
  return t.rows<ParticipantRow>(
    `select id, person_id, entered_as, match_status::text, auto_created_person, possible_duplicate_person_id
       from gw_booking_participants where booking_id = $1 and removed_at is null order by is_primary desc`,
    [bookingId],
  );
}

async function booking(bookingId: string) {
  const [row] = await t.rows<{ status: string; agreed_fee_cents: number | null; fee_custom: boolean; version: number }>(
    `select status::text, agreed_fee_cents::int, fee_custom, version from gw_bookings where id = $1`,
    [bookingId],
  );
  return row;
}

function pay(bookingId: string, euros: number, extra: Record<string, unknown> = {}) {
  return t.value<string>(`select gw_add_payment($1, $2, $3::jsonb) v`, [
    op,
    bookingId,
    JSON.stringify({
      kind: "pagamento",
      amount_cents: euros * 100,
      payment_type: "acconto",
      method: "contanti",
      paid_on: "2026-10-01",
      received_by: "redsabbath",
      ...extra,
    }),
  ]);
}

beforeAll(async () => {
  t = await createTestDb(ALL);
  op = await t.operator("Admin Prova");
  w = await workshop();
});

describe("D18 — ruoli", () => {
  it("migrazione: esistenti admin tranne 'Ale'; i nuovi operatori sono organizzatrice", async () => {
    const t2 = await createTestDb(["010_gw_schema_v1", "011_gw_functions_v2", "012_gw_correzioni_v2b"]);
    await t2.operator("Laura Prova");
    await t2.operator("  aLe ");
    await t2.db.exec(readMigration("013_gw_ruoli_pagamenti_v3"));
    const roles = await t2.rows<{ name: string; role: string }>(
      `select btrim(display_name) as name, role::text from gw_operators order by role`,
    );
    expect(roles).toEqual([
      { name: "Laura Prova", role: "admin" },
      { name: "aLe", role: "organizzatrice" },
    ]);
    await t2.operator("Nuova Persona");
    expect(await t2.value(`select role::text v from gw_operators where display_name = 'Nuova Persona'`)).toBe("organizzatrice");

    await t2.value(`select gw_set_operator_role(null, 'nuova persona', 'admin') v`);
    expect(await t2.value(`select role::text v from gw_operators where display_name = 'Nuova Persona'`)).toBe("admin");
    expect((await t2.error(`select gw_set_operator_role(null, 'Nessuno', 'admin')`))?.code).toBe("GW404");
  });

  it("le funzioni nuove non sono eseguibili da anon/authenticated", async () => {
    const exposed = await t.rows(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'gw\\_%'
          and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`,
    );
    expect(exposed).toEqual([]);
  });
});

describe("D20 — abbinamento automatico", () => {
  it("email esatta → collegata, automatico", async () => {
    const p = await person({ nickname: "Ortensia", email: "ortensia@example.test" });
    const b = await enter(w, ["  ORTENSIA@example.test "]);
    const [row] = await participants(b);
    expect(row).toMatchObject({ person_id: p, match_status: "automatico", auto_created_person: false, entered_as: "ORTENSIA@example.test" });
  });

  it("nickname esatto unico (senza accenti e maiuscole) → collegata", async () => {
    const p = await person({ nickname: "Gelsòmino" });
    const [row] = await participants(await enter(w, ["gelsomino"]));
    expect(row).toMatchObject({ person_id: p, match_status: "automatico" });
  });

  it("nome e cognome esatti → collegata", async () => {
    const p = await person({ first_name: "Viola", last_name: "Tremonti" });
    const [row] = await participants(await enter(w, ["viola   TREMONTI"]));
    expect(row).toMatchObject({ person_id: p, match_status: "automatico", entered_as: "viola TREMONTI" });
  });

  it("due omonimi → persona nuova da abbinare", async () => {
    const a = await person({ nickname: "Ginepro" });
    const b = await person({ nickname: "ginepro" });
    const [row] = await participants(await enter(w, ["Ginepro"]));
    expect(row.match_status).toBe("da_abbinare");
    expect([a, b]).not.toContain(row.person_id);
    expect(row.auto_created_person).toBe(true);
  });

  it("socio unico per email → persona creata dal libro soci, senza dati sensibili", async () => {
    const m = await member({ first_name: "Lavanda", last_name: "Serra", email: "lavanda@example.test" });
    const [row] = await participants(await enter(w, ["lavanda@example.test"]));
    expect(row).toMatchObject({ match_status: "automatico", auto_created_person: true });
    const created = await t.rows(
      `select first_name, last_name, nickname, email, association_member_id::text, teamartist_id, notes, phone, instagram
         from gw_people where id = $1`,
      [row.person_id],
    );
    expect(created).toEqual([
      {
        first_name: "Lavanda",
        last_name: "Serra",
        nickname: null,
        email: "lavanda@example.test",
        association_member_id: m,
        teamartist_id: null,
        notes: null,
        phone: null,
        instagram: null,
      },
    ]);
    // Nessun codice fiscale, data di nascita o tessera nello storico.
    const audit = await t.value<string>(`select string_agg(coalesce(after::text, ''), ' ') v from gw_audit_log`);
    expect(audit).not.toMatch(/XXXYYY|1990-01-01|T-001/);
  });

  it("socio per nome e cognome (ordine libero); omonimi con email diverse → nessun abbinamento", async () => {
    await member({ first_name: "Salvia", last_name: "Corti", email: null });
    const [row] = await participants(await enter(w, ["Corti Salvia"]));
    expect(row.match_status).toBe("automatico");

    await member({ first_name: "Timo", last_name: "Neri", email: "timo1@example.test" });
    await member({ first_name: "Timo", last_name: "Neri", email: "timo2@example.test" });
    const [ambiguous] = await participants(await enter(w, ["Timo Neri"]));
    expect(ambiguous.match_status).toBe("da_abbinare");
    expect(await t.value(`select association_member_id v from gw_people where id = $1`, [ambiguous.person_id])).toBeNull();
  });

  it("righe del modulo (google_sheet) non contano come soci", async () => {
    await member({ first_name: "Malva", last_name: "Rizzi", email: "malva@example.test", source: "google_sheet" });
    const [row] = await participants(await enter(w, ["malva@example.test"]));
    expect(row.match_status).toBe("da_abbinare");
    expect(await t.rows(`select nickname, email from gw_people where id = $1`, [row.person_id])).toEqual([
      { nickname: "malva", email: "malva@example.test" },
    ]);
  });

  it("nessuna corrispondenza → nuova da abbinare (una parola nickname, più parole nome+cognome)", async () => {
    const b = await enter(w, ["Zinnia Fabbri De Santis", "Quercia"]);
    const rows = await participants(b);
    expect(rows.map((r) => r.match_status)).toEqual(["da_abbinare", "da_abbinare"]);
    const people = await t.rows(`select first_name, last_name, nickname from gw_people where id = any($1::uuid[]) order by nickname nulls first`, [
      rows.map((r) => r.person_id),
    ]);
    expect(people).toEqual([
      { first_name: "Zinnia", last_name: "Fabbri De Santis", nickname: null },
      { first_name: null, last_name: null, nickname: "Quercia" },
    ]);
  });

  it("già iscritta allo stesso workshop → nessun errore, nuova da abbinare con avviso per l'admin", async () => {
    const p = await person({ nickname: "Edera" });
    await enter(w, ["Edera"]);
    const b = await enter(w, ["edera"]);
    const [row] = await participants(b);
    expect(row).toMatchObject({ match_status: "da_abbinare", possible_duplicate_person_id: p });
    expect(row.person_id).not.toBe(p);
  });

  it("stessa persona scritta due volte nella coppia → il partner è da abbinare", async () => {
    const p = await person({ nickname: "Betulla" });
    const rows = await participants(await enter(w, ["Betulla", "betulla"]));
    expect(rows[0]).toMatchObject({ person_id: p, match_status: "automatico" });
    expect(rows[1]).toMatchObject({ match_status: "da_abbinare", possible_duplicate_person_id: p });
  });

  it("'Non è questa persona' → scollega (la persona esistente resta), torna da abbinare", async () => {
    const p = await person({ nickname: "Acacia" });
    const b = await enter(w, ["Acacia"]);
    const [row] = await participants(b);
    const { version } = await booking(b);
    await t.value(`select gw_reject_match($1, $2, $3, $4) v`, [op, b, version, row.id]);
    const [after] = await participants(b);
    expect(after.match_status).toBe("da_abbinare");
    expect(after.person_id).not.toBe(p);
    expect(await t.value(`select count(*)::int v from gw_people where id = $1`, [p])).toBe(1);
  });

  it("scollegare una persona creata dal libro soci la rimuove se non è usata altrove (con storico)", async () => {
    await member({ first_name: "Mirto", last_name: "Galli", email: "mirto@example.test" });
    const b = await enter(w, ["mirto@example.test"]);
    const [row] = await participants(b);
    await t.value(`select gw_reject_match($1, $2, $3, $4) v`, [op, b, (await booking(b)).version, row.id]);
    expect(await t.value(`select count(*)::int v from gw_people where id = $1`, [row.person_id])).toBe(0);
    expect(await t.value(`select count(*)::int v from gw_audit_log where entity = 'person' and entity_id = $1 and action = 'delete'`, [row.person_id])).toBe(1);
  });

  it("Conferma, Collega, Crea nuova, Unisci", async () => {
    // Conferma
    const p = await person({ nickname: "Alloro" });
    const b1 = await enter(w, ["Alloro"]);
    const [r1] = await participants(b1);
    await t.value(`select gw_confirm_match($1, $2, $3, $4) v`, [op, b1, (await booking(b1)).version, r1.id]);
    expect((await participants(b1))[0]).toMatchObject({ person_id: p, match_status: "confermato" });

    // Collega: la persona creata dal testo, non più usata, viene rimossa.
    const target = await person({ first_name: "Camelia", last_name: "Rota", email: "camelia@example.test" });
    const b2 = await enter(w, ["Cami"]);
    const [r2] = await participants(b2);
    await t.value(`select gw_resolve_match($1, $2, $3, $4, 'collega', $5) v`, [op, b2, (await booking(b2)).version, r2.id, target]);
    expect((await participants(b2))[0]).toMatchObject({ person_id: target, match_status: "confermato" });
    expect(await t.value(`select count(*)::int v from gw_people where id = $1`, [r2.person_id])).toBe(0);

    // Crea nuova: resta la persona creata dal testo.
    const b3 = await enter(w, ["Nespola"]);
    const [r3] = await participants(b3);
    await t.value(`select gw_resolve_match($1, $2, $3, $4, 'crea_nuova', null) v`, [op, b3, (await booking(b3)).version, r3.id]);
    expect((await participants(b3))[0]).toMatchObject({ person_id: r3.person_id, match_status: "confermato", auto_created_person: false });

    // Unisci: la persona dal testo resta come unita, l'email passa se manca.
    const plain = await person({ nickname: "Rovere" });
    const b4 = await enter(w, ["rovere.vero@example.test"]);
    const [r4] = await participants(b4);
    await t.value(`select gw_resolve_match($1, $2, $3, $4, 'unisci', $5) v`, [op, b4, (await booking(b4)).version, r4.id, plain]);
    expect((await participants(b4))[0].person_id).toBe(plain);
    expect(await t.rows(`select merged_into::text from gw_people where id = $1`, [r4.person_id])).toEqual([{ merged_into: plain }]);
    expect(await t.value(`select email v from gw_people where id = $1`, [plain])).toBe("rovere.vero@example.test");

    // Collega a una persona già iscritta: errore chiaro per l'admin.
    const b5 = await enter(w, ["Sconosciuta Qualunque"]);
    const [r5] = await participants(b5);
    expect((await t.error(`select gw_resolve_match($1, $2, $3, $4, 'collega', $5)`, [op, b5, (await booking(b5)).version, r5.id, p]))?.code).toBe("GWDUP");
  });

  it("senza quota standard Ale non può aggiungere", async () => {
    const noFee = await workshop(null);
    const err = await t.error(`select gw_create_booking_entered($1, $2, '["Pino"]'::jsonb, 'prenotato', null, null)`, [op, noFee]);
    expect(err).toMatchObject({ code: "GW400", detail: "Imposta prima la quota del workshop." });
  });
});

describe("D18 — entered_as per le iscrizioni degli admin", () => {
  async function enteredAs(bookingId: string) {
    return (await participants(bookingId)).map((row) => row.entered_as);
  }

  it("aggiunta rapida e partner: nickname, altrimenti solo il nome; mai cognome o email", async () => {
    const ws = await workshop(45000);
    const withNick = await person({ nickname: "Pruno", first_name: "Carlo", last_name: "Segreti", email: "carlo@example.test" });
    const noNick = await person({ first_name: "Livia", last_name: "Riservata", email: "livia@example.test" });
    const b = await t.value<string>(`select gw_create_booking($1, $2, $3::jsonb, 'prenotato', null, null) v`, [
      op,
      ws,
      JSON.stringify([{ person_id: withNick }, { person_id: noNick }]),
    ]);
    expect(await enteredAs(b)).toEqual(["Pruno", "Livia"]);
    expect((await participants(b)).every((row) => row.match_status === "confermato")).toBe(true);

    const solo = await t.value<string>(`select gw_create_booking($1, $2, '[{"new":{"first_name":"Ada","last_name":"Cognomeprivato"}}]'::jsonb, 'prenotato', null, null) v`, [op, ws]);
    const partner = await person({ first_name: "Teo", last_name: "Nascosto" });
    await t.value(`select gw_set_partner($1, $2, $3, null, $4::jsonb) v`, [op, solo, (await booking(solo)).version, JSON.stringify({ person_id: partner })]);
    expect(await enteredAs(solo)).toEqual(["Ada", "Teo"]);

    // Separa: il partner porta con sé il suo entered_as.
    const [, partnerRow] = await participants(solo);
    const split = await t.value<string>(`select gw_split_participant($1, $2, $3, $4) v`, [op, solo, (await booking(solo)).version, partnerRow.id]);
    expect(await enteredAs(split)).toEqual(["Teo"]);

    const all = await t.value<string>(`select string_agg(entered_as, ' ') v from gw_booking_participants where workshop_id = $1`, [ws]);
    expect(all).not.toMatch(/Segreti|Riservata|Cognomeprivato|Nascosto|@/);
  });

  it("la migrazione compila entered_as sulle iscrizioni già presenti", async () => {
    const t2 = await createTestDb(["010_gw_schema_v1", "011_gw_functions_v2", "012_gw_correzioni_v2b"]);
    const op2 = await t2.operator("Laura Prova");
    const ws = await t2.value<string>(`select gw_ensure_workshop_for_event($1, 'ffffffff-0000-4000-8000-00000000000f', 'Luxuria', '2026-11-14', null) v`, [op2]);
    await t2.value(
      `select gw_create_booking($1, $2, '[{"new":{"nickname":"Corbezzolo","first_name":"Mario","last_name":"Rossi"}},{"new":{"first_name":"Anna","last_name":"Bianchi","email":"anna@example.test"}}]'::jsonb, 'prenotato', null, null) v`,
      [op2, ws],
    );
    await t2.db.exec(readMigration("013_gw_ruoli_pagamenti_v3"));
    expect(
      await t2.rows(`select entered_as, match_status::text from gw_booking_participants order by is_primary desc`),
    ).toEqual([
      { entered_as: "Corbezzolo", match_status: "confermato" },
      { entered_as: "Anna", match_status: "confermato" },
    ]);
  });
});

describe("D19 — quota", () => {
  it("nuova prenotazione = quota standard; tariffa dedicata", async () => {
    const ws = await workshop(45000);
    const standard = await enter(ws, ["Coppia Uno", "Coppia Due"]);
    expect(await booking(standard)).toMatchObject({ agreed_fee_cents: 45000, fee_custom: false });

    const dedicated = await enter(ws, ["Dedicata"], "prenotato", 30000);
    expect(await booking(dedicated)).toMatchObject({ agreed_fee_cents: 30000, fee_custom: true });

    // Nella riga: quota cambiata → dedicata; riportata alla standard → non più dedicata.
    let { version } = await booking(standard);
    version = await t.value<number>(`select gw_update_registration($1, $2, $3, 'prenotato', null, 'non_richiesta', 40000) v`, [op, standard, version]);
    expect(await booking(standard)).toMatchObject({ agreed_fee_cents: 40000, fee_custom: true });
    await t.value(`select gw_update_registration($1, $2, $3, 'prenotato', null, 'non_richiesta', 45000) v`, [op, standard, version]);
    expect(await booking(standard)).toMatchObject({ agreed_fee_cents: 45000, fee_custom: false });
    expect(await t.value(`select count(*)::int v from gw_audit_log where entity = 'booking' and entity_id = $1 and action = 'update'`, [standard])).toBe(2);
  });

  it("la prenotazione dell'admin (ricerca) nasce con la quota standard", async () => {
    const ws = await workshop(45000);
    const p = await person({ nickname: "Admin Scelta" });
    const b = await t.value<string>(`select gw_create_booking($1, $2, $3::jsonb, 'prenotato', null, null) v`, [op, ws, JSON.stringify([{ person_id: p }])]);
    expect(await booking(b)).toMatchObject({ agreed_fee_cents: 45000, fee_custom: false });
  });

  it("cambio quota standard: nessuna prenotazione cambia da sola; 'applica a N' con conferma", async () => {
    const ws = await workshop(45000);
    const a = await enter(ws, ["Standard A"]);
    const b = await enter(ws, ["Standard B"]);
    const custom = await enter(ws, ["Dedicata C"], "prenotato", 30000);
    const cancelled = await enter(ws, ["Cancellata D"], "cancellato");

    await setFee(ws, 50000);
    expect((await booking(a)).agreed_fee_cents).toBe(45000);

    // N cambiato nel frattempo → conflitto, nessuna modifica.
    expect((await t.error(`select gw_apply_standard_fee($1, $2, 'precedente', 3)`, [op, ws]))?.code).toBe("GW409");
    expect(await t.value<number>(`select gw_apply_standard_fee($1, $2, 'precedente', 2) v`, [op, ws])).toBe(2);
    expect((await booking(a)).agreed_fee_cents).toBe(50000);
    expect((await booking(b)).agreed_fee_cents).toBe(50000);
    expect((await booking(custom)).agreed_fee_cents).toBe(30000);
    expect((await booking(cancelled)).agreed_fee_cents).toBe(45000);
  });

  it("prenotazioni della Fase 2b senza quota: 'applica a N iscrizioni senza quota'", async () => {
    const ws = await workshop(null);
    const p1 = await person({ nickname: "Vecchia Uno" });
    const p2 = await person({ nickname: "Vecchia Due" });
    const old1 = await t.value<string>(`select gw_create_booking($1, $2, $3::jsonb, 'prenotato', null, null) v`, [op, ws, JSON.stringify([{ person_id: p1 }])]);
    await t.value<string>(`select gw_create_booking($1, $2, $3::jsonb, 'prenotato', null, null) v`, [op, ws, JSON.stringify([{ person_id: p2 }])]);
    expect((await booking(old1)).agreed_fee_cents).toBeNull();

    await setFee(ws, 45000);
    expect((await booking(old1)).agreed_fee_cents).toBeNull();
    expect(await t.value<number>(`select gw_apply_standard_fee($1, $2, 'senza_quota', 2) v`, [op, ws])).toBe(2);
    expect((await booking(old1)).agreed_fee_cents).toBe(45000);
  });
});

describe("D21 — pagamenti e stato automatico", () => {
  it("prenotato → acconto → saldato; rimborso riporta ad acconto; correzione", async () => {
    const ws = await workshop(45000);
    const b = await enter(ws, ["Pagante"]);
    expect((await booking(b)).status).toBe("prenotato");

    await pay(b, 200);
    expect((await booking(b)).status).toBe("acconto");
    const second = await pay(b, 250, { payment_type: "saldo", method: "paypal" });
    expect((await booking(b)).status).toBe("saldato");
    expect(await t.value(`select payment_type::text v from gw_payments where id = $1`, [second])).toBe("saldo");

    await t.value(`select gw_add_payment($1, $2, $3::jsonb) v`, [
      op,
      b,
      JSON.stringify({ kind: "rimborso", amount_cents: 5000, method: "contanti", paid_on: "2026-10-02", received_by: "redsabbath" }),
    ]);
    expect((await booking(b)).status).toBe("acconto");
    expect(await t.value(`select amount_cents::int v from gw_payments where kind = 'rimborso' and booking_id = $1`, [b])).toBe(-5000);

    // Correggi il secondo pagamento: era 300, non 250 → rettifica −250 collegata + nuovo 300.
    await t.value(`select gw_correct_payment($1, $2, $3::jsonb, null) v`, [op, second, JSON.stringify({ amount_cents: 30000, method: "paypal", payment_type: "saldo" })]);
    const rettifica = await t.rows(`select amount_cents::int, corrects_payment_id::text, payment_type::text from gw_payments where kind = 'rettifica' and booking_id = $1`, [b]);
    expect(rettifica).toEqual([{ amount_cents: -25000, corrects_payment_id: second, payment_type: "saldo" }]);
    expect(await t.value(`select sum(amount_cents)::int v from gw_payments where booking_id = $1`, [b])).toBe(45000);
    expect((await booking(b)).status).toBe("saldato");
    // Già annullato: non si corregge due volte.
    expect((await t.error(`select gw_correct_payment($1, $2, null, null)`, [op, second]))?.code).toBe("GW400");

    // Append-only: importo e tipo non si modificano, niente DELETE.
    expect(await t.error(`update gw_payments set payment_type = 'altro' where id = $1`, [second])).not.toBeNull();
    expect(await t.error(`delete from gw_payments where id = $1`, [second])).not.toBeNull();

    // Storico con nota "aggiornato dal pagamento".
    expect(
      await t.value<number>(`select count(*)::int v from gw_audit_log where entity_id = $1 and after->>'nota' = 'aggiornato dal pagamento'`, [b]),
    ).toBeGreaterThanOrEqual(3);
  });

  it("rimborso totale: da acconto torna a prenotato", async () => {
    const ws = await workshop(45000);
    const b = await enter(ws, ["Rimborsata"]);
    const p = await pay(b, 100);
    expect((await booking(b)).status).toBe("acconto");
    await t.value(`select gw_correct_payment($1, $2, null, 'inserito per errore') v`, [op, p]);
    expect((await booking(b)).status).toBe("prenotato");
  });

  it("lista d'attesa e cancellato non cambiano mai da soli", async () => {
    const ws = await workshop(45000);
    const waiting = await enter(ws, ["In Attesa"], "lista_attesa");
    const cancelled = await enter(ws, ["Cancellato Con Soldi"], "cancellato");
    await pay(waiting, 450);
    await pay(cancelled, 100);
    expect((await booking(waiting)).status).toBe("lista_attesa");
    expect((await booking(cancelled)).status).toBe("cancellato");
  });

  it("cambio quota nella riga ricalcola lo stato; il cambio manuale dello stato vince", async () => {
    const ws = await workshop(45000);
    const b = await enter(ws, ["Ricalcolo"]);
    await pay(b, 300);
    expect((await booking(b)).status).toBe("acconto");
    let { version } = await booking(b);
    version = await t.value<number>(`select gw_update_registration($1, $2, $3, 'acconto', null, 'non_richiesta', 30000) v`, [op, b, version]);
    expect(await booking(b)).toMatchObject({ status: "saldato", fee_custom: true });
    // Stato cambiato a mano nello stesso salvataggio: resta quello.
    await t.value(`select gw_update_registration($1, $2, $3, 'interessato', null, 'non_richiesta', 45000) v`, [op, b, (await booking(b)).version]);
    expect((await booking(b)).status).toBe("interessato");
    expect(version).toBeGreaterThan(1);
  });

  it("'applica la nuova quota' ricalcola lo stato", async () => {
    const ws = await workshop(30000);
    const b = await enter(ws, ["Da Ricalcolare"]);
    await pay(b, 300);
    expect((await booking(b)).status).toBe("saldato");
    await setFee(ws, 45000);
    await t.value(`select gw_apply_standard_fee($1, $2, 'precedente', 1) v`, [op, ws]);
    expect((await booking(b)).status).toBe("acconto");
  });
});

describe("Box di testo — gw_import_roster", () => {
  it("tutto o niente; aggiorna un'iscrizione esistente aggiungendo solo i pagamenti", async () => {
    const ws = await workshop(50000);
    const existing = await enter(ws, ["Aster"]);
    const rows = [
      {
        booking_id: null,
        people: ["Corvo"],
        status: "prenotato",
        fee_cents: null,
        invoice_status: "emessa",
        notes: null,
        payments: [
          { amount_cents: 25000, method: "paypal", payment_type: "acconto" },
          { amount_cents: 25000, method: "contanti", payment_type: "altro" },
        ],
      },
      {
        booking_id: null,
        people: ["Fiamma", "Brina"],
        status: "prenotato",
        fee_cents: 58000,
        invoice_status: "non_richiesta",
        notes: "(IG)",
        payments: [{ amount_cents: 18000, method: null, payment_type: "acconto" }],
      },
      {
        booking_id: existing,
        booking_version: (await booking(existing)).version,
        people: ["Aster"],
        payments: [{ amount_cents: 20000, method: "contanti", payment_type: "altro" }],
      },
    ];

    // Una riga non valida → non si salva niente.
    const bad = [...rows, { booking_id: null, people: ["Errore"], status: "prenotato", payments: [{ amount_cents: 0 }] }];
    expect((await t.error(`select gw_import_roster($1, $2, '2026-10-05', 'redsabbath', $3::jsonb)`, [op, ws, JSON.stringify(bad)]))?.code).toBe("GW400");
    expect(await t.value(`select count(*)::int v from gw_bookings where workshop_id = $1`, [ws])).toBe(1);

    const result = await t.value(`select gw_import_roster($1, $2, '2026-10-05', 'redsabbath', $3::jsonb) v`, [op, ws, JSON.stringify(rows)]);
    expect(result).toEqual({ created: 2, updated: 1, payments: 4 });

    const summary = await t.rows(
      `select bp.entered_as, b.status::text, b.agreed_fee_cents::int, b.fee_custom, b.invoice_status::text,
              (select coalesce(sum(amount_cents), 0)::int from gw_payments p where p.booking_id = b.id) paid
         from gw_bookings b join gw_booking_participants bp on bp.booking_id = b.id and bp.is_primary
        where b.workshop_id = $1 order by bp.entered_as`,
      [ws],
    );
    expect(summary).toEqual([
      { entered_as: "Aster", status: "acconto", agreed_fee_cents: 50000, fee_custom: false, invoice_status: "non_richiesta", paid: 20000 },
      { entered_as: "Corvo", status: "saldato", agreed_fee_cents: 50000, fee_custom: false, invoice_status: "emessa", paid: 50000 },
      { entered_as: "Fiamma", status: "acconto", agreed_fee_cents: 58000, fee_custom: true, invoice_status: "non_richiesta", paid: 18000 },
    ]);
    expect(await t.value(`select count(*)::int v from gw_payments p join gw_bookings b on b.id = p.booking_id where b.workshop_id = $1 and p.paid_on = '2026-10-05' and p.received_by = 'redsabbath'`, [ws])).toBe(4);
    expect(await t.value(`select count(*)::int v from gw_audit_log where entity_id = $1 and after->>'origine' = 'importazione testo'`, [ws])).toBe(1);

    // Versione cambiata nel frattempo → conflitto.
    const stale = [{ booking_id: existing, booking_version: 1, people: ["Aster"], payments: [] }];
    expect((await t.error(`select gw_import_roster($1, $2, '2026-10-05', 'redsabbath', $3::jsonb)`, [op, ws, JSON.stringify(stale)]))?.code).toBe("GW409");
  });

  it("senza data dei pagamenti → rifiutato", async () => {
    const err = await t.error(`select gw_import_roster($1, $2, null, 'redsabbath', '[{"people":["X"]}]'::jsonb)`, [op, w]);
    expect(err).toMatchObject({ code: "GW400", detail: "Indica la data dei pagamenti." });
  });
});

describe("013 — rollback e riapplicazione", () => {
  it("rollback toglie colonne, tipi e funzioni; i dati restano; si può riapplicare", async () => {
    const t3 = await createTestDb(ALL);
    const op3 = await t3.operator();
    const ws = await t3.value<string>(`select gw_ensure_workshop_for_event($1, 'dddddddd-0000-4000-8000-00000000000d', 'Luxuria', '2026-11-14', null) v`, [op3]);
    await t3.value(`select gw_update_workshop_settings($1, $2, 1, '{"default_fee_cents": 45000}'::jsonb) v`, [op3, ws]);
    const b = await t3.value<string>(`select gw_create_booking_entered($1, $2, '["Prova"]'::jsonb, 'prenotato', null, null) v`, [op3, ws]);
    await t3.value(`select gw_add_payment($1, $2, '{"amount_cents": 1000, "paid_on": "2026-10-01", "received_by": "peony"}'::jsonb) v`, [op3, b]);

    expect((await t3.error(readMigration("013_gw_ruoli_pagamenti_v3")))?.message).toContain("già applicata");
    await t3.db.exec("rollback").catch(() => {});

    await t3.db.exec(readMigration("013_gw_ruoli_pagamenti_v3", "down"));
    expect(
      await t3.value(
        `select count(*)::int v from information_schema.columns where table_name like 'gw\\_%' and column_name in ('role','fee_custom','entered_as','match_status','payment_type')`,
      ),
    ).toBe(0);
    expect(await t3.value(`select count(*)::int v from pg_type where typname in ('gw_operator_role','gw_match_status','gw_payment_type')`)).toBe(0);
    expect(await t3.value(`select count(*)::int v from pg_proc where proname in ('gw_add_payment','gw_import_roster','gw_norm')`)).toBe(0);
    expect(await t3.value(`select count(*)::int v from gw_payments`)).toBe(1);
    expect(await t3.value(`select count(*)::int v from events`)).toBe(1);

    await t3.db.exec(readMigration("013_gw_ruoli_pagamenti_v3"));
    expect(await t3.value(`select role::text v from gw_operators`)).toBe("admin");
  });
});
