"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PeonyAttendee } from "@/lib/gestionale/server/peony-events";
import type { PeonyEmailSend, PeonyEmailTemplate } from "@/lib/gestionale/server/peony-email";
import {
  markPeonyEmailSent,
  savePeonyEmailTemplate,
  setPeonyPresence,
} from "@/app/gestione/(app)/peony/actions";

type Tab = "partecipanti" | "email";
const card = "rounded-2xl border border-[#211815]/10 bg-white/75 p-4";
const button = "min-h-11 rounded-xl bg-[#a8583e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

function htmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailHtml(subject: string, body: string): string {
  const formatted = body.split(/\r?\n/).map((line) => htmlEscape(line)).join("<br>");
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"></head><body style="margin:0;background:#f2ede3;padding:28px 12px;font-family:Arial,sans-serif;color:#211815"><div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:32px"><p style="color:#a8583e;font-size:13px;font-weight:bold;letter-spacing:2px">PEONY STUDIO</p><h1 style="font-size:24px;font-weight:500">${htmlEscape(subject)}</h1><div style="font-size:16px;line-height:1.7">${formatted}</div></div></body></html>`;
}

async function copyRichHtml(html: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
  } else {
    // Dove la copia HTML non e' disponibile, copia comunque il sorgente.
    await navigator.clipboard.writeText(html);
  }
}

export function PeonyEventOperations({
  eventId,
  attendees,
  initialTemplate,
  sends,
}: {
  eventId: string;
  attendees: PeonyAttendee[];
  initialTemplate: PeonyEmailTemplate;
  sends: PeonyEmailSend[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("partecipanti");
  const [subject, setSubject] = useState(initialTemplate.subject);
  const [body, setBody] = useState(initialTemplate.body);
  const [checked, setChecked] = useState<string[]>(() =>
    attendees.filter((a) => Boolean(a.email)).map((a) => a.ticketId),
  );
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const eligible = useMemo(() => attendees.filter((a) => Boolean(a.email)), [attendees]);
  const selected = eligible.filter((a) => checked.includes(a.ticketId));
  const distinctEmails = [...new Set(selected.map((a) => a.email!.trim().toLowerCase()))];
  const latestSend = useMemo(() => {
    const result = new Map<string, PeonyEmailSend>();
    for (const item of sends) {
      if (!result.has(item.ticketId)) result.set(item.ticketId, item);
    }
    return result;
  }, [sends]);
  const visible = attendees.filter((a) =>
    [a.name, a.email, a.ticketType, a.orderId].some((v) => v?.toLowerCase().includes(search.toLowerCase().trim())),
  );
  const presentCount = attendees.filter((a) => a.present).length;

  function run(operation: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setMessage(null);
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await operation();
        if (!result.ok) {
          setFailure(result.error ?? "Operazione non riuscita.");
          return;
        }
        setMessage(success);
        router.refresh();
      } catch {
        setFailure("Errore di collegamento. Riprova.");
      }
    });
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(label);
      setFailure(null);
    } catch {
      setFailure("Impossibile copiare automaticamente. Usa il browser in HTTPS.");
    }
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-semibold">Biglietti validi: {attendees.length}</p>
        <p className="mt-1 text-sm text-[#5f524c]">Presenze: {presentCount} · Email disponibili: {eligible.length}</p>
        <p className="mt-2 text-xs text-[#5f524c]">
          Le iscrizioni e le cancellazioni si gestiscono soltanto in Ticket Tailor.
          I dati dei biglietti non possono essere modificati da qui.
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Gestione evento">
        {(["partecipanti", "email"] as const).map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} onClick={() => { setTab(name); setMessage(null); setFailure(null); }}
            className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold ${tab === name ? "bg-[#a8583e] text-white" : "bg-white/75 text-[#211815]"}`}>
            {name === "partecipanti" ? "Partecipanti e presenze" : "Email"}
          </button>
        ))}
      </div>

      {message ? <p role="status" className="text-sm font-semibold text-[#3c6b49]">{message}</p> : null}
      {failure ? <p role="alert" className="text-sm font-semibold text-[#9b2c2c]">{failure}</p> : null}

      {tab === "partecipanti" ? (
        <section className="space-y-3">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca nome, email, biglietto" aria-label="Cerca tra i partecipanti"
            className="min-h-12 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm" />
          <p className="text-xs text-[#5f524c]">La presenza impostata da Peony resta salvata anche dopo la sincronizzazione Ticket Tailor.</p>
          {visible.length === 0 ? <p className={card}>Nessun partecipante trovato. Se mancano iscritti, verifica la sincronizzazione Ticket Tailor nella vecchia pagina Admin.</p> : null}
          <ul className="space-y-2">
            {visible.map((person) => (
              <li key={person.ticketId} className={card}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={person.present} disabled={busy}
                    onChange={(event) =>
                      run(() => setPeonyPresence(eventId, person.ticketId, event.target.checked), "Presenza aggiornata.")
                    }
                    className="mt-1 h-5 w-5 accent-[#a8583e]" />
                  <span className="min-w-0 flex-1">
                    <strong className="block break-words text-sm">{person.name}</strong>
                    <span className="block break-words text-xs text-[#5f524c]">{person.email || "Email non disponibile"}</span>
                    {person.ticketType ? <span className="mt-1 block text-xs text-[#5f524c]">Biglietto: {person.ticketType}</span> : null}
                    {person.present ? <span className="mt-1 block text-xs text-[#3c6b49]">
                      Presente {person.checkedInVia === "ticket_tailor" ? "(Ticket Tailor)" : "(Peony)"}
                    </span> : null}
                    {person.notes ? <span className="mt-1 block text-xs text-[#5f524c]">Nota: {person.notes}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-4">
          <div className={card}>
            <h2 className="font-serif text-xl font-semibold">Testo email dell'evento</h2>
            <p className="mt-1 text-xs text-[#5f524c]">Modello modificabile e salvato per questo evento. Non invia automaticamente alcuna email.</p>
            <label htmlFor="peony-subject" className="mt-4 block text-sm font-semibold">Oggetto</label>
            <input id="peony-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
              maxLength={300} className="mt-1 min-h-11 w-full rounded-lg border border-[#211815]/15 bg-white p-2 text-sm" />
            <label htmlFor="peony-body" className="mt-3 block text-sm font-semibold">Messaggio</label>
            <textarea id="peony-body" value={body} onChange={(e) => setBody(e.target.value)}
              rows={9} maxLength={30000} className="mt-1 w-full rounded-lg border border-[#211815]/15 bg-white p-3 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={button} type="button" disabled={busy || !subject.trim()}
                onClick={() => run(() => savePeonyEmailTemplate(eventId, subject, body), "Modello email salvato.")}>
                Salva testo
              </button>
              <button type="button" disabled={!body.trim()}
                onClick={async () => {
                  try {
                    await copyRichHtml(emailHtml(subject, body));
                    setMessage("Email formattata copiata. Incollala in Gmail.");
                    setFailure(null);
                  } catch {
                    setFailure("Non riesco a copiare la versione HTML. Verifica i permessi degli appunti.");
                  }
                }}
                className="min-h-11 rounded-xl border border-[#a8583e] px-4 text-sm font-semibold text-[#a8583e] disabled:opacity-50">
                Copia email per Gmail
              </button>
            </div>
          </div>

          <div className={card}>
            <h2 className="font-serif text-xl font-semibold">Destinatari</h2>
            <p className="mt-1 text-sm text-[#5f524c]">{selected.length} biglietti selezionati · {distinctEmails.length} indirizzi unici</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked.length === eligible.length && eligible.length > 0}
                onChange={(e) => setChecked(e.target.checked ? eligible.map((a) => a.ticketId) : [])}
                className="h-4 w-4 accent-[#a8583e]" />
              Seleziona tutti con email
            </label>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {attendees.map((person) => (
                <label key={person.ticketId} className="flex items-start gap-2 border-b border-[#211815]/5 pb-2 text-sm">
                  <input type="checkbox" disabled={!person.email} checked={checked.includes(person.ticketId)}
                    onChange={(e) => setChecked((prev) => e.target.checked
                      ? [...prev, person.ticketId]
                      : prev.filter((id) => id !== person.ticketId))}
                    className="mt-1 h-4 w-4 accent-[#a8583e]" />
                  <span className="min-w-0 flex-1 break-words">
                    {person.name}
                    <span className="block text-xs text-[#5f524c]">{person.email || "Senza email"}</span>
                    {latestSend.get(person.ticketId) ? <span className="block text-xs text-[#3c6b49]">
                      Ultimo invio registrato: {latestSend.get(person.ticketId)!.sentOn}
                    </span> : null}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={button} disabled={distinctEmails.length === 0}
                onClick={() => copy(distinctEmails.join(", "), "Indirizzi copiati per il campo Ccn di Gmail.")}>
                Copia indirizzi Ccn
              </button>
              <button type="button" disabled={busy || selected.length === 0 || !subject.trim()}
                onClick={() => {
                  if (window.confirm(`Confermi di aver già inviato questa email ai ${selected.length} biglietti selezionati? Questa azione registra l'invio, non spedisce messaggi.`)) {
                    run(() => markPeonyEmailSent(eventId, selected.map((a) => a.ticketId), subject), "Invii registrati nello storico.");
                  }
                }}
                className="min-h-11 rounded-xl border border-[#a8583e] px-4 text-sm font-semibold text-[#a8583e] disabled:opacity-50">
                Registra come inviata
              </button>
            </div>
            <p className="mt-3 text-xs text-[#5f524c]">Il sistema non invia email: copia gli indirizzi in Ccn e il testo formattato in Gmail. Registra l'invio solo dopo averlo realmente effettuato.</p>
          </div>
        </section>
      )}
    </div>
  );
}
