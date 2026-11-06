// Fase 4g, gruppo 5 (box di testo e anteprima): tipo dedotto anche
// nell'anteprima, card chiuse quando è tutto giusto, conflitto testo/pagamenti
// come frase semplice, "Torna al testo" con conferma, #14 e #22 (ipotesi 3 non
// approvata: Acconto pagato e Saldato restano sceglibili a mano). Dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONFIRM_STATUS_HINT, STATUS_NOT_CHANGED } from "@/components/gestionale/RegistrationsTab";

import { cardSummaryLine, missingFields, previewPayment, previewPaymentTypes, statusConflictText } from "../import-preview";
import { BOOKING_STATUS_LABELS } from "../labels";
import { parseRoster } from "../parse-roster";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("#28 — tipo dedotto nell'anteprima", () => {
  it("senza 'saldo'/'acconto' nel testo: dedotto dal prezzo, nessun 'Tipo?' da completare", () => {
    const [row] = parseRoster("1. Corvo (250€ paypal) +250€ cash", { standardFeeCents: 50000 });
    const payments = row.payments.map(previewPayment);
    expect(payments.map((p) => p.typeAuto)).toEqual([true, true]);
    expect(payments.map((p) => missingFields(p))).toEqual([[], []]);
    expect(previewPaymentTypes(payments, 50000)).toEqual(["acconto", "saldo"]);
  });

  it("prezzo speciale dal testo (Fiamma 580€/ 180€ +400€): acconto poi saldo", () => {
    const [row] = parseRoster("6. Fiamma (IG) 580€/ 180€ fattura ok +400€ cash", { standardFeeCents: 50000 });
    expect(previewPaymentTypes(row.payments.map(previewPayment), row.feeCents)).toEqual(["acconto", "saldo"]);
  });

  it("anche senza prezzo: acconto", () => {
    const [row] = parseRoster("1. Dalia 250€ paypal +250€ cash", { standardFeeCents: null });
    expect(previewPaymentTypes(row.payments.map(previewPayment), null)).toEqual(["acconto", "acconto"]);
  });

  it("scritto nel testo o scelto in 'altro…': vale quello", () => {
    const [row] = parseRoster("1. Elio saldo 200€ paypal", { standardFeeCents: 50000 });
    const payments = row.payments.map(previewPayment);
    expect(row.payments[0].typeExplicit).toBe(true);
    expect(previewPaymentTypes(payments, 50000)).toEqual(["saldo"]);
    expect(previewPaymentTypes([{ ...payments[0], paymentType: "altro", typeAuto: false }], 50000)).toEqual(["altro"]);
  });

  it("righe già presenti: conta quanto era già pagato; i pagamenti tolti non contano", () => {
    const [row] = parseRoster("1. Gaia 250€ paypal", { standardFeeCents: 50000 });
    const payments = row.payments.map(previewPayment);
    expect(previewPaymentTypes(payments, 50000, 25000)).toEqual(["saldo"]);
    const two = parseRoster("1. Gaia 300€ paypal +200€", { standardFeeCents: 50000 })[0].payments.map(previewPayment);
    expect(previewPaymentTypes([{ ...two[0], removed: true }, two[1]], 50000)).toEqual(["acconto", "acconto"]);
  });

  it("il mini-modulo: Tipo in 'altro…', 'Incassato da Ale · cambia'", () => {
    const box = source("src/components/gestionale/TextImport.tsx");
    const mini = box.slice(box.indexOf("function PaymentMiniForm"), box.indexOf("function PreviewCard"));
    expect(mini).toContain('{more ? "meno" : "altro…"}');
    expect(mini).toContain("cambia");
    expect(mini.indexOf('label="Tipo"')).toBeGreaterThan(mini.indexOf("{more ? ("));
    expect(mini).toContain("typeAuto: false");
    expect(box).toContain("payment_type: types[index]");
  });
});

describe("#27 — conflitto testo / pagamenti come frase semplice", () => {
  it("'Nel testo: Prenotato. Ha già pagato 300 €: segno Acconto pagato? · Sì · No, lascia Prenotato'", () => {
    expect(statusConflictText("prenotato", "acconto", 30000)).toEqual({
      question: "Nel testo: Prenotato. Ha già pagato 300 €: segno Acconto pagato?",
      keepLabel: "No, lascia Prenotato",
    });
    expect(statusConflictText("interessato", "saldato", 50000).question).toBe("Nel testo: Interessato. Ha già pagato 500 €: segno Saldato?");
    const box = source("src/components/gestionale/TextImport.tsx");
    expect(box).toContain('{ value: "pagamenti", label: "Sì" }');
    expect(box).not.toContain("i pagamenti indicano");
  });
});

describe("#26 e ipotesi 7 — card e box", () => {
  it("card chiusa su una riga quando è tutto giusto", () => {
    expect(cardSummaryLine(["Dalia"], "acconto", [{ amountText: "225", method: "paypal", removed: false }])).toBe("Dalia · Acconto pagato · 225 € PayPal ✓");
    expect(
      cardSummaryLine(["Aster", "Brina"], "saldato", [
        { amountText: "250", method: "paypal", removed: false },
        { amountText: "250", method: "contanti", removed: false },
        { amountText: "10", method: null, removed: true },
      ]),
    ).toBe("Aster + Brina · Saldato · 250 € PayPal + 250 € Contanti ✓");
    expect(cardSummaryLine(["Elio"], "prenotato", [])).toBe(`Elio · ${BOOKING_STATUS_LABELS.prenotato} ✓`);
  });

  it("aperte solo quelle da completare o da chiarire, 'Correggi' per aprire le altre", () => {
    const box = source("src/components/gestionale/TextImport.tsx");
    expect(box).toContain("const open = row.expanded ?? attention;");
    expect(box).toContain("Correggi");
    expect(box).toMatch(/const attention =\s*missing > 0 \|\|/);
  });

  it("aperto da solo se l'elenco è vuoto; riga di aiuto con l'esempio; 'Leggi il testo'", () => {
    const box = source("src/components/gestionale/TextImport.tsx");
    expect(box).toContain("openChoice ?? (registrations.length === 0 || showDraftPrompt)");
    expect(box).toContain("«Claudia 250 paypal»");
    expect(box).toContain("Leggi il testo");
  });

  it("#24: 'Torna al testo' dopo delle correzioni chiede conferma", () => {
    const box = source("src/components/gestionale/TextImport.tsx");
    expect(box).toContain("previewEdited ? setAskBack(true) : backToText()");
    expect(box).toContain("Le correzioni dell'anteprima si perdono.");
    expect(box).toContain('{ value: "stay", label: "Resta" }');
  });
});

describe("#14 e #22 — Acconto pagato e Saldato restano sceglibili a mano", () => {
  it("i 6 stati restano nel menu", () => {
    expect(Object.keys(BOOKING_STATUS_LABELS)).toEqual(["interessato", "prenotato", "acconto", "saldato", "lista_attesa", "cancellato"]);
    expect(source("src/components/gestionale/StatusPicker.tsx")).toContain("options = ALL_STATUSES");
  });

  it("#14: il modulo spiega e, chiuso senza registrare, lo dice", () => {
    expect(CONFIRM_STATUS_HINT).toBe("Registra il pagamento per confermare lo stato.");
    expect(STATUS_NOT_CHANGED).toBe("Stato non cambiato: nessun pagamento registrato.");
    const tab = source("src/components/gestionale/RegistrationsTab.tsx");
    expect(tab).toContain("hint={form.kind === \"pagamento\" && form.targetStatus ? CONFIRM_STATUS_HINT : undefined}");
    expect(tab).toContain("setMessage({ tone: \"warning\", text: STATUS_NOT_CHANGED });");
  });

  it("#22: in Aggiungi il primo pagamento è 'Quanto ha già pagato?' (importo e metodo, il resto in 'altro…')", () => {
    const add = source("src/components/gestionale/AddRegistration.tsx");
    expect(add).toContain("Quanto ha già pagato?");
    expect(add).toContain("dateInMore");
    expect(add).toMatch(/next === "acconto" \|\| next === "saldato"/);
  });
});
