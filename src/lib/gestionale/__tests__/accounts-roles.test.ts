// Fase 4 — tab Conti, lato server (D18, D7). Sessione e database simulati:
// le percentuali le cambiano solo gli admin; le note fiscali le legge e
// scrive solo l'organizzatrice (agli admin non arrivano); i loader e l'export
// non toccano l'anagrafica. Dati inventati.

import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "token-di-prova" }), set: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

const W = "00000000-0000-4000-8000-0000000000a1";
const UUID = "00000000-0000-4000-8000-000000000001";
const SECRET_NOTES = "Partita IVA: acconto imposte 1.234 €";

let role: "admin" | "organizzatrice" = "organizzatrice";
const selects: { table: string; columns: string }[] = [];
const OVERVIEW = [
  {
    workshop_id: W,
    peony_pct: "30.00",
    loss_peony_cents: null,
    settlement_status: "provvisorio",
    payment_count: 1,
    expense_count: 1,
    payments: [{ received_by: "redsabbath", amount_cents: 100000 }],
    expenses: [{ advanced_by: "peony", amount_cents: 120000 }],
    transfers: [],
    carryovers_in: [],
    carryovers_out: [],
    bookings: [{ status: "saldato", agreed_fee_cents: 100000, paid_cents: 100000 }],
  },
];
const rpc = vi.fn(async (name: string) => ({
  data: name === "gw_economic_overview" ? OVERVIEW : name.startsWith("gw_create") ? UUID : 2,
  error: null,
}));

const tables: Record<string, unknown> = {};

function resetTables() {
  tables.gw_workshops = {
    id: W,
    event_id: null,
    name: "Luxuria conti",
    starts_on: "2026-11-14",
    ends_on: null,
    description: null,
    capacity: null,
    default_fee_cents: 45000,
    peony_pct: "30.00",
    version: 3,
    loss_peony_cents: null,
    settlement_status: "provvisorio",
    verified_snapshot: null,
    verified_at: null,
    // Anche se il database la restituisse, nessun loader comune la inoltra.
    personal_tax_notes: SECRET_NOTES,
  };
  tables.gw_bookings = [
    {
      id: UUID,
      version: 1,
      status: "saldato",
      notes: null,
      invoice_status: "non_richiesta",
      agreed_fee_cents: 100000,
      fee_custom: false,
      created_at: "2026-10-01T10:00:00Z",
      gw_operators: { role: "organizzatrice" },
      gw_booking_participants: [
        { id: "pa", is_primary: true, entered_as: "Aster", removed_at: null, email: "aster@example.test" },
        { id: "pb", is_primary: false, entered_as: "Brina", removed_at: null },
      ],
      gw_payments: [
        {
          id: "m1",
          kind: "pagamento",
          amount_cents: "100000",
          payment_type: "saldo",
          paid_on: "2026-10-01",
          method: "paypal",
          received_by: "redsabbath",
          description: null,
          corrects_payment_id: null,
          created_at: "2026-10-01T10:00:00Z",
        },
      ],
    },
  ];
  // Perdita: entrate 1.000 €, spese 1.200 € anticipate da Peony.
  tables.gw_expenses = [
    { id: "e1", version: 1, description: "Sala", amount_cents: 120000, advanced_by: "peony", category: "sala", spent_on: null },
  ];
  tables.gw_transfers = [];
  tables.gw_carryovers = [];
}

function sessionRow() {
  const now = new Date();
  return {
    id: "s1",
    operator_id: "o1",
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 86_400_000).toISOString(),
    revoked_at: null,
    gw_operators: { id: "o1", display_name: "Operatrice Prova", active: true, role },
  };
}

function query(table: string) {
  const result = () => (table === "gw_sessions" ? { data: sessionRow(), error: null } : { data: tables[table] ?? [], error: null });
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "in", "is", "or", "not", "ilike", "order", "range", "limit", "gt", "update", "insert"]) {
    builder[method] = () => builder;
  }
  builder.select = (columns: string) => {
    selects.push({ table, columns });
    return builder;
  };
  builder.maybeSingle = async () => {
    const { data } = result();
    return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
  };
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result());
  return builder;
}

vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query, rpc }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: query }) }));

beforeEach(() => {
  selects.length = 0;
  rpc.mockClear();
  resetTables();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  role = "organizzatrice";
});

const rpcNames = () => (rpc.mock.calls as unknown as [string][]).map(([name]) => name);

describe("percentuali: solo admin (lato server)", () => {
  it("Ale non può cambiare le percentuali: 404, nessuna scrittura", async () => {
    const { setPeonyPctAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    await expect(setPeonyPctAction({ workshopId: W, version: 3, peonyPct: "50" })).rejects.toThrow(NOT_FOUND);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("l'admin sì", async () => {
    role = "admin";
    const { setPeonyPctAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    expect(await setPeonyPctAction({ workshopId: W, version: 3, peonyPct: "40,5" })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("gw_set_peony_pct", { p_operator_id: "o1", p_workshop_id: W, p_version: 3, p_peony_pct: 40.5 });
    expect(await setPeonyPctAction({ workshopId: W, version: 3, peonyPct: "120" })).toEqual({ ok: false, error: "Percentuale tra 0 e 100." });
  });
});

describe("note fiscali personali di Ale (D7, Fase 4)", () => {
  it("gli admin non le ricevono né le scrivono", async () => {
    role = "admin";
    const { getTaxNotes } = await import("../server/accounts");
    const { setTaxNotesAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    await expect(getTaxNotes(W)).rejects.toThrow(NOT_FOUND);
    await expect(setTaxNotesAction({ workshopId: W, version: 3, notes: "x" })).rejects.toThrow(NOT_FOUND);
    expect(selects.some((s) => s.columns.includes("personal_tax_notes"))).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("l'organizzatrice sì", async () => {
    const { getTaxNotes } = await import("../server/accounts");
    const { setTaxNotesAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    expect(await getTaxNotes(W)).toBe(SECRET_NOTES);
    expect(await setTaxNotesAction({ workshopId: W, version: 3, notes: " nuove " })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("gw_set_tax_notes", { p_operator_id: "o1", p_workshop_id: W, p_version: 3, p_notes: "nuove" });
  });

  for (const r of ["admin", "organizzatrice"] as const) {
    it(`getAccounts (${r}): nessuna nota fiscale né anagrafica nelle chiavi e nei valori restituiti`, async () => {
      role = r;
      const { getAccounts } = await import("../server/accounts");
      const { getWorkshopView } = await import("../server/data");
      const data = await getAccounts((await getWorkshopView(W))!);

      expect(selects.filter((s) => s.table !== "gw_sessions").map((s) => s.columns).join(" ")).not.toMatch(
        /personal_tax_notes|gw_people|(?<!entered_)email|first_name|last_name|nickname|phone|instagram/,
      );
      expect(selects.some((s) => s.table === "gw_people" || s.table === "association_members")).toBe(false);

      const keys = new Set<string>();
      const walk = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") {
          for (const [key, inner] of Object.entries(value)) {
            keys.add(key);
            walk(inner);
          }
        }
      };
      walk(data);
      expect([...keys].filter((k) => /tax|personal|email|person|first_name|last_name|nickname|membership/i.test(k))).toEqual([]);
      expect(JSON.stringify(data)).not.toContain(SECRET_NOTES);
      expect(JSON.stringify(data)).not.toContain("aster@example.test");
      expect(data!.income).toMatchObject([{ bookingId: UUID, title: "Aster + Brina", cancelled: false, paidCents: 100000 }]);
      expect(data!.income[0].payments.map((p) => p.id)).toEqual(["m1"]);
    });
  }
});

describe("azioni comuni ai due ruoli, controllate sul server", () => {
  for (const r of ["admin", "organizzatrice"] as const) {
    it(`${r}: spese, trasferimenti, stato`, async () => {
      role = r;
      const actions = await import("@/app/gestione/(app)/w/accounts-actions");
      const fields = { amount: "120,50", category: "viaggi", description: "Volo", advancedBy: "peony", spentOn: "" };
      expect(await actions.addExpenseAction({ workshopId: W, fields })).toEqual({ ok: true });
      expect(await actions.addExpenseAction({ workshopId: W, fields: { ...fields, category: "tasse" } })).toMatchObject({ ok: false });
      expect(await actions.addExpenseAction({ workshopId: W, fields: { ...fields, amount: "0" } })).toMatchObject({ ok: false });
      expect(
        await actions.addTransferAction({ workshopId: W, fields: { fromParty: "redsabbath", amount: "100", status: "eseguito", executedOn: "2026-11-20", notes: "" } }),
      ).toEqual({ ok: true });
      expect(await actions.setSettlementStatusAction({ workshopId: W, version: 3, status: "verificato" })).toEqual({ ok: true });
      expect(rpcNames()).toEqual(["gw_create_expense", "gw_create_transfer", "gw_set_settlement_status"]);

      const [, transferArgs] = rpc.mock.calls[1] as unknown as [string, { p_data: Record<string, unknown> }];
      expect(transferArgs.p_data).toMatchObject({ from_party: "redsabbath", to_party: "peony", amount_cents: 10000 });
      // Verificato: lo snapshot lo calcola il server (perdita da ripartire → niente residuo).
      const [, statusArgs] = rpc.mock.calls[2] as unknown as [string, { p_snapshot: Record<string, unknown> }];
      expect(statusArgs.p_snapshot).toMatchObject({ ricavi: 100000, spese: 120000, utile: -20000, residuo: null });
    });
  }

  it("perdita sostenuta da Peony: rifiutata oltre la perdita, accettata entro", async () => {
    const { setLossPeonyAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    expect(await setLossPeonyAction({ workshopId: W, version: 3, loss: "250" })).toEqual({ ok: false, error: "Indica un importo tra 0 e 200 €." });
    expect(rpc).not.toHaveBeenCalled();
    expect(await setLossPeonyAction({ workshopId: W, version: 3, loss: "100" })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("gw_set_loss_peony", { p_operator_id: "o1", p_workshop_id: W, p_version: 3, p_loss_peony_cents: 10000 });
  });

  it("D24: 'Registra trasferimento di X €': residuo ricalcolato sul server, eseguito oggi, rifiutato se è cambiato", async () => {
    const { settleResidualAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    // Perdita non ancora ripartita: residuo non calcolabile.
    expect(await settleResidualAction({ workshopId: W, expectedCents: 110000 })).toMatchObject({ ok: false });
    (tables.gw_workshops as Record<string, unknown>).loss_peony_cents = 10000;
    expect(await settleResidualAction({ workshopId: W, expectedCents: 5000 })).toEqual({ ok: false, error: "L'importo da trasferire è cambiato: ricarica la pagina." });
    expect(rpc).not.toHaveBeenCalled();
    expect(await settleResidualAction({ workshopId: W, expectedCents: 110000 })).toEqual({ ok: true });
    const [name, args] = rpc.mock.calls[0] as unknown as [string, { p_data: Record<string, unknown> }];
    expect(name).toBe("gw_create_transfer");
    expect(args.p_data).toMatchObject({ from_party: "redsabbath", to_party: "peony", amount_cents: 110000, status: "eseguito", notes: "conguaglio" });
    expect(args.p_data.executed_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("D24: gli stati da premere sono solo Provvisorio e Verificato", async () => {
    const { setSettlementStatusAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    for (const status of ["da_conguagliare", "conguagliato"]) {
      expect(await setSettlementStatusAction({ workshopId: W, version: 3, status })).toMatchObject({ ok: false });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("D25: chi ha verificato e chi ha inserito le spese arrivano solo come ruolo", async () => {
    Object.assign(tables.gw_workshops as Record<string, unknown>, {
      settlement_status: "conguagliato",
      verified_at: "2026-11-20T10:00:00Z",
      gw_operators: { role: "organizzatrice", display_name: "Nome Operatrice" },
    });
    (tables.gw_expenses as Record<string, unknown>[])[0].gw_operators = { role: "admin", display_name: "Nome Admin" };
    const { getAccounts } = await import("../server/accounts");
    const { getWorkshopView } = await import("../server/data");
    const data = (await getAccounts((await getWorkshopView(W))!))!;
    // Stato vecchio (prima della 024): vale verificato.
    expect(data.workshop).toMatchObject({ status: "verificato", verifiedByRole: "organizzatrice" });
    expect(data.expenses[0].createdByRole).toBe("admin");
    expect(JSON.stringify(data)).not.toMatch(/Nome Operatrice|Nome Admin/);
  });

  it("riporto del residuo: importo e direzione ricalcolati sul server", async () => {
    const { carryResidualAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    // Perdita non ancora ripartita: niente residuo da riportare.
    expect(await carryResidualAction({ workshopId: W, destinationId: UUID, notes: "" })).toMatchObject({ ok: false });
    (tables.gw_workshops as Record<string, unknown>).loss_peony_cents = 10000;
    expect(await carryResidualAction({ workshopId: W, destinationId: UUID, notes: "" })).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("gw_create_carryover", {
      p_operator_id: "o1",
      p_data: { origin_workshop_id: W, destination_workshop_id: UUID, debtor: "redsabbath", creditor: "peony", amount_cents: 110000, notes: null },
    });
  });
});

describe("export Excel: numeri in euro, nessun dato anagrafico né note fiscali", () => {
  it("fogli Riepilogo, Incassi, Spese, Trasferimenti e riporti (4e, #26)", async () => {
    (tables.gw_workshops as Record<string, unknown>).loss_peony_cents = 10000;
    const { getAccounts } = await import("../server/accounts");
    const { getWorkshopView } = await import("../server/data");
    const { buildAccountsWorkbook } = await import("../server/excel");
    const data = (await getAccounts((await getWorkshopView(W))!))!;
    const buffer = await buildAccountsWorkbook(data, { generatedAt: "20 novembre 2026", operatorName: "Operatrice Prova" });

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(book.worksheets.map((s) => s.name)).toEqual(["Riepilogo", "Incassi", "Spese", "Trasferimenti e riporti"]);

    const values: unknown[] = [];
    const euroCells: number[] = [];
    book.eachSheet((sheet) =>
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          values.push(cell.value);
          if (typeof cell.value === "number" && cell.numFmt?.includes("€")) euroCells.push(cell.value);
        }),
      ),
    );
    const text = JSON.stringify(values);
    expect(text).toContain("Aster + Brina");
    expect(text).toContain("Ale deve dare 1.100 € a Peony");
    expect(text).not.toContain(SECRET_NOTES);
    expect(text).not.toMatch(/aster@example\.test|RedSabbath|socio|tesser/i);
    // Importi come numeri (in euro) con formato valuta, non testo.
    expect(euroCells).toEqual(expect.arrayContaining([1000, 1200, -200, 1100]));
    expect(values.some((v) => typeof v === "string" && /^\d[\d.]*,\d{2} €$/.test(v))).toBe(false);
  });
});

describe("eliminazioni (D22): ruoli controllati sul server", () => {
  it("Ale: persone e workshop rispondono 404, nessuna scrittura; pagamenti, iscrizioni e spese sì", async () => {
    const actions = await import("@/app/gestione/(app)/delete-actions");
    await expect(actions.deletePersonAction({ personId: UUID, version: 1 })).rejects.toThrow(NOT_FOUND);
    await expect(actions.deleteWorkshopAction({ workshopId: W, version: 3, confirmName: "Luxuria conti" })).rejects.toThrow(NOT_FOUND);
    await expect(actions.restoreDeletedAction({ entity: "person", id: UUID })).rejects.toThrow(NOT_FOUND);
    await expect(actions.restoreDeletedAction({ entity: "workshop", id: W })).rejects.toThrow(NOT_FOUND);
    expect(rpc).not.toHaveBeenCalled();

    expect(await actions.deletePaymentAction({ paymentId: UUID })).toEqual({ ok: true });
    expect(await actions.deleteBookingAction({ bookingId: UUID, version: 1 })).toEqual({ ok: true });
    expect(await actions.restoreDeletedAction({ entity: "payment", id: UUID })).toEqual({ ok: true });
    const { deleteExpenseAction } = await import("@/app/gestione/(app)/w/accounts-actions");
    expect(await deleteExpenseAction({ id: UUID, version: 1 })).toEqual({ ok: true });
    expect(rpcNames()).toEqual(["gw_delete_payment", "gw_delete_booking", "gw_restore_deleted", "gw_delete_expense"]);
  });

  it("admin: persona e workshop manuale; il nome scritto arriva al database", async () => {
    role = "admin";
    const actions = await import("@/app/gestione/(app)/delete-actions");
    expect(await actions.deletePersonAction({ personId: UUID, version: 1 })).toEqual({ ok: true });
    expect(await actions.deleteWorkshopAction({ workshopId: W, version: 3, confirmName: "luxuria conti" })).toEqual({ ok: true });
    expect(rpc.mock.calls.at(-1)).toEqual(["gw_delete_workshop", { p_operator_id: "o1", p_workshop_id: W, p_version: 3, p_confirm_name: "luxuria conti" }]);
    expect(await actions.restoreDeletedAction({ entity: "workshop", id: W })).toEqual({ ok: true });
    expect(await actions.restoreDeletedAction({ entity: "operator", id: W })).toMatchObject({ ok: false });
  });

  it("workshop collegato a Ticket Tailor: rifiutato prima del database", async () => {
    role = "admin";
    (tables.gw_workshops as { event_id: string | null }).event_id = "11111111-1111-4111-8111-111111111111";
    const { deleteWorkshopAction } = await import("@/app/gestione/(app)/delete-actions");
    expect(await deleteWorkshopAction({ workshopId: W, version: 3, confirmName: "Luxuria conti" })).toEqual({
      ok: false,
      error: "Il workshop arriva da Ticket Tailor: non si può eliminare.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("home (D23): recap senza dati anagrafici", () => {
  for (const r of ["admin", "organizzatrice"] as const) {
    it(`${r}: stessi numeri, nessuna chiave di persone`, async () => {
      role = r;
      tables.gw_workshops = [tables.gw_workshops];
      const { getDashboard } = await import("../server/data");
      const entries = await getDashboard();

      expect(rpcNames()).toEqual(["gw_economic_overview"]);
      expect(selects.some((s) => s.table === "gw_people" || s.table === "association_members")).toBe(false);
      const keys = new Set<string>();
      const walk = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") {
          for (const [key, inner] of Object.entries(value)) {
            keys.add(key);
            walk(inner);
          }
        }
      };
      walk(entries);
      expect([...keys].filter((k) => /tax|personal|email|person|first_name|last_name|nickname|membership|entered/i.test(k))).toEqual([]);
      expect(entries).toHaveLength(1);
      expect(entries[0].recap).toMatchObject({ entrate: 100000, uscite: 120000, rimane: -20000, daIncassare: 0, movimenti: true });
      expect(entries[0].counts.iscrizioni).toBe(1);
    });
  }
});
