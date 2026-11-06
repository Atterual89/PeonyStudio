// Testi delle eliminazioni (Fase 4b, D22): pure, usabili anche nel client.
// Eliminare corregge un errore di inserimento; gli eventi reali hanno già i
// loro strumenti (Cancellato, Rimborso) e ogni conferma lo ricorda.

import { formatCents } from "./format";
import { PAYMENT_METHOD_LABELS } from "./labels";
import { paidCents } from "./payments";
import type { Payment } from "./types";

/**
 * Durata minima del messaggio "Eliminato · Annulla" (4g, #18): almeno 30
 * secondi; dopo resta finché non si tocca altro. Il server accetta il
 * ripristino per 10 minuti: oltre il messaggio sparisce comunque.
 */
export const UNDO_SECONDS = 30;
export const UNDO_MAX_SECONDS = 600;

/** Il messaggio "Eliminato · Annulla" sparisce? Dopo 30 s al primo tocco altrove; dopo 10 minuti in ogni caso. */
export function undoShouldHide(elapsedSeconds: number, touchedElsewhere: boolean): boolean {
  return elapsedSeconds >= UNDO_MAX_SECONDS || (touchedElsewhere && elapsedSeconds >= UNDO_SECONDS);
}

export const DELETE_HINTS = {
  payment: "Serve a correggere un errore di inserimento: se hai restituito i soldi, usa invece «Ho restituito dei soldi».",
  booking: "Serve a correggere un errore di inserimento: se la persona si è ritirata, usa lo stato Cancellato.",
  generic: "Serve a correggere un errore di inserimento.",
} as const;

const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Eliminare il pagamento di 250 € · PayPal · 28 ott di Aster?" (importo attuale, al netto delle rettifiche). */
export function paymentDeleteQuestion(
  payment: Pick<Payment, "kind" | "method" | "paidOn">,
  amountCents: number,
  name: string,
): string {
  const what = payment.kind === "rimborso" ? "il rimborso" : payment.kind === "rettifica" ? "la rettifica" : "il pagamento";
  const details = [
    formatCents(Math.abs(amountCents)),
    payment.method ? PAYMENT_METHOD_LABELS[payment.method] : null,
    payment.paidOn ? shortDate.format(new Date(`${payment.paidOn.slice(0, 10)}T00:00:00Z`)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `Eliminare ${what} di ${details} di ${name}?`;
}

/**
 * Un'iscrizione si elimina solo senza soldi: pagato netto 0 (i movimenti
 * eliminati non ci sono già più). Stessa regola di gw_delete_booking, che
 * controlla anche ciascuna parte.
 */
export function bookingDeleteBlock(payments: readonly Pick<Payment, "amountCents">[]): string | null {
  const paid = paidCents(payments);
  return paid === 0 ? null : `Ha ${formatCents(paid)} di pagamenti: eliminali o registra un rimborso prima.`;
}

/**
 * 4e (#21): iscrizione inserita per errore con dei pagamenti. "Elimina anche i
 * pagamenti (X €) e l'iscrizione": una sola conferma e un solo Annulla
 * (gw_delete_booking_with_payments, stesso gruppo di eliminazione).
 */
export function bookingWithPaymentsLabel(payments: readonly Pick<Payment, "amountCents">[]): string {
  return `Elimina anche i pagamenti (${formatCents(paidCents(payments))}) e l'iscrizione`;
}

/** Conferma del workshop: il nome scritto uguale (spazi e maiuscole a parte). */
export function workshopNameMatches(typed: string, name: string): boolean {
  return typed.trim().toLowerCase() === name.trim().toLowerCase() && typed.trim() !== "";
}
