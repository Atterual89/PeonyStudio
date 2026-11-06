// Funzioni gw_* nello stato attuale del database (010 + 011 + 012).
// Casi della specifica sez. 18 (Anagrafica, Prenotazioni) e Fase 2b. Dati inventati.

import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./pglite";

let t: TestDb;
let op: string;
let w1: string;
let w2: string;

const EVENT_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const EVENT_B = "bbbbbbbb-0000-4000-8000-00000000000b";

beforeAll(async () => {
  t = await createTestDb(["010_gw_schema_v1", "011_gw_functions_v2", "012_gw_correzioni_v2b"]);
  op = await t.operator();
  w1 = await ensure(EVENT_A, "Kinbaku Luxuria Level 1", "2026-11-14", "2026-11-15");
  w2 = await ensure(EVENT_B, "Kinbaku Luxuria Level 2", "2027-02-06", null);
});

function ensure(eventId: string, name: string, startsOn: string, endsOn: string | null) {
  return t.value<string>(`select gw_ensure_workshop_for_event($1, $2, $3, $4, $5) v`, [op, eventId, name, startsOn, endsOn]);
}

function person(fields: Record<string, string>) {
  return t.value<string>(`select gw_create_person($1, $2::jsonb) v`, [op, JSON.stringify(fields)]);
}

function book(workshopId: string, people: unknown[], status = "prenotato") {
  return t.value<string>(`select gw_create_booking($1, $2, $3::jsonb, $4, null, null) v`, [
    op,
    workshopId,
    JSON.stringify(people),
    status,
  ]);
}

function bookError(workshopId: string, people: unknown[]) {
  return t.error(`select gw_create_booking($1, $2, $3::jsonb, 'prenotato', null, null)`, [op, workshopId, JSON.stringify(people)]);
}

const ref = (id: string) => ({ person_id: id });

async function participants(bookingId: string) {
  return t.rows<{ id: string; person_id: string; is_primary: boolean; removed_at: string | null }>(
    `select id, person_id, is_primary, removed_at from gw_booking_participants where booking_id = $1 order by is_primary desc, added_at, id`,
    [bookingId],
  );
}

describe("D14 — workshop dall'evento Ticket Tailor", () => {
  it("prima apertura: crea la riga con nome e date dell'evento, con storico", async () => {
    const [row] = await t.rows(`select name, starts_on::text, ends_on::text, event_id::text from gw_workshops where id = $1`, [w1]);
    expect(row).toEqual({ name: "Kinbaku Luxuria Level 1", starts_on: "2026-11-14", ends_on: "2026-11-15", event_id: EVENT_A });
    expect(await t.value(`select ends_on::text v from gw_workshops where id = $1`, [w2])).toBe("2027-02-06");
    expect(await t.value(`select count(*)::int v from gw_audit_log where entity = 'workshop' and entity_id = $1 and action = 'insert'`, [w1])).toBe(1);
  });

  it("seconda apertura e aperture simultanee: nessun doppione", async () => {
    const again = await ensure(EVENT_A, "Kinbaku Luxuria Level 1", "2026-11-14", "2026-11-15");
    const parallel = await Promise.all([1, 2, 3].map(() => ensure(EVENT_A, "Kinbaku Luxuria Level 1", "2026-11-14", "2026-11-15")));
    expect(new Set([again, ...parallel])).toEqual(new Set([w1]));
    expect(await t.value(`select count(*)::int v from gw_workshops where event_id = $1`, [EVENT_A])).toBe(1);
    // L'indice unico impedisce comunque un secondo collegamento allo stesso evento.
    expect((await t.error(`insert into gw_workshops (name, starts_on, event_id) values ('x', '2026-01-01', $1)`, [EVENT_A]))?.code).toBe("23505");
  });

  it("se l'evento cambia nome o date, la copia si aggiorna (con storico)", async () => {
    const w = await ensure("cccccccc-0000-4000-8000-00000000000c", "Luxuria vecchio nome", "2027-04-02", null);
    await ensure("cccccccc-0000-4000-8000-00000000000c", "Luxuria nuovo nome", "2027-04-03", "2027-04-04");
    const [row] = await t.rows(`select name, starts_on::text, version from gw_workshops where id = $1`, [w]);
    expect(row).toEqual({ name: "Luxuria nuovo nome", starts_on: "2027-04-03", version: 2 });
  });

  it("impostazioni: capienza, quota standard, percentuale, descrizione; nome e date invariati", async () => {
    const version = await t.value<number>(`select version v from gw_workshops where id = $1`, [w2]);
    await t.value(`select gw_update_workshop_settings($1, $2, $3, $4::jsonb) v`, [
      op,
      w2,
      version,
      JSON.stringify({ capacity: "8", default_fee_cents: "30000", peony_pct: "40", description: "Note", name: "IGNORATO" }),
    ]);
    const [row] = await t.rows(`select name, capacity, default_fee_cents::int fee, peony_pct::float pct from gw_workshops where id = $1`, [w2]);
    expect(row).toEqual({ name: "Kinbaku Luxuria Level 2", capacity: 8, fee: 30000, pct: 40 });
    expect((await t.error(`select gw_update_workshop_settings($1, $2, $3, '{}'::jsonb)`, [op, w2, version]))?.code).toBe("GW409");
  });

  it("le funzioni non leggono né scrivono la tabella events del sito", async () => {
    expect(await t.value(`select count(*)::int v from public.events`)).toBe(1);
    const bodies = await t.value<string>(`select string_agg(prosrc, ' ') v from pg_proc where proname like 'gw\\_%'`);
    expect(bodies).not.toMatch(/\bevents\b|ticket_tailor/);
  });
});

describe("anagrafica", () => {
  it("persona con solo nickname, completata dopo; conflitto di versione", async () => {
    const p = await person({ nickname: "Nebbia" });
    expect(await t.value(`select gw_update_person($1, $2, 1, $3::jsonb) v`, [op, p, JSON.stringify({ nickname: "Nebbia", first_name: "Ilaria", email: " Nebbia@Example.TEST " })])).toBe(2);
    expect(await t.value(`select email v from gw_people where id = $1`, [p])).toBe("nebbia@example.test");
    expect((await t.error(`select gw_update_person($1, $2, 1, '{"nickname":"X"}'::jsonb)`, [op, p]))?.code).toBe("GW409");
  });
});

describe("D15/D16 — prenotazioni", () => {
  it("singolo: un principale; stato predefinito interessato se non indicato", async () => {
    const p = await person({ nickname: "Solo" });
    const b = await t.value<string>(`select gw_create_booking($1, $2, $3::jsonb, null, null, null) v`, [op, w1, JSON.stringify([ref(p)])]);
    expect(await t.value(`select status::text v from gw_bookings where id = $1`, [b])).toBe("interessato");
    expect((await participants(b)).map((r) => r.is_primary)).toEqual([true]);
  });

  it("coppia: il primo nome è il principale, il partner secondario; una quota sola", async () => {
    const a = await person({ first_name: "Claudia", last_name: "Rosa" });
    const b = await book(w1, [ref(a), { new: { nickname: "Francesco" } }]);
    const rows = await participants(b);
    expect(rows.map((r) => r.is_primary)).toEqual([true, false]);
    expect(rows[0].person_id).toBe(a);
  });

  it("stati nuovi: prenotato, acconto, saldato; 'confermato' non esiste più", async () => {
    const values = await t.value<string[]>(`select enum_range(null::gw_booking_status)::text[] v`);
    expect(values).toEqual(["interessato", "prenotato", "acconto", "saldato", "lista_attesa", "cancellato"]);
    const p = await person({ nickname: "Stati" });
    const b = await book(w1, [ref(p)], "interessato");
    expect(await t.value(`select gw_update_booking_status($1, $2, 1, 'acconto', 'versato') v`, [op, b])).toBe(2);
    expect(await t.value(`select gw_update_booking_status($1, $2, 2, 'saldato', null) v`, [op, b])).toBe(3);
    expect((await t.error(`select gw_update_booking_status($1, $2, 2, 'prenotato', null)`, [op, b]))?.code).toBe("GW409");
    expect((await t.error(`select 'confermato'::gw_booking_status`))?.code).toBe("22P02");
  });

  it("lista d'attesa → prenotato, senza toccare la quota", async () => {
    const p = await person({ nickname: "Attesa" });
    const b = await book(w2, [ref(p)], "lista_attesa");
    await t.db.query(`update gw_bookings set agreed_fee_cents = 30000 where id = $1`, [b]);
    await t.value(`select gw_update_booking_status($1, $2, 1, 'prenotato', null) v`, [op, b]);
    expect(await t.value(`select agreed_fee_cents::int v from gw_bookings where id = $1`, [b])).toBe(30000);
  });

  it("iscrizione duplicata rifiutata; stessa persona in due workshop ammessa", async () => {
    const p = await person({ nickname: "Doppia" });
    await book(w1, [ref(p)]);
    expect((await bookError(w1, [ref(p)]))?.code).toBe("GWDUP");
    expect(await book(w2, [ref(p)])).toBeTruthy();
    expect((await bookError(w2, [ref(p), ref(p)]))?.code).toBeDefined();
  });

  it("aggiunta rapida fallita: la transazione non lascia persone create", async () => {
    const p = await person({ nickname: "GiàDentro" });
    await book(w1, [ref(p)]);
    const before = await t.value<number>(`select count(*)::int v from gw_people`);
    expect((await bookError(w1, [{ new: { nickname: "Larice" } }, ref(p)]))?.code).toBe("GWDUP");
    expect(await t.value(`select count(*)::int v from gw_people`)).toBe(before);
  });

  it("cambia partner: sostituisce solo il secondario; il principale non si toglie", async () => {
    const a = await person({ nickname: "Ramo" });
    const b2 = await person({ nickname: "Salice" });
    const c = await person({ nickname: "Quercia" });
    const b = await book(w2, [ref(a), ref(b2)]);
    const [primary, partner] = await participants(b);

    expect((await t.error(`select gw_set_partner($1, $2, 1, $3, $4::jsonb)`, [op, b, primary.id, JSON.stringify(ref(c))]))?.detail).toContain(
      "solo il partner",
    );
    expect(await t.value(`select gw_set_partner($1, $2, 1, $3, $4::jsonb) v`, [op, b, partner.id, JSON.stringify(ref(c))])).toBe(2);

    const rows = await participants(b);
    const active = rows.filter((r) => !r.removed_at);
    expect(active.map((r) => [r.person_id, r.is_primary])).toEqual([
      [a, true],
      [c, false],
    ]);
    expect(rows.find((r) => r.person_id === b2)?.removed_at).not.toBeNull();
    expect((await t.error(`select gw_set_partner($1, $2, 1, null, $3::jsonb)`, [op, b, JSON.stringify(ref(b2))]))?.code).toBe("GW409");
    expect((await t.error(`select gw_set_partner($1, $2, 2, null, $3::jsonb)`, [op, b, JSON.stringify(ref(b2))]))?.detail).toContain("al massimo due");
  });

  it("separa: il partner diventa principale di una prenotazione autonoma senza quota", async () => {
    const a = await person({ nickname: "Betulla" });
    const p = await person({ nickname: "Ontano" });
    const b = await book(w2, [ref(a), ref(p)]);
    await t.db.query(`update gw_bookings set agreed_fee_cents = 45000 where id = $1`, [b]);
    const [primary, partner] = await participants(b);

    expect((await t.error(`select gw_split_participant($1, $2, 1, $3)`, [op, b, primary.id]))?.detail).toContain("partner");
    const fresh = await t.value<string>(`select gw_split_participant($1, $2, 1, $3) v`, [op, b, partner.id]);

    expect((await participants(fresh)).map((r) => [r.person_id, r.is_primary])).toEqual([[p, true]]);
    expect(await t.value(`select agreed_fee_cents is null and notes like '%quota da rivedere%' v from gw_bookings where id = $1`, [fresh])).toBe(true);
    expect(await t.value(`select agreed_fee_cents::int v from gw_bookings where id = $1`, [b])).toBe(45000);
  });

  it("un solo principale attivo per prenotazione (indice unico)", async () => {
    const a = await person({ nickname: "Uno" });
    const p = await person({ nickname: "Due" });
    const b = await book(w2, [ref(a), ref(p)]);
    const [, partner] = await participants(b);
    expect((await t.error(`update gw_booking_participants set is_primary = true where id = $1`, [partner.id]))?.code).toBe("23505");
  });
});

describe("unione", () => {
  it("bloccata se entrambe iscritte allo stesso workshop; poi riuscita con iscrizioni spostate", async () => {
    const a = await person({ nickname: "Nube" });
    const b = await person({ nickname: "nube", email: "nube@example.test" });
    await book(w1, [ref(a)]);
    const bookingB = await book(w1, [ref(b)]);

    expect((await t.error(`select gw_merge_people($1, $2, 1, $3, 1, '{"nickname":"Nube"}'::jsonb)`, [op, a, b]))?.code).toBe("GWMRG");

    await t.db.query(`update gw_booking_participants set removed_at = now() where booking_id = $1`, [bookingB]);
    await t.value(`select gw_merge_people($1, $2, 1, $3, 1, '{"nickname":"Nube","email":"nube@example.test"}'::jsonb) v`, [op, a, b]);
    expect(await t.value(`select merged_into::text v from gw_people where id = $1`, [b])).toBe(a);
    expect(await t.value(`select count(*)::int v from gw_booking_participants where person_id = $1`, [b])).toBe(0);
    expect((await bookError(w2, [ref(b)]))?.code).toBe("GW400");
  });
});

describe("D17 — rinomina operatore", () => {
  it("rinomina con storico; rifiuta nomi già usati o inesistenti", async () => {
    await t.operator("RedSabbath");
    await t.operator("Laura Test");
    const id = await t.value<string>(`select gw_rename_operator(null, 'redsabbath', 'Ale') v`);
    expect(await t.value(`select display_name v from gw_operators where id = $1`, [id])).toBe("Ale");
    expect(
      await t.value(`select after->>'display_name' v from gw_audit_log where entity = 'operator' and entity_id = $1 order by id desc limit 1`, [id]),
    ).toBe("Ale");
    expect((await t.error(`select gw_rename_operator(null, 'Ale', 'laura test')`))?.detail).toContain("Esiste già");
    expect((await t.error(`select gw_rename_operator(null, 'Nessuno', 'X')`))?.code).toBe("GW404");
  });
});

describe("permessi delle funzioni nuove", () => {
  it("solo la service role", async () => {
    for (const fn of [
      "gw_ensure_workshop_for_event(uuid,uuid,text,date,date)",
      "gw_update_workshop_settings(uuid,uuid,integer,jsonb)",
      "gw_update_booking_status(uuid,uuid,integer,gw_booking_status,text)",
      "gw_rename_operator(uuid,text,text)",
    ]) {
      expect(await t.value(`select has_function_privilege('anon', 'public.${fn}', 'execute') v`), fn).toBe(false);
      expect(await t.value(`select has_function_privilege('authenticated', 'public.${fn}', 'execute') v`), fn).toBe(false);
      expect(await t.value(`select has_function_privilege('service_role', 'public.${fn}', 'execute') v`), fn).toBe(true);
    }
  });
});
