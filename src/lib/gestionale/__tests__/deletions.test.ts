// Eliminazioni (Fase 4b, D22): testi delle conferme e regole pure. Dati inventati.

import { describe, expect, it } from "vitest";

import { DELETE_HINTS, bookingDeleteBlock, paymentDeleteQuestion, workshopNameMatches } from "../deletions";

describe("conferma del pagamento", () => {
  it("con i dettagli del movimento e il nome", () => {
    expect(paymentDeleteQuestion({ kind: "pagamento", method: "paypal", paidOn: "2026-10-28" }, 25000, "Aster")).toBe(
      "Eliminare il pagamento di 250 € · PayPal · 28 ott di Aster?",
    );
    expect(paymentDeleteQuestion({ kind: "rimborso", method: null, paidOn: "2026-11-02" }, -5050, "Brina + Corvo")).toBe(
      "Eliminare il rimborso di 50,50 € · 2 nov di Brina + Corvo?",
    );
  });

  it("ogni conferma ricorda gli strumenti per gli eventi reali", () => {
    expect(DELETE_HINTS.payment).toContain("Ho restituito dei soldi");
    expect(DELETE_HINTS.booking).toContain("Cancellato");
  });
});

describe("iscrizione", () => {
  it("si elimina solo con pagato netto 0", () => {
    expect(bookingDeleteBlock([])).toBeNull();
    expect(bookingDeleteBlock([{ amountCents: 10000 }, { amountCents: -10000 }])).toBeNull();
    expect(bookingDeleteBlock([{ amountCents: 25000 }])).toBe("Ha 250 € di pagamenti: eliminali o registra un rimborso prima.");
  });
});

describe("workshop", () => {
  it("conferma scrivendo il nome (spazi e maiuscole a parte)", () => {
    expect(workshopNameMatches("  prova MANUALE ", "Prova manuale")).toBe(true);
    expect(workshopNameMatches("Prova", "Prova manuale")).toBe(false);
    expect(workshopNameMatches("", "")).toBe(false);
  });
});
