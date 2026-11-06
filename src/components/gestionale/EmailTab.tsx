"use client";

// D27 (Fase 5): tab Email del workshop, solo admin. Una riga per persona: i
// confermati (Acconto pagato o Saldato) sono già selezionati; interessati e
// prenotati a parola sono in grigio e si possono aggiungere. "Copia email (N)"
// copia gli indirizzi per il Ccn di Gmail; se gli appunti non sono disponibili
// il testo resta da selezionare a mano.

import Link from "next/link";
import { useState } from "react";

import { defaultEmailSelection, emailText, type EmailRow } from "@/lib/gestionale/email-list";
import { peopleInGroup } from "@/lib/gestionale/contacts";
import type { BookingView } from "@/lib/gestionale/types";
import { ContactGroupTools } from "./ContactGroupTools";
import { BOOKING_STATUS_LABELS } from "@/lib/gestionale/labels";

import { Notice, buttonClass, cardClass, inputClass } from "./ui";

export function EmailTab({ rows, bookings, workshopId, today }: { rows: EmailRow[]; bookings: BookingView[]; workshopId: string; today: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => defaultEmailSelection(rows));
  const [copied, setCopied] = useState<{ count: number; text: string; manual: boolean } | null>(null);
  const { text, count } = emailText(rows, selected);
  const withoutEmail = rows.filter((row) => !row.email);
  const firstRequests = peopleInGroup(bookings, "da_contattare");
  const reminders = peopleInGroup(bookings, "richiesta_inviata");
  const unlinked = peopleInGroup(bookings, "da_verificare");

  function toggle(personId: string, checked: boolean) {
    setCopied(null);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(personId);
      else next.delete(personId);
      return next;
    });
  }

  async function copy() {
    let manual = false;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      manual = true;
    }
    setCopied({ count, text, manual });
  }

  if (rows.length === 0 && firstRequests.length === 0 && reminders.length === 0) return <p className="text-sm text-[#5f524c]">Nessuna comunicazione da preparare per questo workshop.</p>;

  return (
    <div className="max-w-2xl space-y-3">
      <div>
        <h2 className="text-base font-semibold">Comunicazioni associative</h2>
        <p className="mt-1 text-sm text-[#5f524c]">Il sistema propone le persone da contattare. La copia degli indirizzi e la registrazione dell’invio sono due azioni separate.</p>
      </div>
      <details className={`${cardClass} p-3`} defaultOpen={firstRequests.some((p) => Boolean(p.person.email))}>
        <summary className="min-h-10 cursor-pointer font-semibold">1 · Richiesta di associazione — {firstRequests.length} persone</summary>
        <ContactGroupTools key="request" workshopId={workshopId} group="da_contattare" people={firstRequests} includeInterested={false} today={today} />
      </details>
      <details className={`${cardClass} p-3`}>
        <summary className="min-h-10 cursor-pointer font-semibold">2 · Solleciti associazione — {reminders.length} persone</summary>
        <ContactGroupTools key="reminder" workshopId={workshopId} group="richiesta_inviata" people={reminders} includeInterested={false} today={today} />
      </details>
      {unlinked.length ? (
        <p className="rounded-lg bg-[#fdf3e1] p-3 text-sm text-[#7a5212]">{unlinked.length} persone da verificare nel libro soci: non vengono proposte per le richieste fino al collegamento.</p>
      ) : null}
      <details className={`${cardClass} p-3`}>
        <summary className="min-h-10 cursor-pointer font-semibold">3 · Indirizzi per comunicazioni generali — {count} selezionati</summary>
        <div className="pt-2">
      <h2 className="text-base font-semibold">1. Destinatari</h2>
      <p className="mt-1 text-sm text-[#5f524c]">
        Proposti automaticamente i partecipanti con acconto pagato o saldato. Puoi includere altre persone prima di copiare gli indirizzi.
      </p>

      <details className={`${cardClass} mt-3`}>
        <summary className="min-h-12 cursor-pointer p-3 text-sm font-semibold">
          Cambia destinatari · {count} selezionati
        </summary>
        <ul className="divide-y divide-[#211815]/5 border-t border-[#211815]/10">
        {rows.map((row) => (
          <li key={row.personId} className={row.confirmed ? "" : "text-[#5f524c]"}>
            <label className={`flex min-h-10 items-start gap-3 px-3 py-2 ${row.email ? "cursor-pointer" : ""}`}>
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#a8583e]"
                checked={selected.has(row.personId)}
                disabled={!row.email}
                onChange={(e) => toggle(row.personId, e.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className={`block break-words ${row.confirmed ? "font-semibold" : ""}`}>
                  {row.name}
                  {row.alias ? <span className="ml-2 text-sm font-normal text-[#5f524c]">{row.alias}</span> : null}
                </span>
                <span className="block break-all text-sm">{row.email ?? <span className="font-medium text-[#9b2c2c]">manca l&apos;email</span>}</span>
                <span className="block text-xs">{BOOKING_STATUS_LABELS[row.status]}</span>
              </span>
            </label>
            {row.email ? null : (
              <Link prefetch={false} href={`/gestione/p/${row.personId}`} className="ml-11 inline-flex min-h-10 items-center text-sm underline">
                Completa la scheda
              </Link>
            )}
          </li>
        ))}
        </ul>
      </details>

      {/* In basso, vicino al pollice. */}
      <div className="sticky bottom-20 z-10 mt-3 space-y-2 rounded-xl bg-[#f2ede3]/95 py-2 backdrop-blur">
        {copied ? (
          copied.manual ? (
            <div className="space-y-2">
              <Notice tone="warning">Copia non riuscita: seleziona il testo e copialo a mano.</Notice>
              <textarea readOnly className={`${inputClass} h-24`} value={copied.text} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : (
            <Notice tone="success">
              {copied.count === 1 ? "Copiata 1 email" : `Copiate ${copied.count} email`}: incolla nel campo Ccn di Gmail.
            </Notice>
          )
        ) : null}
        <h2 className="text-base font-semibold">2. Copia indirizzi per Gmail</h2>
        <button type="button" className={`${buttonClass.primary} w-full sm:w-auto`} disabled={count === 0} onClick={copy}>
          Copia {count} indirizzi → campo Ccn
        </button>
        <p className="text-xs text-[#5f524c]">Questo pulsante copia soltanto gli indirizzi. La copia non registra alcun invio. Dopo aver incollato in Gmail, verifica sempre i destinatari.</p>
        {withoutEmail.length > 0 ? (
          <p className="text-sm text-[#9b2c2c]">
            {withoutEmail.length === 1 ? "1 persona senza email" : `${withoutEmail.length} persone senza email`}
          </p>
        ) : null}
      </div>
        </div>
      </details>
    </div>
  );
}
