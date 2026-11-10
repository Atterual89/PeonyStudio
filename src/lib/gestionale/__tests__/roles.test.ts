// D18 — sicurezza dei ruoli, lato server. Sessione simulata (cookie + riga di
// gw_sessions): con un'organizzatrice ogni azione, pagina e loader riservati
// agli admin risponde 404; i loader di Ale non restituiscono dati anagrafici.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
const REDIRECT = "NEXT_REDIRECT";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
  redirect: () => {
    throw new Error(REDIRECT);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token-di-prova" }), set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

// --- Database simulato: registra le select e risponde per tabella. ---------
let role: "admin" | "organizzatrice" = "organizzatrice";
const selects: { table: string; columns: string }[] = [];
const rpc = vi.fn(async () => ({ data: null, error: { code: "XX000", message: "rpc non attesa nei test" } }));
let bookingRows: unknown[] = [];
let participantRows: unknown[] = [];
let workshopRow: unknown = null;
let paymentRows: unknown[] = [];

function sessionRow() {
  const now = new Date();
  return {
    id: "00000000-0000-4000-8000-0000000000s1",
    operator_id: "00000000-0000-4000-8000-0000000000o1",
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 86_400_000).toISOString(),
    revoked_at: null,
    gw_operators: { id: "00000000-0000-4000-8000-0000000000o1", display_name: "Operatrice Prova", active: true, role },
  };
}

function query(table: string) {
  const result = () => {
    if (table === "gw_sessions") return { data: sessionRow(), error: null };
    if (table === "gw_bookings") return { data: bookingRows, error: null };
    if (table === "gw_booking_participants") return { data: participantRows, error: null };
    if (table === "gw_workshops") return { data: workshopRow, error: null };
    if (table === "gw_payments") return { data: paymentRows, error: null };
    return { data: [], error: null };
  };
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "in", "is", "not", "order", "range", "limit", "gt", "update", "insert"]) {
    builder[method] = () => builder;
  }
  builder.select = (columns: string) => {
    selects.push({ table, columns });
    return builder;
  };
  builder.maybeSingle = async () => result();
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return builder;
}

vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query, rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: query }) }));

const UUID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  selects.length = 0;
  rpc.mockClear();
  bookingRows = [];
  participantRows = [];
  workshopRow = null;
  paymentRows = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  role = "organizzatrice";
});

async function rejectsNotFound(promise: Promise<unknown>) {
  await expect(promise).rejects.toThrow(NOT_FOUND);
}

describe("requireAdmin", () => {
  it("404 per l'organizzatrice, ok per l'admin; il ruolo arriva dalla sessione", async () => {
    const { requireAdmin, requireOperator } = await import("../server/auth");
    await rejectsNotFound(requireAdmin());
    expect((await requireOperator()).role).toBe("organizzatrice");

    role = "admin";
    expect((await requireAdmin()).role).toBe("admin");
  });

  it("ruolo mancante o sconosciuto = organizzatrice (privilegio minimo)", async () => {
    const { roleOf } = await import("../auth-core");
    expect(roleOf({ role: undefined })).toBe("organizzatrice");
    expect(roleOf({ role: null })).toBe("organizzatrice");
    expect(roleOf({ role: "superuser" as never })).toBe("organizzatrice");
    expect(roleOf({ role: "admin" })).toBe("admin");
  });
});

describe("requireOrganizer (3b)", () => {
  it("404 per l'admin, ok per l'organizzatrice", async () => {
    const { requireOrganizer } = await import("../server/auth");
    expect((await requireOrganizer()).role).toBe("organizzatrice");
    role = "admin";
    await rejectsNotFound(requireOrganizer());
  });
});

describe("admin: niente parte economica (3b)", () => {
  it("ogni azione del tab Iscrizioni (stato, quote, pagamenti, importazione) rifiuta l'admin", async () => {
    role = "admin";
    const actions = Object.entries(await import("@/app/gestione/(app)/w/registration-actions")).filter(
      ([, value]) => typeof value === "function",
    );
    expect(actions.map(([name]) => name).sort()).toEqual([
      "addPaymentAction",
      "addRegistrationAction",
      "correctPaymentAction",
      "importRosterAction",
      "previewMatchesAction",
      "refundBookingAction",
      "setBookingFeeAction",
      "setEnteredEmailAction",
      "updateEnteredParticipantAction",
      "updateRegistrationAction",
      "updateWorkshopFeeAction",
    ]);
    for (const [, action] of actions) {
      await rejectsNotFound(
        (action as (input: unknown) => Promise<unknown>)({
          workshopId: UUID,
          bookingId: UUID,
          paymentId: UUID,
          version: 1,
          person: "Nome",
          status: "prenotato",
          fee: "450",
          rows: [],
        }),
      );
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aggiunta rapida admin: solo stati non economici, quota sempre standard (nessuna quota inviata)", async () => {
    role = "admin";
    const { addBookingAction } = await import("@/app/gestione/(app)/w/actions");
    const person = { kind: "existing", id: UUID, label: "Prova" };

    for (const status of ["acconto", "saldato", "cancellato"]) {
      expect(await addBookingAction({ workshopId: UUID, person, partner: null, status, notes: "" })).toEqual({
        ok: false,
        error: "Dati non validi. Ricarica la pagina e riprova.",
      });
    }
    expect(rpc).not.toHaveBeenCalled();

    for (const status of ["interessato", "prenotato", "lista_attesa"]) {
      await addBookingAction({ workshopId: UUID, person, partner: null, status, notes: "" });
    }
    expect((rpc.mock.calls as unknown as [string][]).map(([name]) => name)).toEqual(["gw_create_booking", "gw_create_booking", "gw_create_booking"]);
    for (const [, args] of rpc.mock.calls as unknown as [string, Record<string, unknown>][]) {
      expect(args.p_agreed_fee_cents).toBeNull();
    }
  });

  it("nessuna azione admin per cambiare stato o quota, né per separare", async () => {
    const exported = Object.keys(await import("@/app/gestione/(app)/w/actions"));
    for (const removed of ["updateBookingStatusAction", "splitParticipantAction"]) {
      expect(exported).not.toContain(removed);
    }
    expect(exported).toEqual(expect.arrayContaining(["addBookingAction", "setPartnerAction", "updateBookingNotesAction"]));
  });
});

describe("organizzatrice: azioni admin → 404, senza toccare il database", () => {
  const modules = {
    "w/actions": () => import("@/app/gestione/(app)/w/actions"),
    "cerca/actions": () => import("@/app/gestione/(app)/cerca/actions"),
    "p/actions": () => import("@/app/gestione/(app)/p/actions"),
  };

  for (const [name, load] of Object.entries(modules)) {
    it(name, async () => {
      const actions = Object.entries(await load()).filter(([, value]) => typeof value === "function");
      expect(actions.length).toBeGreaterThan(0);
      for (const [, action] of actions) {
        await rejectsNotFound((action as (input: unknown) => Promise<unknown>)({ id: UUID, workshopId: UUID, bookingId: UUID }));
      }
      expect(rpc).not.toHaveBeenCalled();
      expect(selects.filter((s) => s.table !== "gw_sessions")).toEqual([]);
    });
  }
});

describe("organizzatrice: loader riservati → 404", () => {
  it("anagrafica, storico, prenotazioni con persone, libro soci, stato socio", async () => {
    const data = await import("../server/data");
    const membership = await import("../server/membership");
    const workshop = { id: UUID, startsOn: "2026-11-14" } as never;

    await rejectsNotFound(data.loadPeople());
    await rejectsNotFound(data.getPersonHistory(UUID));
    await rejectsNotFound(data.getRecentWorkshops([UUID]));
    await rejectsNotFound(data.getWorkshopBookings(workshop));
    await rejectsNotFound(data.getEnrolledPersonIds(UUID));
    const person = { id: UUID, first_name: "Rosa", last_name: "Rossi", email: null, association_member_id: null, membership_email: null };
    await rejectsNotFound(membership.getMembershipBadges([person], "2026-11-14"));
    await rejectsNotFound(membership.searchMembers("rossi"));
    await rejectsNotFound(membership.getMemberSummary(`m:${UUID}`));
    await rejectsNotFound(membership.getMemberSummary("non una chiave"));
    await rejectsNotFound(membership.getMemberLink("e:rosa@example.test"));
    await rejectsNotFound(membership.getMemberBadge(`m:${UUID}`, "2026-11-14"));
    // Fase 5: elenco degli operatori dello storico, collegamento in blocco al libro soci.
    const audit = await import("../server/audit");
    await rejectsNotFound(audit.listOperatorNames());
    await rejectsNotFound(membership.listUnlinkedMembers());
    await rejectsNotFound((await import("../server/member-links")).findMemberLinkProposals());

    expect(selects.map((s) => s.table).filter((t) => t !== "gw_sessions")).toEqual([]);
  });
});

describe("organizzatrice: pagine riservate → 404", () => {
  it("Persone, Cerca, scheda persona, unione", async () => {
    const persone = (await import("@/app/gestione/(app)/persone/page")).default;
    const cerca = (await import("@/app/gestione/(app)/cerca/page")).default;
    const scheda = (await import("@/app/gestione/(app)/p/[id]/page")).default;
    const unisci = (await import("@/app/gestione/(app)/p/[id]/unisci/[otherId]/page")).default;

    await rejectsNotFound(persone({ searchParams: Promise.resolve({}) }));
    await rejectsNotFound(cerca({ searchParams: Promise.resolve({}) }));
    await rejectsNotFound(scheda({ params: Promise.resolve({ id: UUID }) }));
    await rejectsNotFound(unisci({ params: Promise.resolve({ id: UUID, otherId: UUID }) }));
  });

  it("Fase 5: collegamento al libro soci", async () => {
    const soci = (await import("@/app/gestione/(app)/altro/soci/page")).default;
    await rejectsNotFound(soci({ searchParams: Promise.resolve({}) }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("D27: lo storico per l'organizzatrice chiede a Postgres la sua vista, senza filtri per persona o operatore", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null } as never);
    const audit = await import("../server/audit");
    await audit.getAuditPage({ operatorId: UUID, workshopId: null, kind: "anagrafica", personId: UUID, page: 1 });
    expect(rpc).toHaveBeenCalledWith(
      "gw_audit_list",
      expect.objectContaining({ p_viewer_role: "organizzatrice", p_filter_operator: null, p_person_id: null, p_kind: null }),
    );
  });

  it("?tab= di un admin rifiutato lato server (anche prima di leggere il workshop)", async () => {
    const { resolveWorkshopTab } = await import("../tabs");
    expect(resolveWorkshopTab("organizzatrice", undefined)).toBe("iscrizioni");
    expect(resolveWorkshopTab("organizzatrice", "partecipanti")).toBeNull();
    expect(resolveWorkshopTab("organizzatrice", "pagamenti")).toBeNull();
    expect(resolveWorkshopTab("organizzatrice", ["info", "info"])).toBeNull();
    expect(resolveWorkshopTab("organizzatrice", "info")).toBe("info");
    expect(resolveWorkshopTab("admin", undefined)).toBe("partecipanti");
    expect(resolveWorkshopTab("admin", "iscrizioni")).toBeNull();

    const page = (await import("@/app/gestione/(app)/w/[id]/page")).default;
    await rejectsNotFound(page({ params: Promise.resolve({ id: UUID }), searchParams: Promise.resolve({ tab: "partecipanti" }) }));
    expect(selects.map((s) => s.table).filter((t) => t !== "gw_sessions")).toEqual([]);
  });
});

describe("loader di Ale: solo identità minima dei profili confermati", () => {
  const FORBIDDEN_KEYS = [
    "person",
    "person_id",
    "personId",
    "first_name",
    "last_name",
    "instagram",
    "phone",
    "teamartist_id",
    "association_member_id",
    "membership",
    "displayName",
    "fiscal_code",
    "birth_date",
    "display_name",
  ];

  function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((item) => allKeys(item, keys));
    else if (value && typeof value === "object") {
      for (const [key, inner] of Object.entries(value)) {
        keys.add(key);
        allKeys(inner, keys);
      }
    }
    return keys;
  }

  it("getRegistrations espone soltanto nome, nickname ed email del profilo confermato", async () => {
    // La seconda prenotazione è stata inserita da un admin: entered_as è il
    // nome visualizzato salvato all'inserimento (nickname o solo nome).
    // Anche se il database restituisse campi in più, il loader non li inoltra.
    bookingRows = [
      {
        id: UUID,
        version: 2,
        status: "acconto",
        notes: null,
        invoice_status: "non_richiesta",
        agreed_fee_cents: "45000",
        fee_custom: false,
        created_at: "2026-10-01T10:00:00Z",
        email: "intrusa@example.test",
        gw_operators: { role: "organizzatrice", display_name: "Nome Operatrice" },
        gw_booking_participants: [
          { id: "pa", is_primary: true, entered_as: "Claudia", entered_email: "claudia@scritta-da-ale.test", removed_at: null, person_id: UUID, nickname: "Segreto", match_status: "confermato", auto_created_person: false, gw_people: { first_name: "Claudia", last_name: "Verdi", nickname: "Claudia", email: "claudia@profilo.test", merged_into: null, phone: "Non esporre" } },
          { id: "pb", is_primary: false, entered_as: "Francesco", removed_at: null },
          { id: "pc", is_primary: false, entered_as: "Vecchio", removed_at: "2026-09-01T00:00:00Z" },
        ],
        gw_payments: [
          {
            id: "m1",
            kind: "pagamento",
            amount_cents: "20000",
            payment_type: "acconto",
            paid_on: "2026-10-01",
            method: "paypal",
            received_by: "redsabbath",
            description: null,
            corrects_payment_id: null,
            created_at: "2026-10-01T10:00:00Z",
          },
        ],
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        version: 1,
        status: "prenotato",
        notes: null,
        invoice_status: "non_richiesta",
        agreed_fee_cents: 45000,
        fee_custom: false,
        created_at: "2026-10-02T10:00:00Z",
        gw_operators: [{ role: "admin" }],
        gw_booking_participants: [{ id: "pd", is_primary: true, entered_as: "Ginestra", removed_at: null }],
        gw_payments: [],
      },
    ];

    const { getRegistrations } = await import("../server/registrations");
    const registrations = await getRegistrations(UUID);

    const query = selects.find((s) => s.table === "gw_bookings")!;
    // Join con campi minimi: non esporre identificativi o dettagli associativi.
    expect(query.columns.match(/gw_people!gw_booking_participants_person_id_fkey\(([^)]*)\)/)?.[1])
      .toBe("first_name, last_name, nickname, email, merged_into");
    expect(selects.some((s) => s.table === "gw_people" || s.table === "association_members")).toBe(false);

    const keys = [...allKeys(registrations)];
    expect(keys.filter((key) => FORBIDDEN_KEYS.includes(key))).toEqual([]);
    expect(registrations[0].people).toEqual([
      { participantId: "pa", isPrimary: true, enteredAs: "Claudia", enteredEmail: "claudia@scritta-da-ale.test", alreadyAs: null, matchStatus:"confermato",autoCreated:false,
        linkedProfile: {name:"Claudia Verdi",nickname:"Claudia",email:"claudia@profilo.test"} },
      { participantId: "pb", isPrimary: false, enteredAs: "Francesco", enteredEmail: null, alreadyAs: null, matchStatus:"da_abbinare",autoCreated:false,linkedProfile:null },
    ]);
    expect(registrations[1].people).toEqual([{ participantId: "pd", isPrimary: true, enteredAs: "Ginestra", enteredEmail: null, alreadyAs: null, matchStatus:"da_abbinare",autoCreated:false,linkedProfile:null }]);
    expect(JSON.stringify(registrations)).not.toMatch(/intrusa@example\.test|Segreto|Non esporre/);
    expect(registrations[0].agreedFeeCents).toBe(45000);

    // "Inserito da Ale" / "Inserito da Peony": solo il ruolo, mai il nome dell'operatore.
    const { insertedByLabel } = await import("../labels");
    expect(registrations.map((r) => r.createdByRole)).toEqual(["organizzatrice", "admin"]);
    expect(registrations.map((r) => insertedByLabel(r.createdByRole))).toEqual(["Inserito da Ale", "Inserito da Peony"]);
    expect(insertedByLabel(null)).toBe("Inserito da Peony");
    expect(JSON.stringify(registrations)).not.toContain("Nome Operatrice");
    expect(registrations[0].payments[0].amountCents).toBe(20000);
  });

  it("4e (#28): 'Sembra già iscritta come «X»' arriva come solo testo di Ale, senza id di persone", async () => {
    bookingRows = [
      {
        id: UUID,
        version: 1,
        status: "prenotato",
        notes: null,
        invoice_status: "non_richiesta",
        agreed_fee_cents: 45000,
        fee_custom: false,
        created_at: "2026-10-01T10:00:00Z",
        gw_operators: { role: "organizzatrice" },
        gw_booking_participants: [{ id: "pa", is_primary: true, entered_as: "Claudia", entered_email: null, removed_at: null }],
        gw_payments: [],
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        version: 1,
        status: "prenotato",
        notes: null,
        invoice_status: "non_richiesta",
        agreed_fee_cents: 45000,
        fee_custom: false,
        created_at: "2026-10-02T10:00:00Z",
        gw_operators: { role: "organizzatrice" },
        gw_booking_participants: [{ id: "pb", is_primary: true, entered_as: "Claudia A.", entered_email: null, removed_at: null }],
        gw_payments: [],
      },
    ];
    participantRows = [
      { id: "pa", booking_id: UUID, person_id: "persona-1", possible_duplicate_person_id: null, entered_as: "Claudia" },
      { id: "pb", booking_id: "00000000-0000-4000-8000-000000000002", person_id: "persona-2", possible_duplicate_person_id: "persona-1", entered_as: "Claudia A." },
    ];
    const { getRegistrations } = await import("../server/registrations");
    const { alreadyEnrolledHint } = await import("../registrations");
    const registrations = await getRegistrations(UUID);
    expect(registrations.map((r) => r.people[0].alreadyAs)).toEqual([null, "Claudia"]);
    expect(alreadyEnrolledHint(registrations[1])).toBe("Sembra già iscritta come «Claudia»: possibile doppione.");
    expect(JSON.stringify(registrations)).not.toMatch(/persona-1|persona-2|person_id/);
    // La lettura dei partecipanti filtra le righe eliminate (D22).
    expect(selects.find((s) => s.table === "gw_booking_participants")?.columns).not.toMatch(/gw_people|email|nickname|first_name/);
  });

  // Fase 6 (audit, punto 2): gli altri loader che servono le pagine di Ale.
  it("getWorkshopView, getFeeRows e getLastPaymentMethod: niente persone, libro soci né note fiscali", async () => {
    workshopRow = {
      id: UUID,
      event_id: null,
      name: "Level 2+",
      starts_on: "2026-11-14",
      ends_on: null,
      description: null,
      capacity: 12,
      default_fee_cents: "45000",
      peony_pct: "30",
      version: 3,
    };
    bookingRows = [{ status: "acconto", agreed_fee_cents: "45000", fee_custom: false, gw_payments: [{ amount_cents: "20000" }] }];
    paymentRows = [{ kind: "pagamento", method: "paypal", created_by: UUID, created_at: "2026-10-01T10:00:00Z" }];

    const { getWorkshopView } = await import("../server/data");
    const { getFeeRows, getLastPaymentMethod } = await import("../server/registrations");
    const results = [await getWorkshopView(UUID), await getFeeRows(UUID), await getLastPaymentMethod(UUID)];

    expect(selects.find((s) => s.table === "gw_workshops")?.columns).not.toMatch(/personal_tax_notes|verified_snapshot/);
    expect(selects.filter((s) => ["gw_bookings", "gw_payments"].includes(s.table)).map((s) => s.columns).join(" ")).not.toMatch(
      /gw_people|gw_booking_participants|association|person_id|email|description/,
    );
    expect(selects.some((s) => s.table === "gw_people" || s.table === "association_members")).toBe(false);
    // displayName qui è il nome del workshop (dall'evento), non di una persona.
    const keys = [...allKeys(results)].filter((key) => key !== "displayName");
    expect(keys.filter((key) => FORBIDDEN_KEYS.includes(key) || key === "personal_tax_notes")).toEqual([]);
    expect(results[1]).toEqual([{ status: "acconto", agreedFeeCents: 45000, feeCustom: false, paidCents: 20000 }]);
    expect(results[2]).toBe("paypal");
  });
});
