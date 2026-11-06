// D19, D21: stato automatico, badge, totali, quota standard. Dati inventati.

import { describe, expect, it } from "vitest";

import {
  autoStatus,
  feeSummary,
  paymentCount,
  paymentTotals,
  statusJustified,
  unsettledWarning,
  voidedPaymentIds,
} from "../payments";
import type { BookingStatus, Payment } from "../types";

function payment(id: string, amountCents: number, extra: Partial<Payment> = {}): Payment {
  return {
    id,
    kind: amountCents > 0 ? "pagamento" : "rimborso",
    amountCents,
    paymentType: "acconto",
    paidOn: "2026-10-01",
    method: "contanti",
    receivedBy: "redsabbath",
    description: null,
    correctsPaymentId: null,
    createdAt: "2026-10-01T10:00:00Z",
    ...extra,
  };
}

function booking(status: BookingStatus, agreedFeeCents: number | null, amounts: number[]) {
  return { status, agreedFeeCents, payments: amounts.map((amount, i) => payment(`p${i}`, amount)) };
}

describe("stato automatico (come gw_apply_auto_status)", () => {
  it("prenotato → acconto → saldato; rimborso riporta ad acconto; tutto rimborsato → prenotato", () => {
    expect(autoStatus("prenotato", 45000, 20000)).toBe("acconto");
    expect(autoStatus("acconto", 45000, 45000)).toBe("saldato");
    expect(autoStatus("saldato", 45000, 50000)).toBe("saldato");
    expect(autoStatus("saldato", 45000, 40000)).toBe("acconto");
    expect(autoStatus("acconto", 45000, 0)).toBe("prenotato");
    expect(autoStatus("interessato", 45000, 0)).toBe("interessato");
    expect(autoStatus("interessato", 45000, 100)).toBe("acconto");
  });

  it("lista d'attesa e cancellato non cambiano mai", () => {
    expect(autoStatus("lista_attesa", 45000, 45000)).toBe("lista_attesa");
    expect(autoStatus("cancellato", 45000, 45000)).toBe("cancellato");
  });

  it("senza quota: solo acconto", () => {
    expect(autoStatus("prenotato", null, 100)).toBe("acconto");
    expect(autoStatus("saldato", null, 100)).toBe("saldato");
  });
});

describe("badge e totali", () => {
  it("ancora da pagare: coppie, tariffe dedicate, cancellate, eccedenze", () => {
    const totals = paymentTotals([
      booking("acconto", 45000, [30000]), // coppia: una quota, residuo 150
      booking("acconto", 30000, [10000]), // tariffa dedicata, residuo 200
      booking("saldato", 45000, [50000]), // eccesso 50, residuo 0
      booking("cancellato", 45000, [20000, -5000]), // fuori dal concordato, ma i soldi contano nel ricevuto
      booking("prenotato", null, []), // senza quota: non contata
      booking("saldato", 45000, [45000]),
    ]);
    expect(totals).toEqual({
      concordato: 45000 + 30000 + 45000 + 45000,
      ricevuto: 30000 + 10000 + 50000 + 15000 + 45000,
      daPagare: 15000 + 20000,
      eccedenze: 5000,
      pagatoCancellate: 15000,
      senzaQuota: 1,
    });
  });
});

describe("riga del tab Iscrizioni (D19)", () => {
  it("riga chiusa: pagato su quota, manca; oppure quota e nessun pagamento", () => {
    expect(feeSummary(30000, 58000)).toBe("Pagato 300 € su 580 € · manca 280 €");
    expect(feeSummary(0, 58000)).toBe("Prezzo 580 € · nessun pagamento");
    expect(feeSummary(58000, 58000)).toBe("Pagato 580 € su 580 €");
    expect(feeSummary(60000, 58000)).toBe("Pagato 600 € su 580 € · pagato in più 20 €");
    expect(feeSummary(0, null)).toBe("Prezzo mancante · nessun pagamento");
  });

  it("Acconto pagato / Saldato si salvano solo se il pagato li giustifica", () => {
    expect(statusJustified("acconto", 0, 58000)).toBe(false);
    expect(statusJustified("acconto", 100, 58000)).toBe(true);
    expect(statusJustified("saldato", 57999, 58000)).toBe(false);
    expect(statusJustified("saldato", 58000, 58000)).toBe(true);
    expect(statusJustified("saldato", 99999, null)).toBe(false);
  });

  it("intestazione Pagamenti: movimenti validi; avviso iscrizioni non più saldate", () => {
    const payments = [
      { id: "a", kind: "pagamento", amountCents: 20000 },
      { id: "b", kind: "pagamento", amountCents: 10000 },
      { id: "c", kind: "rettifica", amountCents: -10000, correctsPaymentId: "b" },
    ] as unknown as Parameters<typeof paymentCount>[0];
    expect(paymentCount(payments)).toBe(1);
    expect(unsettledWarning(0)).toBeNull();
    expect(unsettledWarning(1)).toBe("1 iscrizione non risulta più pagata del tutto.");
    expect(unsettledWarning(3)).toBe("3 iscrizioni non risultano più pagate del tutto.");
  });
});

describe("correzioni", () => {
  it("il movimento annullato da una rettifica collegata si mostra barrato", () => {
    const list = [
      payment("a", 25000),
      payment("r", -25000, { kind: "rettifica", correctsPaymentId: "a" }),
      payment("b", 30000),
      payment("c", 10000),
      payment("r2", -5000, { kind: "rettifica", correctsPaymentId: "c" }),
    ];
    expect([...voidedPaymentIds(list)]).toEqual(["a"]);
  });
});
