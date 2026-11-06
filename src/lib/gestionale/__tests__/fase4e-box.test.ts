// Box di testo: anteprima a moduli per persona (campi da completare, pagamenti
// già registrati, cancellate senza pagamenti, "Salva l'email") e lato server
// (data e Incassato da per pagamento, rimborso del pagato, anteprima degli
// abbinamenti). Database simulato, dati inventati.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseRoster } from "../parse-roster";
import {
  cancelledWithoutPayments,
  cardMissingCount,
  emailToSave,
  formPaymentIndexes,
  missingFields,
  previewPayment,
  previewSummary,
  registeredMatches,
  saveLabel,
} from "../import-preview";

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/lib/gestionale/server/auth", () => ({ requireOrganizer: async () => ({ id: "op", role: "organizzatrice" }) }));
vi.mock("@/lib/gestionale/server/data", () => ({ getWorkshopView: async () => null }));

const W = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";

let rpcData: unknown = { created: 1, updated: 0, payments: 0 };
const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>>(async () => ({ data: rpcData, error: null }));
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ rpc }) }));

beforeEach(() => {
  rpc.mockClear();
  rpcData = { created: 1, updated: 0, payments: 0 };
});

const parsedPayment = (extra: Record<string, unknown> = {}) => ({
  amountCents: 25000,
  method: null,
  methodAnswered: false,
  paymentType: "acconto" as const,
  typeUncertain: false,
  ...extra,
});

describe("anteprima a moduli (puro)", () => {
  it("ogni pagamento è un mini-modulo: vuoto ciò che il parser non ha trovato, Incassato da Ale", () => {
    const [row] = parseRoster("1. Aster 250€ paypal +100€", { standardFeeCents: 40000 });
    const payments = row.payments.map(previewPayment);
    expect(payments).toEqual([
      // 4g (#28): senza "saldo"/"acconto" nel testo il tipo si deduce (typeAuto), niente "Tipo?".
      { amountText: "250", paymentType: null, typeAuto: true, method: "paypal", paidOn: "", receivedBy: "redsabbath", removed: false, parsed: row.payments[0] },
      { amountText: "100", paymentType: null, typeAuto: true, method: null, paidOn: "", receivedBy: "redsabbath", removed: false, parsed: row.payments[1] },
    ]);
    expect(missingFields(payments[0])).toEqual([]);
    expect(missingFields(payments[1])).toEqual(["method"]);
    expect(missingFields({ ...payments[1], amountText: "abc", method: "contanti" })).toEqual(["amount"]);
    // 026: la data è facoltativa, mai "da completare".
    expect(missingFields({ ...payments[1], amountText: "100", method: "contanti" })).toEqual([]);
  });

  it("due pagamenti con lo stesso importo: ognuno con i suoi campi mancanti", () => {
    const [row] = parseRoster("1. Brina 200€ +200€ bonifico", { standardFeeCents: 40000 });
    const payments = row.payments.map(previewPayment);
    expect(payments.map((p) => p.amountText)).toEqual(["200", "200"]);
    expect(missingFields(payments[0])).toEqual(["method"]);
    expect(missingFields(payments[1])).toEqual([]);
    expect(cardMissingCount(row.people, payments, [0, 1])).toBe(1);

    // Completare il primo non tocca il secondo.
    const first = { ...payments[0], method: "contanti" as const, paidOn: "2026-10-20" };
    expect(missingFields(first)).toEqual([]);
    expect(missingFields(payments[1])).toEqual([]);
    expect(cardMissingCount(row.people, [first, payments[1]], [0, 1])).toBe(0);
    // Un pagamento tolto non conta; un nome vuoto sì.
    expect(cardMissingCount(["", "Partner"], [first, { ...payments[1], removed: true }], [0])).toBe(1);
  });

  it("riassunto in cima e pulsante in fondo", () => {
    expect(previewSummary(3, 4, 2)).toBe("Ho trovato 3 iscrizioni e 4 pagamenti · 2 campi da completare");
    expect(previewSummary(1, 1, 1)).toBe("Ho trovato 1 iscrizione e 1 pagamento · 1 campo da completare");
    expect(previewSummary(2, 0, 0)).toBe("Ho trovato 2 iscrizioni e 0 pagamenti · nessun campo da completare");
    expect(saveLabel(0)).toBe("Salva");
    expect(saveLabel(3)).toBe("Completa 3 campi");
    expect(saveLabel(1)).toBe("Completa 1 campo");
  });

  it("righe già presenti: solo i pagamenti nuovi come mini-moduli, abbinati uno a uno", () => {
    const registered = [
      { kind: "pagamento" as const, amountCents: 20000, method: "paypal" as const },
      { kind: "rimborso" as const, amountCents: 20000, method: null },
    ];
    // Due pagamenti da 200 € nel testo, uno solo registrato: il secondo è nuovo.
    const payments = [previewPayment(parsedPayment({ amountCents: 20000 })), previewPayment(parsedPayment({ amountCents: 20000 }))];
    const matches = registeredMatches(payments, registered);
    expect([...matches]).toEqual([[0, 0]]);
    expect(formPaymentIndexes(payments, matches, {})).toEqual([1]);
    // "Aggiungilo comunque" lo rimette tra i mini-moduli.
    expect(formPaymentIndexes(payments, matches, { 0: true })).toEqual([0, 1]);
    // Metodo diverso: non è lo stesso pagamento.
    expect(registeredMatches([previewPayment(parsedPayment({ amountCents: 20000, method: "contanti" }))], registered).size).toBe(0);
    // Pagamenti tolti o aggiunti nell'anteprima non si abbinano.
    expect(registeredMatches([{ ...payments[0], removed: true }, { ...payments[1], parsed: null }], registered).size).toBe(0);
  });

  it("cancellate senza pagamenti", () => {
    const payment = previewPayment(parsedPayment());
    expect(cancelledWithoutPayments("cancellato", [])).toBe(true);
    expect(cancelledWithoutPayments("cancellato", [{ ...payment, removed: true }])).toBe(true);
    expect(cancelledWithoutPayments("cancellato", [payment])).toBe(false);
    expect(cancelledWithoutPayments("interessato", [])).toBe(false);
  });

  it("#9: 'Salva l'email' solo se Ale non ne aveva scritta una", () => {
    const registration = (enteredEmail: string | null) => ({
      people: [{ participantId: "p", isPrimary: true, enteredAs: "Aster", enteredEmail, alreadyAs: null }],
    });
    expect(emailToSave(" Aster@Example.com ", registration(null))).toBe("aster@example.com");
    expect(emailToSave("aster@example.com", registration("altra@example.com"))).toBeNull();
    expect(emailToSave(null, registration(null))).toBeNull();
  });
});

describe("importRosterAction", () => {
  const row = (payments: unknown[], extra: Record<string, unknown> = {}) => ({
    booking_id: null,
    people: ["Solo Interesse"],
    status: "interessato",
    fee_cents: null,
    invoice_status: "non_richiesta",
    notes: null,
    payments,
    ...extra,
  });

  it("#6: senza pagamenti si salva senza data", async () => {
    const { importRosterAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect((await importRosterAction({ workshopId: W, paidOn: "", receivedBy: "redsabbath", rows: [row([])] })).ok).toBe(true);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_paid_on: null });
  });

  it("026: un pagamento senza data si salva senza data", async () => {
    const { importRosterAction } = await import("@/app/gestione/(app)/w/registration-actions");
    const result = await importRosterAction({
      workshopId: W,
      paidOn: "",
      receivedBy: "redsabbath",
      rows: [row([{ amount_cents: 1000, payment_type: "acconto", method: null }], { status: "acconto" })],
    });
    expect(result.ok).toBe(true);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_paid_on: null, p_rows: [{ payments: [{ paid_on: null }] }] });
  });

  it("ogni pagamento con la sua data e il suo Incassato da", async () => {
    const { importRosterAction } = await import("@/app/gestione/(app)/w/registration-actions");
    const payments = [
      { amount_cents: 20000, payment_type: "acconto", method: "paypal", paid_on: "2026-10-20", received_by: "peony" },
      { amount_cents: 20000, payment_type: "saldo", method: "contanti", paid_on: "2026-10-28", received_by: "redsabbath" },
    ];
    expect((await importRosterAction({ workshopId: W, paidOn: "", receivedBy: "redsabbath", rows: [row(payments, { status: "saldato" })] })).ok).toBe(true);
    const sent = (rpc.mock.calls[0][1].p_rows as { payments: unknown[] }[])[0].payments;
    expect(sent).toEqual(payments.map((payment) => ({ ...payment, description: null })));
    expect(
      (await importRosterAction({ workshopId: W, paidOn: "", receivedBy: "redsabbath", rows: [row([{ ...payments[0], received_by: "altri" }], { status: "acconto" })] })).ok,
    ).toBe(false);
  });

  it("#9: riga già presente con l'email da salvare", async () => {
    const { importRosterAction } = await import("@/app/gestione/(app)/w/registration-actions");
    await importRosterAction({
      workshopId: W,
      paidOn: "",
      receivedBy: "redsabbath",
      rows: [row([], { booking_id: B, booking_version: 2, people: [], status: "prenotato", entered_email: "Aster@Example.com" })],
    });
    expect((rpc.mock.calls[0][1].p_rows as { entered_email: string }[])[0].entered_email).toBe("aster@example.com");
  });
});

describe("#2 e #5 lato server", () => {
  it("refundBookingAction: importo e parte arrivano al database, che li ricontrolla", async () => {
    rpcData = 2;
    const { refundBookingAction } = await import("@/app/gestione/(app)/w/registration-actions");
    expect(await refundBookingAction({ bookingId: B, expectedCents: 25000, method: "contanti", paidOn: "2026-10-29", receivedBy: null })).toEqual({
      ok: true,
      data: { count: 2 },
    });
    expect(rpc).toHaveBeenCalledWith("gw_refund_booking", {
      p_operator_id: "op",
      p_booking_id: B,
      p_expected_cents: 25000,
      p_method: "contanti",
      p_paid_on: "2026-10-29",
      p_received_by: null,
    });
    expect((await refundBookingAction({ bookingId: B, expectedCents: 0, method: null, paidOn: "2026-10-29", receivedBy: null })).ok).toBe(false);
  });

  it("previewMatchesAction: al browser solo id dell'iscrizione e testo di Ale", async () => {
    rpcData = [{ booking_id: B, entered_as: "Claudia", email: "non-dovrebbe@arrivare.test" }, null];
    const { previewMatchesAction } = await import("@/app/gestione/(app)/w/registration-actions");
    const result = await previewMatchesAction({ workshopId: W, entries: [{ text: "Claudia A.", email: "claudia@example.com" }, "Nuova"] });
    expect(result).toEqual({ ok: true, data: [{ bookingId: B, enteredAs: "Claudia" }, null] });
    expect(rpc).toHaveBeenCalledWith("gw_preview_entered_matches", {
      p_workshop_id: W,
      p_entries: [{ text: "Claudia A.", email: "claudia@example.com" }, "Nuova"],
    });
  });
});
