// Recap economico (Fase 4c, D23): Entrate · Spese · Guadagno · Da incassare (4g),
// uguali in home, card e tab Conti. Nessuna formula nuova: Entrate, Uscite e
// Rimane sono Ricavi, Spese e Utile di computeSettlement; Da incassare è
// paymentTotals().daPagare.

import { formatCents } from "./format";
import { PARTY_LABELS } from "./labels";
import { paymentTotals } from "./payments";
import { computeSettlement, isSettled, needsRecheck, residuoPhrase, settlementStatusOf, type Settlement, type SettlementInput } from "./settlement";
import type { BookingStatus, OperatorRole, Party, SettlementStatus, TransferStatus } from "./types";
import { groupByTime, type EconomicState, type TemporalStatus } from "./workshops";

export type Recap = {
  entrate: number;
  uscite: number;
  rimane: number;
  daIncassare: number;
};

export type WorkshopRecap = Recap & {
  /** Nessun pagamento né spesa valida: la card mostra "Nessun movimento". */
  movimenti: boolean;
  /** Residuo del conguaglio (positivo: Ale deve a Peony); null se non calcolabile. */
  residuo: number | null;
  /** D24: dal residuo; null senza movimenti (la card dice già "Nessun movimento"). */
  economic: EconomicState | null;
  /** #18: verificato e poi modificato: "Da ricontrollare". */
  daRicontrollare: boolean;
};

/** Stessi numeri del tab Conti: dal consuntivo e dal totale "da incassare" già calcolati. */
export function recapOf(settlement: Settlement, daIncassare: number): Recap {
  return { entrate: settlement.ricavi, uscite: settlement.spese, rimane: settlement.utile, daIncassare };
}

/** Una riga di gw_economic_overview (lettura aggregata, migrazione 021), già convertita in numeri. */
export type OverviewRow = {
  workshopId: string;
  status: SettlementStatus;
  input: SettlementInput;
  paymentCount: number;
  expenseCount: number;
  bookings: readonly { status: BookingStatus; agreedFeeCents: number | null; paidCents: number }[];
  /** #18 (migrazione 024): totali salvati alla verifica. */
  verifiedSnapshot: unknown;
};

/** Riga come arriva da gw_economic_overview (importi bigint come numeri o stringhe). */
export type OverviewRecord = {
  workshop_id: string;
  peony_pct: number | string;
  loss_peony_cents: number | string | null;
  /** Anche i valori vecchi da_conguagliare / conguagliato (D24, settlementStatusOf). */
  settlement_status: SettlementStatus | "da_conguagliare" | "conguagliato";
  payment_count: number;
  expense_count: number;
  payments: { received_by: Party; amount_cents: number | string }[];
  expenses: { advanced_by: Party; amount_cents: number | string }[];
  transfers: { from_party: Party; to_party: Party; status: TransferStatus; amount_cents: number | string }[];
  carryovers_in: { debtor: Party; creditor: Party; amount_cents: number | string }[];
  carryovers_out: { debtor: Party; creditor: Party; amount_cents: number | string }[];
  bookings: { status: BookingStatus; agreed_fee_cents: number | string | null; paid_cents: number | string }[];
  /** Dalla migrazione 024; assente prima. */
  verified_snapshot?: unknown;
};

export function toOverviewRow(record: OverviewRecord): OverviewRow {
  const carryover = (c: OverviewRecord["carryovers_in"][number]) => ({ debtor: c.debtor, creditor: c.creditor, amountCents: Number(c.amount_cents) });
  return {
    workshopId: record.workshop_id,
    status: settlementStatusOf(record.settlement_status),
    verifiedSnapshot: record.verified_snapshot ?? null,
    paymentCount: Number(record.payment_count),
    expenseCount: Number(record.expense_count),
    input: {
      peonyPct: Number(record.peony_pct),
      lossPeonyCents: record.loss_peony_cents === null ? null : Number(record.loss_peony_cents),
      payments: record.payments.map((p) => ({ receivedBy: p.received_by, amountCents: Number(p.amount_cents) })),
      expenses: record.expenses.map((e) => ({ advancedBy: e.advanced_by, amountCents: Number(e.amount_cents) })),
      transfers: record.transfers.map((t) => ({ fromParty: t.from_party, toParty: t.to_party, status: t.status, amountCents: Number(t.amount_cents) })),
      carryoversIn: record.carryovers_in.map(carryover),
      carryoversOut: record.carryovers_out.map(carryover),
    },
    bookings: record.bookings.map((b) => ({
      status: b.status,
      agreedFeeCents: b.agreed_fee_cents === null ? null : Number(b.agreed_fee_cents),
      paidCents: Number(b.paid_cents),
    })),
  };
}

export function workshopRecap(row: OverviewRow): WorkshopRecap {
  const settlement = computeSettlement(row.input);
  const totals = paymentTotals(
    row.bookings.map((b) => ({ status: b.status, agreedFeeCents: b.agreedFeeCents, payments: [{ amountCents: b.paidCents }] })),
  );
  const movimenti = row.paymentCount + row.expenseCount > 0;
  return {
    ...recapOf(settlement, totals.daPagare),
    movimenti,
    residuo: settlement.residuo,
    economic: movimenti ? (isSettled(settlement) ? "saldato" : "aperto") : null,
    daRicontrollare: needsRecheck(row.status, row.verifiedSnapshot, settlement, row.input.lossPeonyCents),
  };
}

export type RecapTotals = Recap & {
  /** Conguagli ancora da fare sui workshop non saldati (somma dei residui per direzione). */
  conguagli: { alePeony: number; peonyAle: number };
};

/** Totali della home: somma dei workshop indicati. */
export function sumRecaps(recaps: readonly (WorkshopRecap | null)[]): RecapTotals {
  const totals: RecapTotals = { entrate: 0, uscite: 0, rimane: 0, daIncassare: 0, conguagli: { alePeony: 0, peonyAle: 0 } };
  for (const recap of recaps) {
    if (!recap) continue;
    totals.entrate += recap.entrate;
    totals.uscite += recap.uscite;
    totals.rimane += recap.rimane;
    totals.daIncassare += recap.daIncassare;
    if (recap.economic === "aperto" && recap.residuo) {
      if (recap.residuo > 0) totals.conguagli.alePeony += recap.residuo;
      else totals.conguagli.peonyAle -= recap.residuo;
    }
  }
  return totals;
}

/**
 * 4g (#2, ipotesi 5): chi deve dare quanto, come frase intera. Ad Ale in
 * seconda persona ("Devi dare 950 € a Peony" · "Peony ti deve 120 €" ·
 * "Siete pari"); agli admin in terza ("Ale deve dare 950 € a Peony" ·
 * "Peony deve dare 120 € ad Ale" · "Pari"). null = non calcolabile (perdita
 * da dividere).
 */
export function debtPhrase(residuo: number | null, viewer: OperatorRole): string | null {
  if (residuo === null) return null;
  if (viewer !== "organizzatrice") return residuoPhrase(residuo);
  if (residuo > 0) return `Devi dare ${formatCents(residuo)} a ${PARTY_LABELS.peony}`;
  if (residuo < 0) return `${PARTY_LABELS.peony} ti deve ${formatCents(-residuo)}`;
  return "Siete pari";
}

/**
 * Home: somma per direzione dei workshop ancora aperti, come frasi intere
 * ("Devi dare 900 € a Peony · Peony ti deve 40 €"). Ad Ale "Siete pari" se
 * non c'è niente; agli admin null.
 */
export function conguagliText({ alePeony, peonyAle }: RecapTotals["conguagli"], viewer: OperatorRole = "admin"): string | null {
  const parts = [alePeony ? debtPhrase(alePeony, viewer) : null, peonyAle ? debtPhrase(-peonyAle, viewer) : null].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  return viewer === "organizzatrice" ? "Siete pari" : null;
}

/** Riga compatta della card: "Entrate 5.200 € · Spese 1.150 € · Guadagno 4.050 €" oppure "Nessun movimento". */
export function recapLine(recap: WorkshopRecap | null): string {
  if (!recap || !recap.movimenti) return "Nessun movimento";
  return `Entrate ${formatCents(recap.entrate)} · Spese ${formatCents(recap.uscite)} · Guadagno ${formatCents(recap.rimane)}`;
}

/** D24, 4g (#4): badge della home, "Pari" oppure chi deve dare quanto (o "Da dividere" se non è calcolabile). */
export function economicText(economic: EconomicState, residuo: number | null, viewer: OperatorRole = "admin"): string {
  if (economic === "saldato") return "Pari";
  return (residuo ? debtPhrase(residuo, viewer) : null) ?? "Da dividere";
}

/** Risultato breve del conguaglio (sezione chiusa "Divisione"): la stessa frase, oppure "Da dividere". */
export function residuoShort(residuo: number | null, viewer: OperatorRole = "admin"): string {
  return debtPhrase(residuo, viewer) ?? "Da dividere";
}

/**
 * 4g (#33): pulsante che segna il conguaglio come fatto oggi, scritto come
 * un fatto ("Ho dato 950 € a Peony") e non come un'istruzione, con la
 * domanda di conferma. null se non c'è niente da dare.
 */
export function settleLabels(residuo: number | null, viewer: OperatorRole): { button: string; question: string } | null {
  if (!residuo) return null;
  const amount = formatCents(Math.abs(residuo));
  const ale = viewer === "organizzatrice";
  if (residuo > 0) {
    return ale
      ? { button: `Ho dato ${amount} a ${PARTY_LABELS.peony}`, question: "L'hai già dato? Lo segno come fatto oggi." }
      : { button: `${PARTY_LABELS.redsabbath} ha dato ${amount} a ${PARTY_LABELS.peony}`, question: "Li ha già dati? Lo segno come fatto oggi." };
  }
  return ale
    ? { button: `${PARTY_LABELS.peony} mi ha dato ${amount}`, question: "Li hai già ricevuti? Lo segno come fatto oggi." }
    : { button: `${PARTY_LABELS.peony} ha dato ${amount} ad ${PARTY_LABELS.redsabbath}`, question: "Già dati? Lo segno come fatto oggi." };
}

/** Anno del selettore: quello della data di inizio del workshop. "tutti" = nessun filtro. */
export type YearFilter = number | "tutti";

export function parseYearFilter(value: string | string[] | undefined, today: string): YearFilter {
  if (value === "tutti") return "tutti";
  const year = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : NaN;
  return Number.isFinite(year) ? year : Number(today.slice(0, 4));
}

export function inYear(startsOn: string, year: YearFilter): boolean {
  return year === "tutti" || startsOn.startsWith(`${year}-`);
}

/** Anni disponibili nel selettore (sempre anche l'anno corrente), dal più recente. */
export function availableYears(startDates: readonly string[], today: string): number[] {
  const years = new Set(startDates.map((date) => Number(date.slice(0, 4))));
  years.add(Number(today.slice(0, 4)));
  return [...years].filter(Number.isFinite).sort((a, b) => b - a);
}

type HomeEntry = { startsOn: string; endsOn: string | null; recap: WorkshopRecap | null };

/**
 * Home (D23): il filtro per anno vale solo per i Passati e per i 4 riquadri;
 * In corso e Prossimi si vedono sempre tutti, di qualsiasi anno. La tabella
 * desktop somma le righe visibili: se non coincidono con i riquadri, la riga
 * si chiama "Totale righe visibili".
 */
export function homeView<T extends HomeEntry>(entries: readonly T[], year: YearFilter, today: string) {
  const all = groupByTime(entries, today);
  const groups: Record<TemporalStatus, T[]> = { ...all, passato: all.passato.filter((entry) => inYear(entry.startsOn, year)) };
  const totals = sumRecaps(entries.filter((entry) => inYear(entry.startsOn, year)).map((entry) => entry.recap));
  const rows = [...groups.in_corso, ...groups.prossimo, ...groups.passato];
  const rowTotals = sumRecaps(rows.map((entry) => entry.recap));
  const same = rowTotals.entrate === totals.entrate && rowTotals.uscite === totals.uscite && rowTotals.rimane === totals.rimane;
  return { groups, totals, rows, totalLabel: same ? "Totale" : "Totale righe visibili" };
}
