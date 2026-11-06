"use client";

// 4d, parte B + 4e (#12, D26): gruppi "Da contattare" e "Richiesta inviata".
// Caselle di spunta (tutte attive), poi "Copia email" nel formato per il Ccn
// di Gmail (indirizzi separati da virgola, senza doppioni, con l'elenco di chi
// non ha email) e "Registra come inviata (N)": entrambe valgono solo per le
// persone spuntate. "Da verificare nel libro soci" (non collegate) non ha
// richieste: prima si collegano.

import { useState, useTransition } from "react";

import { markGroupSentAction } from "@/app/gestione/(app)/w/contact-actions";
import { personNames } from "@/lib/gestionale/bookings";
import { bccList, isRequestGroup, type ContactGroup } from "@/lib/gestionale/contacts";
import type { BookingPersonView } from "@/lib/gestionale/types";

import { Notice, buttonClass, inputClass } from "./ui";

const GROUP_LABELS: Record<ContactGroup, string> = {
  da_contattare: "da contattare",
  richiesta_inviata: "con richiesta inviata",
  da_verificare: "da verificare nel libro soci",
};

export function ContactGroupTools({
  workshopId,
  group,
  people,
  includeInterested,
  today,
}: {
  workshopId: string;
  group: ContactGroup;
  people: BookingPersonView[];
  includeInterested: boolean;
  today: string;
}) {
  // Spunte: tutte attive; si tolgono quelle a cui non si scrive.
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<{ ids: string[]; manual: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [sentOn, setSentOn] = useState(today);

  if (people.length === 0) return null;

  if (!isRequestGroup(group)) {
    return (
      <div className="mt-3 rounded-xl bg-[#f2ede3] p-3 text-sm text-[#5f524c]">
        {people.length} {people.length === 1 ? "persona" : "persone"} {GROUP_LABELS[group]}: forse sono già socie. Prima collegale al libro soci
        (riga aperta → Cerca nel libro soci); niente richieste da qui.
      </div>
    );
  }

  const selected = people.filter((entry) => !unchecked.has(entry.person.id));
  const list = bccList(selected);

  function toggle(id: string, checked: boolean) {
    setCopied(null);
    setAsking(false);
    setUnchecked((current) => {
      const next = new Set(current);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copy() {
    setMessage(null);
    setAsking(false);
    const ids = list.withEmail.map((entry) => entry.person.id);
    try {
      await navigator.clipboard.writeText(list.text);
      setCopied({ ids, manual: false, text: list.text });
    } catch {
      // Appunti non disponibili: il testo resta da selezionare a mano.
      setCopied({ ids, manual: true, text: list.text });
    }
  }

  function markSent() {
    const personIds = list.withEmail.map((entry) => entry.person.id);
    if (personIds.length === 0) return;
    startTransition(async () => {
      const result = await markGroupSentAction({ workshopId, group, personIds, includeInterested, sentOn });
      setAsking(false);
      if (result.ok) {
        setCopied(null);
        setMessage({ tone: "success", text: `Registrato per ${result.data.count} ${result.data.count === 1 ? "persona" : "persone"}.` });
      } else setMessage({ tone: "error", text: result.error });
    });
  }

  const count = list.withEmail.length;

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#f2ede3] p-3 text-sm">
      <p className="text-[#5f524c]">
        {people.length} {people.length === 1 ? "persona" : "persone"} {GROUP_LABELS[group]} · spuntate {selected.length}
      </p>
      <ul className="grid gap-x-4 sm:grid-cols-2">
        {people.map((entry) => (
          <li key={entry.person.id}>
            <label className="flex min-h-10 items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#a8583e]"
                checked={!unchecked.has(entry.person.id) && Boolean(entry.person.email)}
                disabled={!entry.person.email}
                onChange={(e) => toggle(entry.person.id, e.target.checked)}
              />
              <span className="font-medium">{personNames(entry).main}</span>
              {entry.person.email ? null : <span className="text-xs text-[#9b2c2c]">senza email</span>}
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass.secondary} onClick={copy} disabled={list.withEmail.length === 0}>
          Copia email ({list.withEmail.length})
        </button>
        <span className="text-[#5f524c]">per il Ccn di Gmail</span>
      </div>
      {list.withoutEmail.length > 0 ? (
        <p className="text-[#7a5212]">Senza email: {list.withoutEmail.map((entry) => personNames(entry).main).join(", ")}</p>
      ) : null}

      <div className="space-y-2">
        {copied ? (
          copied.manual ? (
            <textarea readOnly className={`${inputClass} min-h-16 py-2`} rows={2} value={copied.text} onFocus={(e) => e.currentTarget.select()} />
          ) : (
            <p className="text-[#2f5d3b]">Copiati {copied.ids.length} indirizzi.</p>
          )}
        ) : null}
          {asking ? (
            <div className="space-y-2">
              <p className="font-semibold">Hai inviato davvero la richiesta o il sollecito a {count} {count === 1 ? "persona" : "persone"}?</p>
              <label className="block text-sm font-medium">Data invio
                <input type="date" value={sentOn} onChange={(event) => setSentOn(event.target.value)} className={`${inputClass} mt-1 max-w-52`} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass.primary} disabled={pending || !sentOn} onClick={markSent}>
                  {pending ? "Salvataggio…" : "Conferma"}
                </button>
                <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => setAsking(false)} autoFocus>
                  Chiudi
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={buttonClass.primary} disabled={count === 0} onClick={() => setAsking(true)}>
              Sì, l’ho inviata a {count} {count === 1 ? "persona" : "persone"}
            </button>
          )}
        </div>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}
