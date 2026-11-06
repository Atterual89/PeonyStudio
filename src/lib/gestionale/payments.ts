// Logica pura di quote e pagamenti (D19, D21). Le stesse regole sono nelle
// funzioni Postgres (gw_apply_auto_status, migrazione 013): qui servono per
// anteprima, badge, riga del tab Iscrizioni e totali.

import { formatCents } from "./format";
import type { BookingStatus, Party, Payment, PaymentType } from "./types";
import { timestampToRomeDate } from "./workshops";

type Money = {
  status: BookingStatus;
  agreedFeeCents: number | null;
  payments: readonly Pick<Payment, "amountCents">[];
};

/**
 * Ordine dei movimenti: per data del pagamento; quelli senza data (026) per
 * data di inserimento (fuso Europe/Rome). A parità, per ora di inserimento.
 */
export function comparePayments(a: Pick<Payment, "paidOn" | "createdAt">, b: Pick<Payment, "paidOn" | "createdAt">): number {
  const day = (payment: Pick<Payment, "paidOn" | "createdAt">) => payment.paidOn ?? timestampToRomeDate(payment.createdAt) ?? "";
  return day(a).localeCompare(day(b)) || a.createdAt.localeCompare(b.createdAt);
}

/** Pagato netto: somma di tutti i movimenti (pagamenti, rimborsi, rettifiche). */
export function paidCents(payments: readonly Pick<Payment, "amountCents">[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

const AUTO_STATUSES: readonly BookingStatus[] = ["interessato", "prenotato", "acconto", "saldato"];

/**
 * D21 (come gw_apply_auto_status): lista d'attesa e cancellato non cambiano
 * mai da soli. Con quota: pagato > 0 e < quota → acconto, pagato ≥ quota →
 * saldato, pagato ≤ 0 → da acconto/saldato torna a prenotato.
 */
export function autoStatus(status: BookingStatus, feeCents: number | null, paid: number): BookingStatus {
  if (!AUTO_STATUSES.includes(status)) return status;
  if (paid > 0 && feeCents !== null) return paid >= feeCents ? "saldato" : "acconto";
  if (paid > 0) return status === "interessato" || status === "prenotato" ? "acconto" : status;
  return status === "acconto" || status === "saldato" ? "prenotato" : status;
}

export type PaymentTotals = {
  /** Σ quote delle prenotazioni non cancellate. */
  concordato: number;
  /** Σ di tutti i movimenti, anche delle prenotazioni cancellate. */
  ricevuto: number;
  /** Da incassare (D23): Σ dei residui positivi delle non cancellate e non in lista d'attesa, con quota. */
  daPagare: number;
  /** Σ dei pagati oltre la quota (non cancellate). */
  eccedenze: number;
  /** Pagato netto sulle prenotazioni cancellate (da rimborsare o trattenere). */
  pagatoCancellate: number;
  /** Prenotazioni non cancellate senza quota. */
  senzaQuota: number;
};

export function paymentTotals(bookings: readonly Money[]): PaymentTotals {
  const totals: PaymentTotals = { concordato: 0, ricevuto: 0, daPagare: 0, eccedenze: 0, pagatoCancellate: 0, senzaQuota: 0 };
  for (const booking of bookings) {
    const paid = paidCents(booking.payments);
    totals.ricevuto += paid;
    if (booking.status === "cancellato") {
      totals.pagatoCancellate += paid;
      continue;
    }
    if (booking.agreedFeeCents === null) {
      totals.senzaQuota += 1;
      continue;
    }
    totals.concordato += booking.agreedFeeCents;
    if (booking.status !== "lista_attesa") totals.daPagare += Math.max(0, booking.agreedFeeCents - paid);
    totals.eccedenze += Math.max(0, paid - booking.agreedFeeCents);
  }
  return totals;
}

/**
 * 4g (ipotesi 6): "chi deve pagare" (link da "Da incassare ancora X €"): con
 * prezzo, non cancellata né in lista d'attesa, pagato sotto il prezzo. Come
 * il totale "da incassare" (paymentTotals().daPagare).
 */
export function owesMoney(booking: Money): boolean {
  if (booking.status === "cancellato" || booking.status === "lista_attesa" || booking.agreedFeeCents === null) return false;
  return paidCents(booking.payments) < booking.agreedFeeCents;
}

/**
 * Riga del tab Iscrizioni: Acconto pagato è giustificato se c'è qualcosa di
 * pagato, Saldato se il pagato copre la quota. Se non lo è, scegliendo lo
 * stato si apre "Nuovo pagamento" invece di salvarlo.
 */
export function statusJustified(status: "acconto" | "saldato", paid: number, feeCents: number | null): boolean {
  return status === "acconto" ? paid > 0 : feeCents !== null && paid >= feeCents;
}

/** Riga chiusa (4g: "prezzo", "pagato in più"): "Pagato X su Y · manca Z" oppure "Prezzo Y · nessun pagamento". */
export function feeSummary(paid: number, feeCents: number | null): string {
  if (feeCents === null) return paid > 0 ? `Pagato ${formatCents(paid)} · prezzo mancante` : "Prezzo mancante · nessun pagamento";
  if (paid === 0) return `Prezzo ${formatCents(feeCents)} · nessun pagamento`;
  const base = `Pagato ${formatCents(paid)} su ${formatCents(feeCents)}`;
  if (paid < feeCents) return `${base} · manca ${formatCents(feeCents - paid)}`;
  if (paid > feeCents) return `${base} · pagato in più ${formatCents(paid - feeCents)}`;
  return base;
}

/** Avviso dopo il cambio del prezzo del workshop (D19): "N iscrizioni non risultano più pagate". */
export function unsettledWarning(unsettled: number): string | null {
  if (unsettled <= 0) return null;
  return unsettled === 1 ? "1 iscrizione non risulta più pagata del tutto." : `${unsettled} iscrizioni non risultano più pagate del tutto.`;
}

/** Iscrizione vista dal cambio del prezzo del workshop (#40): niente dati di persone. */
export type FeeRow = { status: BookingStatus; agreedFeeCents: number | null; feeCustom: boolean; paidCents: number };

/**
 * 4g (#40): cosa cambia se il prezzo del workshop diventa `newFeeCents`
 * (come gw_sync_workshop_fee): `touched` = iscrizioni non speciali e non
 * cancellate con un prezzo diverso; `unsettled` = quelle tra loro che oggi
 * risultano pagate del tutto e con il nuovo prezzo non più.
 */
export function feeChangeImpact(rows: readonly FeeRow[], newFeeCents: number): { touched: number; unsettled: number } {
  let touched = 0;
  let unsettled = 0;
  for (const row of rows) {
    if (row.feeCustom || row.status === "cancellato" || row.agreedFeeCents === newFeeCents) continue;
    touched += 1;
    if (row.agreedFeeCents !== null && row.paidCents >= row.agreedFeeCents && row.paidCents < newFeeCents) unsettled += 1;
  }
  return { touched, unsettled };
}

/** "Cambia il prezzo di 18 iscrizioni (non quelle con prezzo speciale). 3 non risulteranno più pagate. Confermi?"; null se non cambia niente. */
export function feeChangeQuestion({ touched, unsettled }: { touched: number; unsettled: number }): string | null {
  if (touched === 0) return null;
  const what = touched === 1 ? "1 iscrizione" : `${touched} iscrizioni`;
  const unpaid =
    unsettled === 0 ? "" : unsettled === 1 ? " 1 non risulterà più pagata." : ` ${unsettled} non risulteranno più pagate.`;
  return `Cambia il prezzo di ${what} (non quelle con prezzo speciale).${unpaid} Confermi?`;
}

/** Intestazione "Pagamenti · N · totale": solo i movimenti validi. */
export function paymentCount(payments: readonly Payment[]): number {
  return currentPayments(payments).length;
}

/** Un movimento valido com'è ora: importo al netto delle rettifiche; `modified` = frutto di una modifica. */
export type CurrentPayment = { payment: Payment; amountCents: number; modified: boolean };

/**
 * Elenco leggibile: un movimento corretto e la sua rettifica non compaiono;
 * resta il valore attuale (il movimento che lo sostituisce, segnato
 * "modificato"). Una rettifica senza movimento collegato resta visibile.
 * La somma degli importi è sempre il pagato netto (paidCents).
 */
export function currentPayments(payments: readonly Payment[]): CurrentPayment[] {
  const corrections = payments.filter((p) => p.kind === "rettifica" && p.correctsPaymentId);
  const correctedIds = new Set(corrections.map((p) => p.correctsPaymentId));
  const netById = new Map<string, number>();
  for (const payment of payments) if (payment.kind !== "rettifica") netById.set(payment.id, payment.amountCents);
  for (const fix of corrections) {
    const id = fix.correctsPaymentId!;
    if (netById.has(id)) netById.set(id, netById.get(id)! + fix.amountCents);
  }
  // Il movimento giusto nasce nella stessa transazione della rettifica (stesso created_at).
  const correctionTimes = new Set(corrections.map((p) => p.createdAt));

  return payments.flatMap((payment): CurrentPayment[] => {
    if (payment.kind === "rettifica") {
      return payment.correctsPaymentId && netById.has(payment.correctsPaymentId)
        ? []
        : [{ payment, amountCents: payment.amountCents, modified: false }];
    }
    const net = netById.get(payment.id)!;
    if (net === 0) return [];
    const modified = net !== payment.amountCents || (!correctedIds.has(payment.id) && correctionTimes.has(payment.createdAt));
    return [{ payment, amountCents: net, modified }];
  });
}

/** Quante correzioni ci sono ("Mostra correzioni (N)"). */
export function correctionCount(payments: readonly Payment[]): number {
  return payments.filter((p) => p.kind === "rettifica" && p.correctsPaymentId).length;
}

/** Movimenti annullati da rettifiche collegate (si mostrano barrati). */
export function voidedPaymentIds(payments: readonly Payment[]): Set<string> {
  const net = new Map<string, number>();
  for (const payment of payments) {
    if (payment.kind !== "rettifica") net.set(payment.id, (net.get(payment.id) ?? 0) + payment.amountCents);
  }
  for (const payment of payments) {
    if (payment.kind === "rettifica" && payment.correctsPaymentId && net.has(payment.correctsPaymentId)) {
      net.set(payment.correctsPaymentId, net.get(payment.correctsPaymentId)! + payment.amountCents);
    }
  }
  return new Set([...net].filter(([, value]) => value === 0).map(([id]) => id));
}

/**
 * 4e (#1): "+ Nuovo pagamento". Se c'è già un pagamento valido si propone il
 * Saldo con importo = quanto manca alla quota; altrimenti Acconto, importo vuoto.
 */
export function newPaymentPreset(payments: readonly Payment[], feeCents: number | null): { paymentType: PaymentType; amountCents?: number } {
  const hasPayment = currentPayments(payments).some((entry) => entry.payment.kind === "pagamento" && entry.amountCents > 0);
  if (!hasPayment) return { paymentType: "acconto" };
  const missing = feeCents === null ? 0 : feeCents - paidCents(payments);
  return missing > 0 ? { paymentType: "saldo", amountCents: missing } : { paymentType: "saldo" };
}

/**
 * 4g (ipotesi 1): tipo del pagamento dedotto, come lo stato automatico. Dopo
 * questo pagamento manca ancora qualcosa → acconto; quota raggiunta o
 * superata → saldo; senza quota → acconto. Un rimborso è "altro". Il tipo è
 * solo un'etichetta: nessun calcolo dipende da lui. Si può cambiare in "altro…".
 */
export function deducedPaymentType(paidBeforeCents: number, amountCents: number | null, feeCents: number | null, kind: "pagamento" | "rimborso" = "pagamento"): PaymentType {
  if (kind === "rimborso") return "altro";
  if (feeCents === null || amountCents === null) return "acconto";
  return paidBeforeCents + amountCents >= feeCents ? "saldo" : "acconto";
}

/**
 * 4g (#10): metodo proposto nel modulo = quello dell'ultimo pagamento
 * registrato da questo operatore (null se non ne ha registrati con un metodo).
 */
export function lastUsedMethod(
  payments: readonly { kind: Payment["kind"]; method: Payment["method"]; createdBy: string | null; createdAt: string }[],
  operatorId: string,
): Payment["method"] {
  const mine = payments
    .filter((payment) => payment.kind === "pagamento" && payment.method && payment.createdBy === operatorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mine[0]?.method ?? null;
}

/**
 * 4e (#2): "Registra rimborso di X €" su un'iscrizione cancellata. X = pagato
 * netto; un rimborso per ogni parte che ha incassato (come gw_refund_booking).
 * Se una parte è in negativo non si può ripartire: `askParty`, si chiede chi
 * restituisce i soldi.
 */
export function refundPlan(payments: readonly Pick<Payment, "amountCents" | "receivedBy">[]): {
  totalCents: number;
  parts: { party: Party; cents: number }[];
  askParty: boolean;
} {
  const byParty = new Map<Party, number>();
  for (const payment of payments) byParty.set(payment.receivedBy, (byParty.get(payment.receivedBy) ?? 0) + payment.amountCents);
  const totalCents = paidCents(payments);
  const parts = (["peony", "redsabbath"] as const)
    .filter((party) => (byParty.get(party) ?? 0) > 0)
    .map((party) => ({ party, cents: byParty.get(party)! }));
  return { totalCents, parts, askParty: [...byParty.values()].some((cents) => cents < 0) };
}
