// Elenco leggibile dei pagamenti: solo i movimenti validi (un movimento
// modificato e la sua rettifica non compaiono, resta il valore attuale
// "modificato"); conteggio e totale solo sui validi. Dati inventati.

import { describe, expect, it } from "vitest";

import { correctionCount, currentPayments, paidCents, paymentCount } from "../payments";
import type { Payment } from "../types";

function payment(id: string, amountCents: number, extra: Partial<Payment> = {}): Payment {
  return {
    id,
    kind: "pagamento",
    amountCents,
    paymentType: "acconto",
    paidOn: "2026-10-01",
    method: "paypal",
    receivedBy: "redsabbath",
    description: null,
    correctsPaymentId: null,
    createdAt: "2026-10-01T10:00:00Z",
    ...extra,
  };
}

const fix = (id: string, corrects: string, amountCents: number, createdAt: string) =>
  payment(id, amountCents, { kind: "rettifica", correctsPaymentId: corrects, createdAt });

describe("movimenti validi", () => {
  it("Modifica: originale e rettifica spariscono, resta il nuovo valore 'modificato'", () => {
    const list = [
      payment("a", 20000),
      fix("r1", "a", -20000, "2026-10-02T09:00:00Z"),
      payment("b", 25000, { createdAt: "2026-10-02T09:00:00Z" }),
      payment("c", 10000, { createdAt: "2026-10-03T09:00:00Z", paymentType: "saldo" }),
    ];
    expect(currentPayments(list).map((p) => [p.payment.id, p.amountCents, p.modified])).toEqual([
      ["b", 25000, true],
      ["c", 10000, false],
    ]);
    expect(paymentCount(list)).toBe(2);
    expect(correctionCount(list)).toBe(1);
    expect(currentPayments(list).reduce((sum, p) => sum + p.amountCents, 0)).toBe(paidCents(list));
  });

  it("modifica della modifica: resta solo l'ultimo valore", () => {
    const list = [
      payment("a", 20000),
      fix("r1", "a", -20000, "2026-10-02T09:00:00Z"),
      payment("b", 25000, { createdAt: "2026-10-02T09:00:00Z" }),
      fix("r2", "b", -25000, "2026-10-03T09:00:00Z"),
      payment("c", 30000, { createdAt: "2026-10-03T09:00:00Z" }),
    ];
    expect(currentPayments(list).map((p) => [p.payment.id, p.modified])).toEqual([["c", true]]);
    expect(correctionCount(list)).toBe(2);
    expect(paidCents(list)).toBe(30000);
  });

  it("annullato soltanto: non compare; rettifica parziale: valore netto 'modificato'; rettifica libera visibile", () => {
    const voided = [payment("a", 20000), fix("r1", "a", -20000, "2026-10-02T09:00:00Z")];
    expect(currentPayments(voided)).toEqual([]);
    expect(paymentCount(voided)).toBe(0);
    expect(correctionCount(voided)).toBe(1);

    const partial = [payment("a", 20000), fix("r1", "a", -5000, "2026-10-02T09:00:00Z")];
    expect(currentPayments(partial).map((p) => [p.payment.id, p.amountCents, p.modified])).toEqual([["a", 15000, true]]);

    const free = [payment("a", 20000), payment("r", -1000, { kind: "rettifica", createdAt: "2026-10-02T09:00:00Z" })];
    expect(currentPayments(free).map((p) => p.payment.id)).toEqual(["a", "r"]);
    expect(correctionCount(free)).toBe(0);
  });

  it("rimborso: resta un movimento valido negativo", () => {
    const list = [payment("a", 20000), payment("x", -5000, { kind: "rimborso", paymentType: "altro" })];
    expect(currentPayments(list).map((p) => [p.payment.id, p.amountCents, p.modified])).toEqual([
      ["a", 20000, false],
      ["x", -5000, false],
    ]);
  });
});
