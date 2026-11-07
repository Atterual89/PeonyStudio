// Fase 4e, gruppo 4 (conti e home): D24 Saldato dal residuo, "Registra
// trasferimento", stati vecchi letti come verificato, "Da ricontrollare",
// spese, eliminazione con i pagamenti. Dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { bookingWithPaymentsLabel } from "../deletions";
import { partyOfRole, verifiedByLabel } from "../labels";
import { economicText, workshopRecap, type OverviewRow } from "../recap";
import {
  computeSettlement,
  isSettled,
  needsRecheck,
  residualTransfer,
  settlementSnapshot,
  settlementStatusOf,
  type SettlementInput,
} from "../settlement";

const EUR = (euros: number) => euros * 100;
const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const base: SettlementInput = {
  peonyPct: 30,
  lossPeonyCents: null,
  payments: [{ receivedBy: "redsabbath", amountCents: EUR(3000) }],
  expenses: [
    { advancedBy: "peony", amountCents: EUR(200) },
    { advancedBy: "redsabbath", amountCents: EUR(300) },
  ],
  transfers: [],
  carryoversIn: [],
  carryoversOut: [],
};

function row(input: SettlementInput, extra: Partial<OverviewRow> = {}): OverviewRow {
  return {
    workshopId: "w",
    status: "provvisorio",
    input,
    paymentCount: input.payments.length,
    expenseCount: input.expenses.length,
    bookings: [],
    verifiedSnapshot: null,
    ...extra,
  };
}

describe("D24 — Saldato automatico", () => {
  it("residuo 0 → Saldato; uno sconto dopo → torna Aperto · da trasferire X da solo", () => {
    const transfer = residualTransfer(computeSettlement(base).residuo)!;
    expect(transfer).toEqual({ fromParty: "redsabbath", toParty: "peony", amountCents: EUR(950) });
    const settled = { ...base, transfers: [{ ...transfer, status: "eseguito" as const }] };
    expect(isSettled(computeSettlement(settled))).toBe(true);
    expect(workshopRecap(row(settled))).toMatchObject({ economic: "saldato", residuo: 0 });
    expect(economicText("saldato", 0)).toBe("Pari");

    // Sconto dell'ultimo momento: rimborso di 100 € a un partecipante (da Ale).
    const discounted = { ...settled, payments: [...settled.payments, { receivedBy: "redsabbath" as const, amountCents: -EUR(100) }] };
    const recap = workshopRecap(row(discounted));
    expect(recap.economic).toBe("aperto");
    expect(recap.residuo).toBe(-EUR(30));
    expect(economicText("aperto", recap.residuo)).toBe("Peony deve dare 30 € ad Ale");
    expect(economicText("aperto", recap.residuo, "organizzatrice")).toBe("Peony ti deve 30 €");
    expect(residualTransfer(recap.residuo)).toEqual({ fromParty: "peony", toParty: "redsabbath", amountCents: EUR(30) });
  });

  it("senza movimenti nessun badge (la card dice già 'Nessun movimento'); residuo non calcolabile: Aperto", () => {
    expect(workshopRecap(row({ ...base, payments: [], expenses: [] })).economic).toBeNull();
    expect(residualTransfer(null)).toBeNull();
    expect(residualTransfer(0)).toBeNull();
    expect(economicText("aperto", null)).toBe("Da dividere");
  });

  it("stati letti dal database: i vecchi da_conguagliare / conguagliato valgono verificato", () => {
    expect(["provvisorio", "verificato", "da_conguagliare", "conguagliato", null].map(settlementStatusOf)).toEqual([
      "provvisorio",
      "verificato",
      "verificato",
      "verificato",
      "provvisorio",
    ]);
  });

  it("il tab Conti non ha più i pulsanti degli stati vecchi; c'è 'Registra trasferimento'", () => {
    const tab = source("src/components/gestionale/AccountsTab.tsx");
    expect(tab).not.toMatch(/da_conguagliare|conguagliato|Conguaglio eseguito|Conguaglio da eseguire/);
    // 4g (#33): scritto come un fatto ("Ho dato X € a Peony").
    expect(tab).toContain("settleLabels(current,viewer)");
    expect(tab).toContain("Registra importo effettivo o in sospeso");
  });
});

describe("#18 — Da ricontrollare in home", () => {
  it("verificato e poi modificato → badge; provvisorio o invariato → niente", () => {
    const settlement = computeSettlement(base);
    const snapshot = settlementSnapshot(settlement, null);
    expect(needsRecheck("verificato", snapshot, settlement, null)).toBe(false);
    const later = computeSettlement({ ...base, expenses: [...base.expenses, { advancedBy: "peony", amountCents: EUR(50) }] });
    expect(needsRecheck("verificato", snapshot, later, null)).toBe(true);
    expect(needsRecheck("provvisorio", snapshot, later, null)).toBe(false);
    expect(workshopRecap(row(base, { status: "verificato", verifiedSnapshot: { ...snapshot, spese: 1 } })).daRicontrollare).toBe(true);
    expect(workshopRecap(row(base, { status: "verificato", verifiedSnapshot: snapshot })).daRicontrollare).toBe(false);
    // 4g (#4): solo agli admin.
    expect(source("src/app/gestione/(app)/page.tsx")).toContain("recheck={isAdmin && entry.recap?.daRicontrollare}");
    expect(source("src/components/gestionale/HomeControls.tsx")).toContain("recheck={isAdmin && entry.recap?.daRicontrollare}");
  });
});

describe("D25, #20, #21, #22, #23", () => {
  it("chi ha inserito / verificato: solo Peony o Ale", () => {
    expect(partyOfRole("organizzatrice")).toBe("Ale");
    expect(partyOfRole("admin")).toBe("Peony");
    expect(partyOfRole(null)).toBe("Peony");
    expect(verifiedByLabel("organizzatrice")).toBe("da Ale");
  });

  it("#20: data predefinita oggi e riga chiusa data · categoria · anticipata da · inserita da", () => {
    const block = source("src/components/gestionale/ExpensesBlock.tsx");
    expect(block).toContain('useState(expense ? (expense.spentOn ?? "") : today)');
    expect(block).toMatch(/formatDate\(expense\.spentOn\)[\s\S]*EXPENSE_CATEGORY_LABELS\[expense\.category\][\s\S]*pagata da[\s\S]*inserita da/);
  });

  it("#21: un solo pulsante per iscrizione e pagamenti", () => {
    expect(bookingWithPaymentsLabel([{ amountCents: EUR(120) }, { amountCents: EUR(30) }])).toBe("Elimina anche i pagamenti (150 €) e l'iscrizione");
    expect(source("src/components/gestionale/Deletion.tsx")).toContain("deleteBookingWithPaymentsAction");
  });

  it("#22: agli admin, nella riga dei pagamenti, come correggere un importo", () => {
    expect(source("src/components/gestionale/AccountsTab.tsx")).toContain("Per correggere un importo: {PARTY_LABELS.redsabbath} → Modifica.");
  });

  it("#23: gli altri nomi si tolgono con conferma e 'Eliminato · Annulla'", () => {
    const aliases = source("src/components/gestionale/PersonAliases.tsx");
    expect(aliases).toContain('entity="person_alias"');
    expect(source("src/app/gestione/(app)/delete-actions.ts")).toContain("restorePersonAlias(operator.id, input.id)");
  });
});
