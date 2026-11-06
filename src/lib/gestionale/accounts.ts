// Tab Conti ed export (Fase 4): dati del consuntivo e aggregati da mostrare.
// Solo raggruppamenti e somme per la lettura; le formule del conguaglio sono
// SOLO in settlement.ts. Nessun dato anagrafico: le prenotazioni hanno il
// nome come l'ha scritto Ale (entered_as, D18/D20).

import { EXPENSE_CATEGORY_LABELS } from "./labels";
import { paidCents, paymentTotals } from "./payments";
import { recapOf, type Recap } from "./recap";
import { registrationTitle } from "./registrations";
import { computeSettlement, type Settlement, type SettlementInput } from "./settlement";
import type {
  CarryoverStatus,
  ExpenseCategory,
  OperatorRole,
  Party,
  Payment,
  PaymentMethod,
  Registration,
  SettlementStatus,
  TransferStatus,
} from "./types";

export type Expense = {
  id: string;
  version: number;
  description: string;
  amountCents: number;
  advancedBy: Party;
  category: ExpenseCategory;
  spentOn: string | null;
  /** D25: solo il ruolo di chi l'ha inserita ("inserita da Peony/Ale"), mai il nome. */
  createdByRole: OperatorRole | null;
};

export type Transfer = {
  id: string;
  version: number;
  fromParty: Party;
  toParty: Party;
  amountCents: number;
  status: TransferStatus;
  executedOn: string | null;
  notes: string | null;
};

export type Carryover = {
  id: string;
  version: number;
  /** L'altro workshop: l'origine per un riporto in entrata, la destinazione per uno in uscita. */
  otherWorkshop: { id: string; name: string };
  debtor: Party;
  creditor: Party;
  amountCents: number;
  status: CarryoverStatus;
  notes: string | null;
};

/** Entrate per prenotazione: un solo importo anche per la coppia; i movimenti per il dettaglio. */
export type IncomeRow = { bookingId: string; title: string; cancelled: boolean; paidCents: number; payments: Payment[] };

export type AccountsData = {
  workshop: {
    id: string;
    version: number;
    name: string;
    startsOn: string;
    endsOn: string | null;
    peonyPct: number;
    lossPeonyCents: number | null;
    status: SettlementStatus;
    verifiedSnapshot: unknown;
    verifiedAt: string | null;
    /** D25: ruolo di chi ha verificato ("Verificato da Peony/Ale il …"). */
    verifiedByRole: OperatorRole | null;
  };
  income: IncomeRow[];
  /** Pagato per chi ha incassato e per metodo (null = metodo non indicato). */
  incomeByMethod: { method: PaymentMethod | null; cents: number }[];
  expenses: Expense[];
  transfers: Transfer[];
  carryoversIn: Carryover[];
  carryoversOut: Carryover[];
  /** Ancora da incassare sulle prenotazioni non cancellate, e quante non hanno quota. */
  outstanding: { daPagare: number; senzaQuota: number };
  input: SettlementInput;
  settlement: Settlement;
  /** D23: Entrate · Uscite · Rimane · Da incassare, come in home. */
  recap: Recap;
};

const METHOD_ORDER: readonly (PaymentMethod | null)[] = ["paypal", "contanti", "bonifico", "altro", null];

/** Mette insieme i dati letti dal server e calcola il consuntivo (una sola volta, con computeSettlement). */
export function buildAccounts(raw: {
  workshop: AccountsData["workshop"];
  registrations: readonly Registration[];
  expenses: Expense[];
  transfers: Transfer[];
  carryoversIn: Carryover[];
  carryoversOut: Carryover[];
}): AccountsData {
  const payments = raw.registrations.flatMap((registration) => registration.payments);
  const byMethod = new Map<PaymentMethod | null, number>();
  for (const payment of payments) byMethod.set(payment.method, (byMethod.get(payment.method) ?? 0) + payment.amountCents);

  const input: SettlementInput = {
    peonyPct: raw.workshop.peonyPct,
    lossPeonyCents: raw.workshop.lossPeonyCents,
    payments: payments.map((p) => ({ amountCents: p.amountCents, receivedBy: p.receivedBy })),
    expenses: raw.expenses.map((e) => ({ amountCents: e.amountCents, advancedBy: e.advancedBy })),
    transfers: raw.transfers.map((t) => ({ fromParty: t.fromParty, toParty: t.toParty, amountCents: t.amountCents, status: t.status })),
    carryoversIn: raw.carryoversIn.map((c) => ({ debtor: c.debtor, creditor: c.creditor, amountCents: c.amountCents })),
    carryoversOut: raw.carryoversOut.map((c) => ({ debtor: c.debtor, creditor: c.creditor, amountCents: c.amountCents })),
  };
  const totals = paymentTotals(raw.registrations);
  const settlement = computeSettlement(input);

  return {
    workshop: raw.workshop,
    income: raw.registrations
      .filter((registration) => registration.payments.length > 0)
      .map((registration) => ({
        bookingId: registration.bookingId,
        title: registrationTitle(registration),
        cancelled: registration.status === "cancellato",
        paidCents: paidCents(registration.payments),
        payments: registration.payments,
      })),
    incomeByMethod: METHOD_ORDER.filter((method) => byMethod.has(method)).map((method) => ({ method, cents: byMethod.get(method)! })),
    expenses: raw.expenses,
    transfers: raw.transfers,
    carryoversIn: raw.carryoversIn,
    carryoversOut: raw.carryoversOut,
    outstanding: { daPagare: totals.daPagare, senzaQuota: totals.senzaQuota },
    input,
    settlement,
    recap: recapOf(settlement, totals.daPagare),
  };
}

export type ExpenseGroup = { category: ExpenseCategory; label: string; totalCents: number; expenses: Expense[] };

/** Spese raggruppate per categoria (nell'ordine dei pulsanti), con il totale di ognuna. */
export function expensesByCategory(expenses: readonly Expense[]): ExpenseGroup[] {
  return (Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).flatMap((category) => {
    const list = expenses.filter((expense) => expense.category === category);
    if (list.length === 0) return [];
    return [
      {
        category,
        label: EXPENSE_CATEGORY_LABELS[category],
        totalCents: list.reduce((sum, expense) => sum + expense.amountCents, 0),
        expenses: list,
      },
    ];
  });
}

/** Nome del file Excel: consuntivo-<slug-workshop>-<data>.xlsx */
export function exportFileName(workshopName: string, date: string): string {
  const slug =
    workshopName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "workshop";
  return `consuntivo-${slug}-${date}.xlsx`;
}
