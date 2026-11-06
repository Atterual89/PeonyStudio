"use client";

// D27 (Fase 5): tab Email del workshop, solo admin. Una riga per persona: i
// confermati (Acconto pagato o Saldato) sono già selezionati; interessati e
// prenotati a parola sono in grigio e si possono aggiungere. "Copia email (N)"
// copia gli indirizzi per il Ccn di Gmail; se gli appunti non sono disponibili
// il testo resta da selezionare a mano.

import Link from "next/link";
import { useState } from "react";

import { defaultEmailSelection, emailText, type EmailRow } from "@/lib/gestionale/email-list";
import { BOOKING_STATUS_LABELS } from "@/lib/gestionale/labels";

import { Notice, buttonClass, cardClass, inputClass } from "./ui";

export function EmailTab({ rows }: { rows: EmailRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => defaultEmailSelection(rows));
  const [copied, setCopied] = useState<{ count: number; text: string; manual: boolean } | null>(null);
  const { text, count } = emailText(rows, selected);
  const withoutEmail = rows.filter((row) => !row.email);

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

  if (rows.length === 0) return <p className="text-sm text-[#5f524c]">Nessuna iscrizione con persone a cui scrivere.</p>;

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-[#5f524c]">
        Già selezionati i confermati (acconto pagato o saldato). Lista d&apos;attesa e cancellati non ci sono.
      </p>

      <ul className={`${cardClass} mt-3 divide-y divide-[#211815]/5`}>
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
              {copied.count === 1 ? "Copiata 1 email" : `Copiate ${copied.count} email`}: incolla nel nel campo Ccn di Gmail.
            </Notice>
          )
        ) : null}
        <button type="button" className={`${buttonClass.primary} w-full sm:w-auto`} disabled={count === 0} onClick={copy}>
          Copia email ({count})
        </button>
        {withoutEmail.length > 0 ? (
          <p className="text-sm text-[#9b2c2c]">
            {withoutEmail.length === 1 ? "1 persona senza email" : `${withoutEmail.length} persone senza email`}
          </p>
        ) : null}
      </div>
    </div>
  );
}
