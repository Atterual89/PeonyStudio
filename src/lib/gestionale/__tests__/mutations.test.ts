import { beforeEach, describe, expect, it, vi } from "vitest";

// Client Supabase mockato: si verifica che le scritture chiamino le funzioni
// gw_* con gli argomenti giusti e che gli errori diventino messaggi italiani.
// Il comportamento SQL delle funzioni è verificato a parte (vedi report Fase 2).
const rpc = vi.fn();
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ rpc }) }));

const {
  addPayment,
  correctPayment,
  importRoster,
  resolveMatch,
  setBookingFee,
  updateRegistration,
  createBooking,
  ensureWorkshopForEvent,
  mergePeople,
  setPartner,
  updatePerson,
} = await import("../server/mutations");
const { CONFLICT_MESSAGE } = await import("../errors");

const OPERATOR = "00000000-0000-4000-8000-0000000000aa";

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function fails(code: string, details?: string) {
  rpc.mockResolvedValueOnce({ data: null, error: { code, message: "x", details } });
}

describe("prenotazioni", () => {
  it("singolo: una persona esistente", async () => {
    rpc.mockResolvedValueOnce({ data: "b-1", error: null });
    const result = await createBooking(OPERATOR, {
      workshopId: "w-1",
      people: [{ person_id: "p-1" }],
      status: "prenotato",
      notes: null,
    });
    expect(result).toEqual({ ok: true, data: "b-1" });
    expect(rpc).toHaveBeenCalledWith("gw_create_booking", {
      p_operator_id: OPERATOR,
      p_workshop_id: "w-1",
      p_people: [{ person_id: "p-1" }],
      p_status: "prenotato",
      p_agreed_fee_cents: null,
      p_notes: null,
    });
  });

  it("coppia: due persone in una prenotazione, la prima è il principale; niente quota", async () => {
    rpc.mockResolvedValueOnce({ data: "b-2", error: null });
    await createBooking(OPERATOR, {
      workshopId: "w-1",
      people: [{ person_id: "p-1" }, { new: { nickname: "Salice" } }],
      status: "prenotato",
      notes: null,
    });
    const args = rpc.mock.calls[0][1];
    expect(args.p_people).toEqual([{ person_id: "p-1" }, { new: { nickname: "Salice" } }]);
    expect(args.p_agreed_fee_cents).toBeNull();
  });

  it("iscrizione duplicata nello stesso workshop: messaggio chiaro con il nome", async () => {
    fails("GWDUP", "Nebbia");
    const result = await createBooking(OPERATOR, {
      workshopId: "w-1",
      people: [{ person_id: "p-1" }],
      status: "prenotato",
      notes: null,
    });
    expect(result).toEqual({ ok: false, error: "Nebbia è già iscritto/a a questo workshop." });
  });

  it("gara tra due salvataggi (indice unico): stesso messaggio", async () => {
    fails("23505");
    const result = await createBooking(OPERATOR, {
      workshopId: "w-1",
      people: [{ person_id: "p-1" }],
      status: "prenotato",
      notes: null,
    });
    expect(result.ok === false && result.error).toContain("già iscritta");
  });

  it("cambio partner: toglie il vecchio partecipante e aggiunge il nuovo nella stessa chiamata", async () => {
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    await setPartner(OPERATOR, {
      bookingId: "b-1",
      version: 2,
      removeParticipantId: "bp-old",
      addPerson: { person_id: "p-new" },
    });
    expect(rpc).toHaveBeenCalledWith("gw_set_partner", {
      p_operator_id: OPERATOR,
      p_booking_id: "b-1",
      p_version: 2,
      p_remove_participant_id: "bp-old",
      p_add_person: { person_id: "p-new" },
    });
  });
});

describe("D14 — apertura evento", () => {
  it("passa id, nome e date (Roma) dell'evento a gw_ensure_workshop_for_event", async () => {
    rpc.mockResolvedValueOnce({ data: "w-1", error: null });
    const result = await ensureWorkshopForEvent(OPERATOR, { id: "ev-1", name: "Luxuria", startsOn: "2026-11-14", endsOn: null });
    expect(result).toEqual({ ok: true, data: "w-1" });
    expect(rpc).toHaveBeenCalledWith("gw_ensure_workshop_for_event", {
      p_operator_id: OPERATOR,
      p_event_id: "ev-1",
      p_name: "Luxuria",
      p_starts_on: "2026-11-14",
      p_ends_on: null,
    });
  });
});

describe("conflitto di versione", () => {
  it("prenotazione e persona: messaggio di conflitto senza 'operatore' (4g, #19)", async () => {
    fails("GW409");
    const booking = await updateRegistration(OPERATOR, { bookingId: "b-1", version: 1, status: "cancellato", notes: null, invoiceStatus: "non_richiesta" });
    expect(booking).toEqual({ ok: false, error: CONFLICT_MESSAGE });

    fails("GW409");
    const person = await updatePerson(OPERATOR, "p-1", 1, {
      nickname: "X",
      first_name: null,
      last_name: null,
      email: null,
      instagram: null,
      phone: null,
      teamartist_id: null,
      notes: null,
    });
    expect(person).toEqual({ ok: false, error: CONFLICT_MESSAGE });
    expect(CONFLICT_MESSAGE).toBe("Questi dati sono appena stati cambiati da qualcun altro.");
  });
});

describe("unione", () => {
  const values = {
    nickname: "Nebbia",
    first_name: null,
    last_name: null,
    email: null,
    instagram: null,
    phone: null,
    teamartist_id: null,
    notes: null,
    association_member_id: null,
  };

  it("passa entrambe le versioni e i valori scelti", async () => {
    rpc.mockResolvedValueOnce({ data: 4, error: null });
    await mergePeople(OPERATOR, { id: "p-1", version: 3 }, { id: "p-2", version: 1 }, values);
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_primary_id: "p-1",
      p_primary_version: 3,
      p_secondary_id: "p-2",
      p_secondary_version: 1,
      p_values: values,
    });
  });

  it("unione bloccata: indica il workshop in comune", async () => {
    fails("GWMRG", "Corso Alfa");
    const result = await mergePeople(OPERATOR, { id: "p-1", version: 3 }, { id: "p-2", version: 1 }, values);
    expect(result.ok === false && result.error).toContain("Corso Alfa");
  });

  it("errori inattesi: messaggio generico, dettagli solo nel log del server", async () => {
    fails("XX000");
    const result = await mergePeople(OPERATOR, { id: "p-1", version: 3 }, { id: "p-2", version: 1 }, values);
    expect(result).toEqual({ ok: false, error: "Salvataggio non riuscito. Riprova; i dati inseriti sono ancora nel modulo." });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("Fase 3 — wrapper delle funzioni 013", () => {
  it("chiamano le funzioni gw_* giuste con gli argomenti attesi", async () => {
    rpc.mockResolvedValue({ data: "x", error: null });

    await updateRegistration(OPERATOR, { bookingId: "b-1", version: 2, status: "acconto", notes: null, invoiceStatus: "emessa" });
    await setBookingFee(OPERATOR, "b-1", 3, 58000);
    await addPayment(OPERATOR, "b-1", {
      kind: "pagamento",
      amount_cents: 20000,
      payment_type: "acconto",
      method: "paypal",
      paid_on: "2026-10-01",
      received_by: "redsabbath",
      description: null,
    });
    await correctPayment(OPERATOR, "p-1", null, "doppione");
    await importRoster(OPERATOR, { workshopId: "w-1", paidOn: "2026-10-05", receivedBy: "redsabbath", rows: [] });
    await resolveMatch(OPERATOR, { bookingId: "b-1", version: 2, participantId: "bp-1" }, "collega", "p-9");

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "gw_update_registration",
      "gw_set_booking_fee",
      "gw_add_payment",
      "gw_correct_payment",
      "gw_import_roster",
      "gw_resolve_match",
    ]);
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("p_fee_cents");
    expect(rpc.mock.calls[1][1]).toEqual({ p_operator_id: OPERATOR, p_booking_id: "b-1", p_version: 3, p_fee_cents: 58000 });
    expect(rpc.mock.calls[2][1]).toMatchObject({ p_booking_id: "b-1", p_data: { amount_cents: 20000, received_by: "redsabbath" } });
    expect(rpc.mock.calls[5][1]).toMatchObject({ p_action: "collega", p_target: "p-9", p_participant_id: "bp-1" });
  });
});
