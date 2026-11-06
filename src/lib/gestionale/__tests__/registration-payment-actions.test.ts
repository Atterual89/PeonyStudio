// Azioni del tab Iscrizioni (organizzatrice): "Aggiungi" con Acconto pagato /
// Saldato richiede il primo pagamento (stessa transazione); "Modifica" senza
// cambiamenti non salva niente; il box di testo rifiuta righe economiche senza
// pagamenti. Database simulato, dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/gestionale/server/auth", () => ({ requireOrganizer: async () => ({ id: "op", role: "organizzatrice" }) }));
vi.mock("@/lib/gestionale/server/data", () => ({ getWorkshopView: async () => null }));

const W = "00000000-0000-4000-8000-0000000000a1";
const PAY = "00000000-0000-4000-8000-0000000000b1";

let paymentRows: unknown[] = [];
const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>>(async () => ({ data: "id", error: null }));

function query() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "is", "order", "maybeSingle"]) builder[method] = () => builder;
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: paymentRows, error: null });
  return builder;
}
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query, rpc }) }));

const draft = { amount: "200", paymentType: "acconto", method: "paypal", paidOn: "2026-10-01", receivedBy: "redsabbath", description: "" };

beforeEach(() => {
  rpc.mockClear();
  paymentRows = [];
});

describe("Aggiungi con il primo pagamento", () => {
  it("Acconto pagato / Saldato senza pagamento: rifiutato, nessuna scrittura", async () => {
    const { addRegistrationAction } = await import("@/app/gestione/(app)/w/registration-actions");
    for (const status of ["acconto", "saldato"]) {
      expect(await addRegistrationAction({ workshopId: W, person: "Aster", partner: "", status, fee: null, notes: "" })).toEqual({
        ok: false,
        error: "Acconto pagato o Saldato: registra il primo pagamento.",
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("con il pagamento: una sola chiamata (iscrizione + pagamento nella stessa transazione)", async () => {
    const { addRegistrationAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await addRegistrationAction({ workshopId: W, person: "Aster", partner: "Brina", status: "acconto", fee: null, notes: "", payment: draft })).toEqual({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("gw_create_registration", {
      p_operator_id: "op",
      p_workshop_id: W,
      p_entries: ["Aster", "Brina"],
      p_status: "acconto",
      p_fee_cents: null,
      p_notes: null,
      p_payment: { amount_cents: 20000, payment_type: "acconto", method: "paypal", paid_on: "2026-10-01", received_by: "redsabbath", description: null },
    });
  });

  it("Prenotato a parola: nessun pagamento", async () => {
    const { addRegistrationAction } = await import("@/app/gestione/(app)/w/registration-actions");
    await addRegistrationAction({ workshopId: W, person: "Aster", partner: "", status: "prenotato", fee: null, notes: "" });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_status: "prenotato", p_payment: null });
  });
});

describe("Modifica di un movimento", () => {
  const original = { id: PAY, kind: "pagamento", amount_cents: 20000, payment_type: "acconto", method: "paypal", paid_on: "2026-10-01", received_by: "redsabbath", description: null, corrects_payment_id: null };

  it("niente di cambiato: non si salva niente", async () => {
    paymentRows = [original];
    const { correctPaymentAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await correctPaymentAction({ paymentId: PAY, replacement: draft, description: "" })).toEqual({ ok: true, data: { changed: false } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("importo cambiato: rettifica + nuovo movimento (gw_correct_payment)", async () => {
    paymentRows = [original];
    const { correctPaymentAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await correctPaymentAction({ paymentId: PAY, replacement: { ...draft, amount: "250" }, description: "" })).toEqual({
      ok: true,
      data: { changed: true },
    });
    expect(rpc).toHaveBeenCalledWith("gw_correct_payment", expect.objectContaining({ p_payment_id: PAY, p_description: "Modifica" }));
  });

  it("annulla soltanto", async () => {
    const { correctPaymentAction } = await import("@/app/gestione/(app)/w/registration-actions");
    await correctPaymentAction({ paymentId: PAY, replacement: null, description: "" });
    expect(rpc).toHaveBeenCalledWith("gw_correct_payment", expect.objectContaining({ p_replacement: null, p_description: "Stornato" }));
  });
});

describe("box di testo", () => {
  const row = { booking_id: null, people: ["Aster"], status: "saldato", fee_cents: null, invoice_status: "non_richiesta", notes: null };

  it("riga nuova Saldato senza pagamenti: rifiutata; con data e note proprie: inviate", async () => {
    const { importRosterAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await importRosterAction({ workshopId: W, paidOn: "2026-10-01", receivedBy: "redsabbath", rows: [{ ...row, payments: [] }] })).toMatchObject({
      ok: false,
    });
    expect(rpc).not.toHaveBeenCalled();

    await importRosterAction({
      workshopId: W,
      paidOn: "2026-10-01",
      receivedBy: "redsabbath",
      rows: [{ ...row, payments: [{ amount_cents: 45000, method: "contanti", payment_type: "saldo", paid_on: "2026-09-28", description: "in sala" }] }],
    });
    const args = rpc.mock.calls[0][1] as { p_rows: { payments: unknown[] }[] };
    expect(args.p_rows[0].payments).toEqual([
      { amount_cents: 45000, method: "contanti", payment_type: "saldo", paid_on: "2026-09-28", description: "in sala" },
    ]);
  });

  it("moduli compatti: stato tenuto contro i pagamenti solo per righe nuove e solo Interessato / Prenotato a parola", async () => {
    const { importRosterAction } = await import("@/app/gestione/(app)/w/registration-actions");
    const paid = { ...row, status: "prenotato", payments: [{ amount_cents: 45000, method: "contanti", payment_type: "saldo" }] };
    await importRosterAction({ workshopId: W, paidOn: "2026-10-01", receivedBy: "redsabbath", rows: [{ ...paid, forced_status: "prenotato" }] });
    expect((rpc.mock.calls[0][1] as { p_rows: { forced_status: unknown }[] }).p_rows[0].forced_status).toBe("prenotato");

    rpc.mockClear();
    for (const bad of [{ ...paid, forced_status: "saldato" }, { ...paid, booking_id: PAY, booking_version: 2, forced_status: "prenotato" }]) {
      expect(await importRosterAction({ workshopId: W, paidOn: "2026-10-01", receivedBy: "redsabbath", rows: [bad] })).toMatchObject({ ok: false });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
