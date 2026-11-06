// Fase 4e, gruppo 1 e 2 (Ale): nuovo pagamento, rimborso del pagato, "Sembra
// già iscritta", riga aperta. Dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { existingFromRegistration, findExisting } from "../parse-roster";
import { newPaymentPreset, refundPlan } from "../payments";
import { alreadyEnrolledHint, alreadyEnrolledText } from "../registrations";
import type { Payment } from "../types";

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
    createdAt: `2026-10-01T10:00:0${id.length}Z`,
    ...extra,
  };
}

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("#1 — + Nuovo pagamento", () => {
  it("senza pagamenti validi: Acconto, importo vuoto", () => {
    expect(newPaymentPreset([], 45000)).toEqual({ paymentType: "acconto" });
    // Un pagamento annullato con una rettifica non conta.
    const voided = [payment("a", 20000), payment("ab", -20000, { kind: "rettifica", correctsPaymentId: "a" })];
    expect(newPaymentPreset(voided, 45000)).toEqual({ paymentType: "acconto" });
  });

  it("con un acconto: Saldo e importo = residuo; nulla se già coperto o senza quota", () => {
    expect(newPaymentPreset([payment("a", 20000)], 45000)).toEqual({ paymentType: "saldo", amountCents: 25000 });
    expect(newPaymentPreset([payment("a", 45000)], 45000)).toEqual({ paymentType: "saldo" });
    expect(newPaymentPreset([payment("a", 20000)], null)).toEqual({ paymentType: "saldo" });
  });
});

describe("#2 — Registra rimborso di X €", () => {
  it("pagato netto, un rimborso per parte che ha incassato", () => {
    expect(refundPlan([payment("a", 20000), payment("b", 5000, { receivedBy: "peony" })])).toEqual({
      totalCents: 25000,
      parts: [
        { party: "peony", cents: 5000 },
        { party: "redsabbath", cents: 20000 },
      ],
      askParty: false,
    });
    expect(refundPlan([payment("a", 20000), payment("b", 5000)])).toMatchObject({ totalCents: 25000, parts: [{ party: "redsabbath", cents: 25000 }] });
  });

  it("una parte in negativo: non si può ripartire, si chiede chi restituisce", () => {
    expect(refundPlan([payment("a", 20000), payment("b", -5000, { receivedBy: "peony" })])).toMatchObject({ totalCents: 15000, askParty: true });
  });
});

describe("#3 + #4 — riga aperta di Ale", () => {
  const tab = source("src/components/gestionale/RegistrationsTab.tsx");

  it("l'elenco dei pagamenti è quello dei soli movimenti validi (modificato, Mostra correzioni)", () => {
    expect(tab).toContain("<CurrentPaymentList");
    expect(tab).not.toContain("<PaymentList");
  });

  it("ordine: Quota · Stato · Pagamenti · Altri dati (fattura ed email affiancate, 4f; note)", () => {
    const details = tab.slice(tab.indexOf("function RegistrationDetails"), tab.indexOf("export function RegistrationsTab"));
    const order = ["<FeeEditor", "<StatusPicker", "Pagamenti ·", "Altri dati", "Fattura <Saved", "<EnteredEmails", "Note <Saved"].map((marker) => details.indexOf(marker));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("'+ Nuovo pagamento' usa la preimpostazione e l'avviso della cancellata ha il pulsante del rimborso", () => {
    expect(tab).toContain("newPaymentPreset(registration.payments, fee)");
    // 4g (#16): "Ho restituito X € a questa persona".
    expect(tab).toContain("Ho restituito {total} a questa persona");
  });
});

describe("#28 + #5 — Sembra già iscritta come «X»", () => {
  it("riga di Ale: solo il testo che lei aveva scritto", () => {
    const people = [{ participantId: "p", isPrimary: true, enteredAs: "Claudia A.", enteredEmail: null, alreadyAs: "Claudia" }];
    expect(alreadyEnrolledHint({ people })).toBe("Sembra già iscritta come «Claudia»: possibile doppione.");
    expect(alreadyEnrolledHint({ people: [{ ...people[0], alreadyAs: null }] })).toBeNull();
    expect(alreadyEnrolledText("Claudia")).toBe("Sembra già iscritta come «Claudia»");
  });

  it("anteprima: 'Aggiorna quella iscrizione' = stessa logica di 'già presente' (solo pagamenti nuovi, doppioni segnati)", () => {
    const registration = {
      bookingId: "b-1",
      version: 4,
      people: [{ participantId: "x", isPrimary: true, enteredAs: "Claudia", enteredEmail: null, alreadyAs: null }],
      payments: [payment("a", 25000, { method: "paypal", paidOn: "2026-10-20" })],
    };
    const row = {
      people: ["Claudia A."],
      payments: [
        { amountCents: 25000, method: "paypal" as const, methodAnswered: false, paymentType: "acconto" as const, typeUncertain: false },
        { amountCents: 10000, method: null, methodAnswered: false, paymentType: "altro" as const, typeUncertain: true },
      ],
    };
    // Il testo è diverso: findExisting non la riconosce, l'abbinamento del server sì.
    expect(findExisting(row, [registration], "2026-10-20")).toBeNull();
    expect(existingFromRegistration(row, registration, "2026-10-20")).toEqual({ bookingId: "b-1", version: 4, duplicatePayments: [0] });
  });

  it("l'anteprima chiede al server solo id e testo di Ale (nessun dato anagrafico)", () => {
    const actions = source("src/app/gestione/(app)/w/registration-actions.ts");
    const block = actions.slice(actions.indexOf("export async function previewMatchesAction"));
    expect(block.slice(0, block.indexOf("\n}\n"))).toMatch(/bookingId: match\.booking_id, enteredAs: match\.entered_as/);
    expect(block.slice(0, block.indexOf("\n}\n"))).toContain("requireOrganizer()");
    const sql = source("supabase/migrations/024_gw_correzioni_revisione.sql");
    const fn = sql.slice(sql.indexOf("create function public.gw_preview_entered_matches"), sql.indexOf("create or replace function public.gw_import_roster"));
    expect(fn).toContain("jsonb_build_object('booking_id', bp.booking_id, 'entered_as', bp.entered_as)");
    expect(fn).not.toMatch(/insert into|gw_create_person|update gw_/);
  });
});
