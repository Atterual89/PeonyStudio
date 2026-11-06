"use client";

// Elementi comuni di quote e pagamenti (D19, D21): elenco dei movimenti e
// totali. Nessun dato di persone.

import { useState } from "react";

import { formatCents, formatPaymentDate } from "@/lib/gestionale/format";
import { PARTY_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/gestionale/labels";
import { correctionCount, currentPayments, paymentTotals, voidedPaymentIds, type CurrentPayment } from "@/lib/gestionale/payments";
import type { BookingStatus, Payment } from "@/lib/gestionale/types";

/**
 * Movimenti in ordine di data (senza data: per inserimento). I movimenti annullati da una correzione si
 * mostrano barrati; `actions` aggiunge i pulsanti (solo nel tab di Ale).
 */
export function PaymentList({
  payments,
  actions,
}: {
  payments: readonly Payment[];
  actions?: (payment: Payment, voided: boolean) => React.ReactNode;
}) {
  if (payments.length === 0) return <p className="text-sm text-[#5f524c]">Nessun movimento.</p>;
  const voided = voidedPaymentIds([...payments]);

  return (
    <ul className="divide-y divide-[#211815]/5 rounded-xl border border-[#211815]/10 bg-white">
      {payments.map((payment) => {
        const isVoided = voided.has(payment.id);
        const label = movementLabel(payment);
        return (
          <li key={payment.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
            <span className={isVoided ? "text-[#5f524c] line-through" : ""}>
              {formatPaymentDate(payment.paidOn)}
              {" · "}
              {label}
              {payment.method ? ` · ${PAYMENT_METHOD_LABELS[payment.method]}` : " · metodo ?"}
              {" · "}
              <strong className={payment.amountCents < 0 ? "text-[#9b2c2c]" : ""}>{formatCents(payment.amountCents)}</strong>
              {payment.receivedBy !== "redsabbath" ? (
                <span className="text-[#5f524c]">
                  {" · "}
                  {payment.kind === "rimborso" ? "restituito da" : "incassato da"} {PARTY_LABELS[payment.receivedBy]}
                </span>
              ) : null}
              {payment.description ? <span className="block text-[#5f524c]">{payment.description}</span> : null}
            </span>
            {actions ? <span className="flex gap-1">{actions(payment, isVoided)}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function movementLabel(payment: Payment): string {
  return payment.kind === "pagamento" ? PAYMENT_TYPE_LABELS[payment.paymentType] : PAYMENT_KIND_LABELS[payment.kind];
}

/**
 * Elenco leggibile (tab Iscrizioni di Ale e tab Conti → Entrate): solo i
 * movimenti validi, col valore attuale. `actions`: azioni del movimento.
 * 4g (#13): solo agli admin (`showCorrections`) l'etichetta "modificato" e, in
 * fondo, "Mostra correzioni (N)" con lo storico completo (originali barrati e
 * rettifiche); Ale vede solo i pagamenti validi.
 */
export function CurrentPaymentList({
  payments,
  actions,
  showCorrections = false,
}: {
  payments: readonly Payment[];
  actions?: (current: CurrentPayment) => React.ReactNode;
  showCorrections?: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const current = currentPayments(payments);
  const corrections = correctionCount(payments);

  return (
    <div className="space-y-2">
      {current.length === 0 ? (
        <p className="text-sm text-[#5f524c]">Nessun movimento.</p>
      ) : (
        <ul className="divide-y divide-[#211815]/5 rounded-xl border border-[#211815]/10 bg-white">
          {current.map((entry) => {
            const { payment } = entry;
            return (
              <li key={payment.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {formatPaymentDate(payment.paidOn)}
                  {" · "}
                  {movementLabel(payment)}
                  {payment.method ? ` · ${PAYMENT_METHOD_LABELS[payment.method]}` : " · metodo ?"}
                  {" · "}
                  <strong className={entry.amountCents < 0 ? "text-[#9b2c2c]" : ""}>{formatCents(entry.amountCents)}</strong>
                  {showCorrections && entry.modified ? (
                    <span className="ml-1.5 rounded-full bg-[#211815]/5 px-1.5 py-0.5 text-[11px] font-semibold text-[#5f524c]">modificato</span>
                  ) : null}
                  {payment.receivedBy !== "redsabbath" ? (
                    <span className="text-[#5f524c]">
                      {" · "}
                      {payment.kind === "rimborso" ? "restituito da" : "incassato da"} {PARTY_LABELS[payment.receivedBy]}
                    </span>
                  ) : null}
                  {payment.description ? <span className="block text-[#5f524c]">{payment.description}</span> : null}
                </span>
                {actions ? <span className="flex shrink-0 gap-1">{actions(entry)}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
      {showCorrections && corrections > 0 ? (
        <>
          <button type="button" className="min-h-10 text-sm text-[#5f524c] underline" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "Nascondi correzioni" : `Mostra correzioni (${corrections})`}
          </button>
          {showHistory ? <PaymentList payments={payments} /> : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Totali (4g, #17): Totale prezzi · Ricevuto · Mancano; sotto, solo se
 * diversi da zero e con frasi intere, pagato in più, pagato da chi ha
 * cancellato e iscrizioni senza prezzo.
 */
export function PaymentTotalsBox({
  bookings,
}: {
  bookings: readonly { status: BookingStatus; agreedFeeCents: number | null; payments: readonly Payment[] }[];
}) {
  const totals = paymentTotals(bookings);
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-2xl border border-[#211815]/10 bg-white/70 p-3 text-sm">
      <div>
        <dt className="text-[#5f524c]">Totale prezzi</dt>
        <dd className="text-base font-semibold">{formatCents(totals.concordato)}</dd>
      </div>
      <div>
        <dt className="text-[#5f524c]">Ricevuto</dt>
        <dd className="text-base font-semibold">{formatCents(totals.ricevuto)}</dd>
      </div>
      <div>
        <dt className="text-[#5f524c]">Mancano</dt>
        <dd className="text-base font-semibold text-[#a8583e]">{formatCents(totals.daPagare)}</dd>
      </div>
      {totals.eccedenze > 0 || totals.pagatoCancellate !== 0 || totals.senzaQuota > 0 ? (
        <div className="col-span-3 space-y-0.5 border-t border-[#211815]/10 pt-2 text-[#5f524c]">
          {totals.eccedenze > 0 ? <p>Pagato in più: {formatCents(totals.eccedenze)}.</p> : null}
          {totals.pagatoCancellate !== 0 ? <p>Pagato da chi ha cancellato: {formatCents(totals.pagatoCancellate)}.</p> : null}
          {totals.senzaQuota > 0 ? (
            <p>{totals.senzaQuota === 1 ? "1 iscrizione senza prezzo non è contata." : `${totals.senzaQuota} iscrizioni senza prezzo non sono contate.`}</p>
          ) : null}
        </div>
      ) : null}
    </dl>
  );
}
