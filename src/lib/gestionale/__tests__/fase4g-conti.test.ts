// Fase 4g, gruppo 4 (conti e home per Ale): frasi coerenti col residuo,
// conferma prima di cambiare il prezzo, "chi deve pagare", Conti di Ale senza
// verifica né perdita, home col workshop in corso in cima. Dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { feeChangeImpact, feeChangeQuestion, owesMoney, paymentTotals, type FeeRow } from "../payments";
import { debtPhrase, settleLabels } from "../recap";
import { computeSettlement, type SettlementInput } from "../settlement";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function input(extra: Partial<SettlementInput> = {}): SettlementInput {
  return { peonyPct: 30, lossPeonyCents: null, payments: [], expenses: [], transfers: [], carryoversIn: [], carryoversOut: [], ...extra };
}

describe("ipotesi 6 — 'Devi dare / Peony ti deve / Siete pari' coerenti con il residuo", () => {
  it("Ale ha incassato tutto: deve a Peony la sua parte", () => {
    const s = computeSettlement(input({ payments: [{ receivedBy: "redsabbath", amountCents: 300000 }], expenses: [{ advancedBy: "peony", amountCents: 20000 }, { advancedBy: "redsabbath", amountCents: 30000 }] }));
    expect(s.residuo).toBe(95000);
    expect(debtPhrase(s.residuo, "organizzatrice")).toBe("Devi dare 950 € a Peony");
    expect(settleLabels(s.residuo, "organizzatrice")?.button).toBe("Ho dato 950 € a Peony");
  });

  it("Peony ha incassato tutto: Peony deve ad Ale", () => {
    const s = computeSettlement(input({ payments: [{ receivedBy: "peony", amountCents: 100000 }] }));
    expect(s.residuo).toBe(-70000);
    expect(debtPhrase(s.residuo, "organizzatrice")).toBe("Peony ti deve 700 €");
  });

  it("dopo il trasferimento eseguito: Siete pari, nessun pulsante", () => {
    const s = computeSettlement(
      input({
        payments: [{ receivedBy: "redsabbath", amountCents: 100000 }],
        transfers: [{ fromParty: "redsabbath", toParty: "peony", status: "eseguito", amountCents: 30000 }],
      }),
    );
    expect(s.residuo).toBe(0);
    expect(debtPhrase(s.residuo, "organizzatrice")).toBe("Siete pari");
    expect(settleLabels(s.residuo, "organizzatrice")).toBeNull();
  });

  it("in perdita senza ripartizione: nessuna frase (la decide Laura)", () => {
    const s = computeSettlement(input({ payments: [{ receivedBy: "redsabbath", amountCents: 100000 }], expenses: [{ advancedBy: "peony", amountCents: 120000 }] }));
    expect(debtPhrase(s.residuo, "organizzatrice")).toBeNull();
  });
});

describe("#40 — conferma prima di cambiare il prezzo del workshop", () => {
  const rows: FeeRow[] = [
    { status: "saldato", agreedFeeCents: 45000, feeCustom: false, paidCents: 45000 },
    { status: "saldato", agreedFeeCents: 45000, feeCustom: false, paidCents: 50000 },
    { status: "acconto", agreedFeeCents: 45000, feeCustom: false, paidCents: 20000 },
    { status: "prenotato", agreedFeeCents: 45000, feeCustom: false, paidCents: 0 },
    { status: "saldato", agreedFeeCents: 30000, feeCustom: true, paidCents: 30000 },
    { status: "cancellato", agreedFeeCents: 45000, feeCustom: false, paidCents: 10000 },
  ];

  it("conta le iscrizioni toccate (non speciali, non cancellate) e quelle che non risulteranno più pagate", () => {
    expect(feeChangeImpact(rows, 50000)).toEqual({ touched: 4, unsettled: 1 });
    expect(feeChangeImpact(rows, 45000)).toEqual({ touched: 0, unsettled: 0 });
    expect(feeChangeImpact(rows, 40000)).toEqual({ touched: 4, unsettled: 0 });
  });

  it("la domanda con i numeri; nessuna domanda se non cambia niente", () => {
    expect(feeChangeQuestion({ touched: 18, unsettled: 3 })).toBe(
      "Cambia il prezzo di 18 iscrizioni (non quelle con prezzo speciale). 3 non risulteranno più pagate. Confermi?",
    );
    expect(feeChangeQuestion({ touched: 1, unsettled: 1 })).toBe(
      "Cambia il prezzo di 1 iscrizione (non quelle con prezzo speciale). 1 non risulterà più pagata. Confermi?",
    );
    expect(feeChangeQuestion({ touched: 2, unsettled: 0 })).toBe("Cambia il prezzo di 2 iscrizioni (non quelle con prezzo speciale). Confermi?");
    expect(feeChangeQuestion({ touched: 0, unsettled: 0 })).toBeNull();
  });

  it("chiesta nel tab Iscrizioni e nel tab Info (Ale e admin)", () => {
    expect(source("src/components/gestionale/RegistrationsTab.tsx")).toContain("confirm.check(fee)");
    const info = source("src/components/gestionale/WorkshopSettingsForm.tsx");
    expect(info).toContain("confirm.check(values.default_fee)");
    expect(info).toContain("confirm.check(fee)");
    expect(source("src/app/gestione/(app)/w/[id]/page.tsx")).toContain("getFeeRows(workshop.id)");
  });
});

describe("'Da incassare ancora X €' → chi deve pagare", () => {
  it("stessa regola del totale da incassare", () => {
    const bookings = [
      { status: "acconto" as const, agreedFeeCents: 45000, payments: [{ amountCents: 20000 }] },
      { status: "saldato" as const, agreedFeeCents: 45000, payments: [{ amountCents: 45000 }] },
      { status: "lista_attesa" as const, agreedFeeCents: 45000, payments: [] },
      { status: "cancellato" as const, agreedFeeCents: 45000, payments: [] },
      { status: "prenotato" as const, agreedFeeCents: null, payments: [] },
      { status: "prenotato" as const, agreedFeeCents: 45000, payments: [] },
    ];
    expect(bookings.filter(owesMoney)).toHaveLength(2);
    expect(paymentTotals(bookings).daPagare).toBe(25000 + 45000);
  });

  it("il link apre Iscrizioni col filtro", () => {
    expect(source("src/components/gestionale/AccountsTab.tsx")).toContain("?tab=iscrizioni&filtro=da-pagare");
    expect(source("src/components/gestionale/RegistrationsTab.tsx")).toContain('useState(initialFilter === "da-pagare")');
  });
});

describe("Conti di Ale (ipotesi 6, #31–#38)", () => {
  const tab = source("src/components/gestionale/AccountsTab.tsx");
  const ale = tab.slice(tab.indexOf("function OrganizerAccounts"), tab.indexOf("export function AccountsTab"));

  it("in cima la frase, 'Ho dato', Guadagno, Spese con '+ Spesa', da incassare; il resto in 'Dettagli'", () => {
    expect(ale).toContain('debtPhrase(settlement.residuo, "organizzatrice")');
    expect(ale).toContain('<SettleResidual data={data} viewer="organizzatrice" />');
    expect(ale).toContain(">Guadagno<");
    expect(ale).toContain('<AddExpense workshopId={workshop.id} today={today} defaultPaidBy="redsabbath" />');
    expect(ale.indexOf("<AddExpense")).toBeLessThan(ale.indexOf('<Section title="Dettagli">'));
    expect(ale.indexOf("<ExportLinks")).toBeGreaterThan(ale.indexOf('<Section title="Dettagli">'));
    expect(ale).toContain("vedi in Iscrizioni");
    expect(ale).not.toContain("<IncomeBlock");
  });

  it("Ale non vede il banner della verifica né i controlli della perdita", () => {
    expect(ale).not.toContain("<Summary");
    expect(ale).not.toContain("Conti modificati dopo la verifica");
    expect(tab).toContain("if (!isAdmin) return <OrganizerAccounts");
    const split = tab.slice(tab.indexOf("function SplitBlock"), tab.indexOf("function PositionsBlock"));
    expect(split.indexOf("showLoss && !isAdmin")).toBeLessThan(split.indexOf("<LossBox"));
    expect(tab).toContain('export const LOSS_FOR_ALE = "Il workshop è in perdita: Laura deciderà come dividerla."');
  });
});

describe("home e riga di Ale (#5, #6)", () => {
  it("per Ale niente sottotitolo; frase e workshop in corso prima dei riquadri", () => {
    const home = source("src/app/gestione/(app)/page.tsx");
    const ale = home.slice(home.indexOf('if (viewer === "organizzatrice")'), home.lastIndexOf("Eventi LuXuria da Ticket Tailor"));
    expect(ale).not.toContain("Eventi LuXuria da Ticket Tailor");
    expect(ale.indexOf("{conguagli")).toBeLessThan(ale.indexOf("{current}"));
    expect(ale.indexOf("{current}")).toBeLessThan(ale.indexOf("<RecapTiles"));
  });

  it("'Inserito da' solo quando non l'ha inserita lei", () => {
    expect(source("src/components/gestionale/RegistrationsTab.tsx")).toContain('registration.createdByRole === "organizzatrice" ? null');
  });
});
