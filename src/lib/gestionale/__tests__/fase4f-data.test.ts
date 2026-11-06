// Fase 4f, parte 1: data del pagamento facoltativa (migrazione 026). Logica
// pura e azioni con database simulato. Dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { paymentDeleteQuestion } from "@/lib/gestionale/deletions";
import { formatPaymentDate } from "@/lib/gestionale/format";
import { comparePayments } from "@/lib/gestionale/payments";

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/gestionale/server/auth", () => ({ requireOrganizer: async () => ({ id: "op", role: "organizzatrice" }) }));
vi.mock("@/lib/gestionale/server/data", () => ({ getWorkshopView: async () => null }));

const B = "00000000-0000-4000-8000-0000000000c1";
const PAY = "00000000-0000-4000-8000-0000000000c2";

let paymentRows: unknown[] = [];
const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>>(async () => ({ data: "id", error: null }));

function query() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "is", "order", "maybeSingle"]) builder[method] = () => builder;
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: paymentRows, error: null });
  return builder;
}
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query, rpc }) }));

const draft = { amount: "200", paymentType: "acconto", method: "paypal", paidOn: "", receivedBy: "redsabbath", description: "" };

beforeEach(() => {
  rpc.mockClear();
  paymentRows = [];
});

describe("data facoltativa (puro)", () => {
  it("nell'elenco: «data non indicata»", () => {
    expect(formatPaymentDate(null)).toBe("data non indicata");
    expect(formatPaymentDate("2026-10-28")).toBe("28 ott 2026");
  });

  it("ordine: per data; senza data per data di inserimento (fuso di Roma)", () => {
    const payments = [
      { id: "a", paidOn: "2026-10-20", createdAt: "2026-10-25T10:00:00Z" },
      { id: "b", paidOn: null, createdAt: "2026-10-18T09:00:00Z" },
      // Inserito alle 00:30 del 22 a Roma (22:30 UTC del 21).
      { id: "c", paidOn: null, createdAt: "2026-10-21T22:30:00Z" },
      { id: "d", paidOn: "2026-10-22", createdAt: "2026-10-22T08:00:00Z" },
    ];
    expect([...payments].sort(comparePayments).map((p) => p.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("conferma di eliminazione senza data", () => {
    expect(paymentDeleteQuestion({ kind: "pagamento", method: "paypal", paidOn: null }, 25000, "Aster")).toBe(
      "Eliminare il pagamento di 250 € · PayPal di Aster?",
    );
  });
});

describe("azioni senza data", () => {
  it("nuovo pagamento senza data: paid_on nullo", async () => {
    const { addPaymentAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await addPaymentAction({ bookingId: B, kind: "pagamento", payment: draft })).toEqual({ ok: true });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_data: { paid_on: null, amount_cents: 20000 } });
  });

  it("data non valida: rifiutata", async () => {
    const { addPaymentAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect((await addPaymentAction({ bookingId: B, kind: "pagamento", payment: { ...draft, paidOn: "28/10" } })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("Modifica: togliere la data è una modifica (paid_on presente e nullo)", async () => {
    paymentRows = [
      { id: PAY, kind: "pagamento", amount_cents: 20000, payment_type: "acconto", method: "paypal", paid_on: "2026-10-01", received_by: "redsabbath", description: null, corrects_payment_id: null },
    ];
    const { correctPaymentAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await correctPaymentAction({ paymentId: PAY, replacement: draft, description: "" })).toEqual({ ok: true, data: { changed: true } });
    const replacement = rpc.mock.calls[0][1].p_replacement as Record<string, unknown>;
    expect("paid_on" in replacement && replacement.paid_on === null).toBe(true);
  });

  it("Modifica di un pagamento senza data, lasciata senza data: nessuna modifica", async () => {
    paymentRows = [
      { id: PAY, kind: "pagamento", amount_cents: 20000, payment_type: "acconto", method: "paypal", paid_on: null, received_by: "redsabbath", description: null, corrects_payment_id: null },
    ];
    const { correctPaymentAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await correctPaymentAction({ paymentId: PAY, replacement: draft, description: "" })).toEqual({ ok: true, data: { changed: false } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rimborso del pagato senza data", async () => {
    const { refundBookingAction } = await import("@/app/gestione/(app)/w/registration-actions");
    rpc.mockResolvedValueOnce({ data: 1 as unknown as string, error: null });
    expect(await refundBookingAction({ bookingId: B, expectedCents: 20000, method: null, paidOn: "", receivedBy: null })).toEqual({ ok: true, data: { count: 1 } });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_paid_on: null });
  });
});
