// Anteprima del box di testo a moduli per persona: regole pure dell'anteprima
// che non riguardano il riconoscimento del testo (parse-roster.ts). Ogni riga
// è un modulo precompilato; ogni pagamento un mini-modulo con tutti i campi.

import { centsToInput, formatCents, parseEuroToCents } from "./format";
import { BOOKING_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "./labels";
import type { ParsedPayment } from "./parse-roster";
import { deducedPaymentType } from "./payments";
import type { BookingStatus, Party, Payment, PaymentMethod, PaymentType, Registration } from "./types";

/** Incassato da, predefinito: Ale. */
export const DEFAULT_RECEIVED_BY: Party = "redsabbath";

/** Mini-modulo di un pagamento. Vuoto = il parser non l'ha trovato (da completare). */
export type PreviewPayment = {
  amountText: string;
  /** Tipo scritto nel testo o scelto in "altro…"; con `typeAuto` si deduce (previewPaymentTypes). */
  paymentType: PaymentType | null;
  /** 4g (#28, ipotesi 1): tipo dedotto dall'importo e dal prezzo, niente "Tipo?". */
  typeAuto: boolean;
  method: PaymentMethod | null;
  paidOn: string;
  receivedBy: Party;
  removed: boolean;
  /** Il pagamento come l'ha letto il parser (null = aggiunto nell'anteprima). */
  parsed: ParsedPayment | null;
};

/** Campi obbligatori di un pagamento. La data è facoltativa (026); il tipo si deduce (4g, #28). */
export type PaymentField = "amount" | "method";

export function previewPayment(parsed: ParsedPayment): PreviewPayment {
  return {
    amountText: centsToInput(parsed.amountCents),
    // 4g (#28): senza "saldo"/"acconto" nel testo il tipo si deduce, niente "Tipo?".
    paymentType: parsed.typeExplicit ? parsed.paymentType : null,
    typeAuto: !parsed.typeExplicit,
    method: parsed.method,
    // Il testo non ha date: vuota = "data non indicata" (facoltativa, 026).
    paidOn: "",
    receivedBy: DEFAULT_RECEIVED_BY,
    removed: false,
    parsed,
  };
}

/** Campi obbligatori ancora vuoti (o non validi, per l'importo), nell'ordine del modulo. */
export function missingFields(payment: Pick<PreviewPayment, "amountText" | "method">): PaymentField[] {
  const cents = parseEuroToCents(payment.amountText);
  const missing: PaymentField[] = [];
  if (cents === null || cents <= 0) missing.push("amount");
  if (!payment.method) missing.push("method");
  return missing;
}

/**
 * 4g (#28, ipotesi 1): tipo di ogni pagamento della riga, nell'ordine. Quelli
 * con `typeAuto` (o senza tipo) si deducono come nel modulo della riga: dopo
 * questo pagamento manca ancora qualcosa → acconto, prezzo raggiunto → saldo,
 * senza prezzo → acconto. `paidBeforeCents`: già pagato (righe già presenti).
 */
export function previewPaymentTypes(
  payments: readonly Pick<PreviewPayment, "amountText" | "paymentType" | "typeAuto" | "removed">[],
  feeCents: number | null,
  paidBeforeCents = 0,
): PaymentType[] {
  let paid = paidBeforeCents;
  return payments.map((payment) => {
    const cents = payment.removed ? null : parseEuroToCents(payment.amountText);
    const type = payment.typeAuto || !payment.paymentType ? deducedPaymentType(paid, cents, feeCents) : payment.paymentType;
    if (cents && cents > 0) paid += cents;
    return type;
  });
}

/** Etichetta breve degli stati nelle frasi dell'anteprima ("Prenotato" invece di "Prenotato a parola"). */
function shortStatus(status: BookingStatus): string {
  return status === "prenotato" ? "Prenotato" : BOOKING_STATUS_LABELS[status];
}

/**
 * 4g (#27): il conflitto testo / pagamenti come una frase semplice:
 * "Nel testo: Prenotato. Ha già pagato 300 €: segno Acconto pagato?" con
 * "Sì" e (se si può tenere lo stato del testo) "No, lascia Prenotato".
 */
export function statusConflictText(textStatus: BookingStatus, paymentsStatus: BookingStatus, paidCents: number): { question: string; keepLabel: string } {
  const paid = paidCents > 0 ? ` Ha già pagato ${formatCents(paidCents)}:` : "";
  return {
    question: `Nel testo: ${shortStatus(textStatus)}.${paid} segno ${BOOKING_STATUS_LABELS[paymentsStatus]}?`,
    keepLabel: `No, lascia ${shortStatus(textStatus)}`,
  };
}

/**
 * 4g (#26): riga di una card chiusa, quando è tutto giusto:
 * "Dalia · Acconto pagato · 225 € PayPal ✓".
 */
export function cardSummaryLine(
  people: readonly string[],
  status: BookingStatus,
  payments: readonly Pick<PreviewPayment, "amountText" | "method" | "removed">[],
): string {
  const money = payments
    .filter((payment) => !payment.removed)
    .map((payment) => {
      const cents = parseEuroToCents(payment.amountText);
      return [cents === null ? payment.amountText : formatCents(cents), payment.method ? PAYMENT_METHOD_LABELS[payment.method] : null].filter(Boolean).join(" ");
    });
  return [people.filter((name) => name.trim()).join(" + "), BOOKING_STATUS_LABELS[status], ...(money.length ? [money.join(" + ")] : [])].join(" · ") + " ✓";
}

/**
 * Righe già presenti: pagamenti del testo uguali a uno già registrato
 * (importo e, se indicato da entrambe le parti, metodo), abbinati uno a uno.
 * Indice del pagamento della riga → indice in `registered`. Due pagamenti
 * del testo con lo stesso importo non si abbinano allo stesso registrato.
 * Si guarda il pagamento letto dal parser: modificare i campi non lo sposta.
 */
export function registeredMatches(
  payments: readonly Pick<PreviewPayment, "removed" | "parsed">[],
  registered: readonly Pick<Payment, "kind" | "amountCents" | "method">[],
): Map<number, number> {
  const used = new Set<number>();
  const matches = new Map<number, number>();
  payments.forEach((payment, index) => {
    const parsed = payment.parsed;
    if (payment.removed || !parsed) return;
    const found = registered.findIndex(
      (existing, at) =>
        !used.has(at) &&
        existing.kind === "pagamento" &&
        existing.amountCents === parsed.amountCents &&
        (!parsed.method || !existing.method || existing.method === parsed.method),
    );
    if (found < 0) return;
    used.add(found);
    matches.set(index, found);
  });
  return matches;
}

/**
 * Pagamenti mostrati come mini-moduli (e salvati): non tolti e, sulle righe
 * già presenti, non già registrati (salvo "Aggiungilo comunque").
 */
export function formPaymentIndexes(
  payments: readonly Pick<PreviewPayment, "removed">[],
  matches: ReadonlyMap<number, number>,
  addedAnyway: Readonly<Record<number, boolean>>,
): number[] {
  return payments.flatMap((payment, index) => (!payment.removed && (!matches.has(index) || addedAnyway[index]) ? [index] : []));
}

/** Campi da completare di una card: nomi vuoti e campi obbligatori dei suoi pagamenti. */
export function cardMissingCount(people: readonly string[], payments: readonly PreviewPayment[], formIndexes: readonly number[]): number {
  return people.filter((name) => !name.trim()).length + formIndexes.reduce((sum, index) => sum + missingFields(payments[index]).length, 0);
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Riassunto in cima: "Ho trovato N iscrizioni e M pagamenti · K campi da completare". */
export function previewSummary(registrations: number, payments: number, missing: number): string {
  const found = `Ho trovato ${plural(registrations, "iscrizione", "iscrizioni")} e ${plural(payments, "pagamento", "pagamenti")}`;
  return `${found} · ${missing === 0 ? "nessun campo da completare" : plural(missing, "campo da completare", "campi da completare")}`;
}

/** 4g (#42): esito in seconda persona e breve: "Fatto: 3 nuove, 1 aggiornata, 4 pagamenti". */
export function importDoneMessage(created: number, updated: number, payments: number): string {
  const parts = [
    created ? plural(created, "nuova", "nuove") : null,
    updated ? plural(updated, "aggiornata", "aggiornate") : null,
    payments ? plural(payments, "pagamento", "pagamenti") : null,
  ].filter(Boolean);
  return parts.length ? `Fatto: ${parts.join(", ")}.` : "Fatto.";
}

/** Testo del pulsante in fondo: "Salva", oppure "Completa N campi". */
export function saveLabel(missing: number): string {
  return missing === 0 ? "Salva" : `Completa ${plural(missing, "campo", "campi")}`;
}

/** Riga nuova cancellata senza pagamenti: avviso nella card, non si importa salvo "Importa comunque". */
export function cancelledWithoutPayments(status: BookingStatus, payments: readonly Pick<PreviewPayment, "removed">[]): boolean {
  return status === "cancellato" && payments.every((payment) => payment.removed);
}

/**
 * #9: riga già presente con un'email nel testo: si propone "Salva l'email" se
 * Ale non ne aveva ancora scritta una per quella persona (lei vede solo le sue).
 */
export function emailToSave(
  email: string | null | undefined,
  registration: Pick<Registration, "people"> | null | undefined,
): string | null {
  const value = email?.trim().toLowerCase();
  if (!value || !registration) return null;
  const primary = registration.people.find((person) => person.isPrimary) ?? registration.people[0];
  return primary && !primary.enteredEmail ? value : null;
}
