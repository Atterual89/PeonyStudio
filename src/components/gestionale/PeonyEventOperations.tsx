"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PeonyAttendee, PeonyMembership } from "@/lib/gestionale/server/peony-events";
import type { PeonyEmailSend } from "@/lib/gestionale/server/peony-email";
import {
  PEONY_EMAIL_KINDS, buildPeonyEmailHtml,
  type PeonyEmailKind, type PeonyEmailTemplate,
} from "@/lib/gestionale/peony-email-html";
import { markPeonyEmailSent, savePeonyEmailTemplate } from "@/app/gestione/(app)/peony/actions";

type Tab = "partecipanti" | "email";
const card = "rounded-2xl border border-[#211815]/10 bg-white/75 p-3";
const button = "h-10 rounded-xl bg-[#a8583e] px-3 text-sm font-semibold text-white disabled:opacity-50";

function formattedSync(value: string | null): string {
  if (!value) return "non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome",
  }).format(date);
}

function MembershipBadge({ info, required }: { info: PeonyMembership | null; required: boolean }) {
  if (!required) return <span className="text-xs text-[#5f524c]">Associazione non richiesta (observer)</span>;
  if (!info) return <span className="text-xs font-semibold text-[#96641b]">Verifica non disponibile</span>;
  const label = info.status === "valid" ? "Quota verificata" :
    info.status === "payment_missing" ? "Quota da verificare" : "Modulo non trovato";
  return (
    <span className={`text-xs font-semibold ${info.status === "valid" ? "text-[#326941]" : "text-[#9b4b1e]"}`}>
      {label}
    </span>
  );
}

function MembershipDetails({ info, required }: { info: PeonyMembership | null; required: boolean }) {
  if (!required) return <p className="text-sm">Observer: associazione non obbligatoria per questo biglietto.</p>;
  if (!info) return <p className="text-sm">Nessuna verifica disponibile nei dati sincronizzati: consulta la pagina Admin.</p>;
  return (
    <div className="grid gap-1 text-sm">
      <p><strong>Modulo associativo:</strong> {info.formPresent ? "Trovato" : "Non trovato nei dati sincronizzati"}</p>
      <p><strong>Quota associativa:</strong> {info.feePaid ? "Verificata per il periodo dell'evento" : "Non verificata"}</p>
      <p><strong>Scadenza tessera:</strong> {info.expiresAt || "Da verificare"}</p>
      <p><strong>Corrispondenza:</strong> {info.matchMethod === "email" ? "Email" :
        info.matchMethod === "name" ? "Nome e cognome" :
        info.matchMethod === "manual" ? "Validazione manuale" : "Nessuna conferma"}</p>
    </div>
  );
}

function PersonRow({ person }: { person: PeonyAttendee }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className={card}>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}
        className="flex h-auto min-h-10 w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <strong className="block break-words text-sm">{person.name}</strong>
          <span className="block text-xs text-[#5f524c]">{person.ticketType || "Biglietto Ticket Tailor"}</span>
          <MembershipBadge info={person.association} required={person.associationRequired} />
          {person.partnerRequired ? (
            <span className="mt-1 block text-xs text-[#5f524c]">
              Partner: {person.partner?.name || person.partner?.email || "da comunicare"}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-[#a8583e]">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-[#211815]/10 pt-3">
          <div className="text-sm">
            <p><strong>Email:</strong> {person.email || "Non indicata"}</p>
            <p><strong>Ordine:</strong> {person.orderId || "Non disponibile"}</p>
            {person.notes ? <p><strong>Nota interna:</strong> {person.notes}</p> : null}
            {person.linkedPersonId ? (
              <a href={`/gestione/p/${person.linkedPersonId}`} className="mt-1 inline-block text-sm font-semibold text-[#a8583e] underline">
                Apri scheda anagrafica
              </a>
            ) : null}
          </div>
          <div className="rounded-xl bg-[#f2ede3] p-3">
            <h3 className="mb-2 text-sm font-bold">Iscrizione all'associazione</h3>
            <MembershipDetails info={person.association} required={person.associationRequired} />
          </div>
          {person.partnerRequired ? (
            <div className="rounded-xl bg-[#f2ede3] p-3">
              <h3 className="mb-2 text-sm font-bold">Partner</h3>
              {person.partner ? (
                <>
                  <p className="text-sm"><strong>Nome:</strong> {person.partner.name || "Da completare"}</p>
                  <p className="text-sm"><strong>Email:</strong> {person.partner.email || "Non indicata"}</p>
                  <p className="mb-2 text-xs text-[#5f524c]">
                    Origine: {person.partner.source === "ticket_tailor" ? "risposta all'ordine Ticket Tailor" :
                      person.partner.source === "admin" ? "confermata nella pagina Admin" : "indicata dal partecipante"}
                  </p>
                  <MembershipBadge info={person.partner.membership} required />
                  <div className="mt-2">
                    <MembershipDetails info={person.partner.membership} required />
                  </div>
                </>
              ) : <p className="text-sm font-semibold text-[#9b4b1e]">Dati partner mancanti: da richiedere o verificare nella Admin.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

async function copyRichHtml(html: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
  } else {
    await navigator.clipboard.writeText(html);
  }
}

function defaultRecipients(kind: PeonyEmailKind, attendees: PeonyAttendee[]): string[] {
  return attendees.filter((person) => {
    if (!person.email) return false;
    if (kind === "membership") return person.associationRequired && person.association?.status !== "valid";
    if (kind === "partner") return person.partnerRequired && (!person.partner || person.partner.membership?.status !== "valid");
    return true;
  }).map((person) => person.ticketId);
}

export function PeonyEventOperations({
  eventId, eventTitle, dateLabel, attendees,
  ticketsLastSyncedAt, associationLastSyncedAt, templates: initialTemplates, sends,
}: {
  eventId: string;
  eventTitle: string;
  dateLabel: string;
  attendees: PeonyAttendee[];
  ticketsLastSyncedAt: string | null;
  associationLastSyncedAt: string | null;
  templates: Record<PeonyEmailKind, PeonyEmailTemplate>;
  sends: PeonyEmailSend[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("partecipanti");
  const [kind, setKind] = useState<PeonyEmailKind>("membership");
  const [templates, setTemplates] = useState(initialTemplates);
  const [checked, setChecked] = useState<string[]>(() => defaultRecipients("membership", attendees));
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmingSend, setConfirmingSend] = useState(false);

  const template = templates[kind];
  const html = useMemo(() => buildPeonyEmailHtml({ kind, eventTitle, dateLabel, template }),
    [kind, eventTitle, dateLabel, template]);
  const eligible = attendees.filter((person) => Boolean(person.email));
  const selected = eligible.filter((person) => checked.includes(person.ticketId));
  const distinctEmails = [...new Set(selected.map((person) => person.email!.trim().toLowerCase()))];
  const latestSend = useMemo(() => {
    const items = new Map<string, PeonyEmailSend>();
    for (const item of sends.filter((item) => item.kind === kind)) {
      if (!items.has(item.ticketId)) items.set(item.ticketId, item);
    }
    return items;
  }, [kind, sends]);
  const visible = attendees.filter((person) =>
    [person.name, person.email, person.ticketType, person.orderId, person.partner?.name, person.partner?.email]
      .some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const formToCheck = attendees.filter((person) => person.associationRequired &&
    (!person.association || person.association.status !== "valid")).length;
  const partnerToCheck = attendees.filter((person) => person.partnerRequired &&
    (!person.partner || person.partner.membership?.status !== "valid")).length;
  const stale = !ticketsLastSyncedAt || Date.now() - new Date(ticketsLastSyncedAt).getTime() > 24 * 60 * 60 * 1000;

  function run(operation: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setFailure(null); setMessage(null);
    startTransition(async () => {
      try {
        const result = await operation();
        if (!result.ok) { setFailure(result.error || "Operazione non riuscita."); return; }
        setMessage(success);
        router.refresh();
      } catch { setFailure("Errore di collegamento. Riprova."); }
    });
  }

  async function copy(text: string, success: string) {
    try { await navigator.clipboard.writeText(text); setMessage(success); setFailure(null); }
    catch { setFailure("Impossibile copiare: verifica i permessi degli appunti."); }
  }

  function switchKind(next: PeonyEmailKind) {
    setKind(next);
    setChecked(defaultRecipients(next, attendees));
    setMessage(null); setFailure(null); setConfirmingSend(false);
  }
  function setTemplateField(key: "subject" | "body", value: string) {
    setTemplates((prev) => ({ ...prev, [kind]: { ...prev[kind], [key]: value } }));
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-semibold">{attendees.length} biglietti sincronizzati</p>
        <p className="mt-1 text-sm text-[#5f524c]">Iscrizioni da verificare: {formToCheck} · Partner da verificare: {partnerToCheck}</p>
        <p className="mt-2 text-xs text-[#5f524c]">Ultimo aggiornamento biglietti: {formattedSync(ticketsLastSyncedAt)}</p>
        <p className="text-xs text-[#5f524c]">Ultimo aggiornamento associazione: {formattedSync(associationLastSyncedAt)}</p>
        {stale ? (
          <div className="mt-3 rounded-xl border border-[#b17c30]/40 bg-[#f3e8d4] p-3">
            <p className="text-sm font-semibold">Attenzione: elenco Ticket Tailor potenzialmente non aggiornato</p>
            <p className="mt-1 text-xs">Il numero qui non è una conferma dei biglietti attuali. Aggiorna la sincronizzazione nella vecchia Admin.</p>
            <a href="https://peonystudio.net/admin/ticket-tailor" className="mt-2 inline-block text-sm font-semibold text-[#a8583e] underline">
              Apri Admin per sincronizzare
            </a>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Gestione evento">
        {(["partecipanti", "email"] as const).map((name) => (
          <button type="button" key={name} role="tab" aria-selected={tab === name}
            onClick={() => { setTab(name); setMessage(null); setFailure(null); }}
            className={`h-10 rounded-xl px-2 text-sm font-semibold ${tab === name ? "bg-[#a8583e] text-white" : "bg-white/75"}`}>
            {name === "partecipanti" ? "Associazione e partner" : "Email HTML"}
          </button>
        ))}
      </div>
      {message ? <p role="status" className="text-sm font-semibold text-[#326941]">{message}</p> : null}
      {failure ? <p role="alert" className="text-sm font-semibold text-[#9b2c2c]">{failure}</p> : null}

      {tab === "partecipanti" ? (
        <section className="space-y-3">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca partecipante o partner" aria-label="Cerca partecipanti e partner"
            className="h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm" />
          <p className="text-xs text-[#5f524c]">Tocca il nome per visualizzare modulo, quota, scadenza e partner. Le presenze si gestiscono nell'app Ticket Tailor.</p>
          {visible.length === 0 ? <p className={card}>Nessun partecipante nei dati sincronizzati.</p> : null}
          <ul className="space-y-2">{visible.map(person => <PersonRow key={person.ticketId} person={person} />)}</ul>
          <p className="text-xs text-[#5f524c]">Le verifiche si basano sui dati associativi sincronizzati. Per correggere o confermare manualmente una registrazione usa la vecchia Admin.</p>
        </section>
      ) : (
        <section className="space-y-4">
          <div className={card}>
            <p className="text-sm font-semibold">Tipo di comunicazione</p>
            <div className="mt-2 grid gap-2">
              {PEONY_EMAIL_KINDS.map(({id,label}) => (
                <button key={id} type="button" onClick={() => switchKind(id)}
                  aria-current={kind === id ? "true" : undefined}
                  className={`h-10 rounded-xl border px-3 text-left text-sm font-semibold ${
                    kind === id ? "border-[#a8583e] bg-[#a8583e] text-white" : "border-[#211815]/15 bg-white"
                  }`}>{label}</button>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#5f524c]">
              I destinatari vengono proposti in base al tipo di comunicazione; puoi modificarli prima di copiare gli indirizzi.
            </p>
          </div>
          <div className={card}>
            <label htmlFor="peony-subject" className="block text-sm font-semibold">Oggetto</label>
            <input id="peony-subject" value={template.subject} maxLength={300}
              onChange={e => setTemplateField("subject",e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#211815]/15 bg-white p-2 text-sm" />
            <label htmlFor="peony-body" className="mt-3 block text-sm font-semibold">Contenuto</label>
            <textarea id="peony-body" rows={10} value={template.body} maxLength={30000}
              onChange={e => setTemplateField("body",e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#211815]/15 bg-white p-3 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={button} disabled={busy || !template.subject.trim()}
                onClick={() => run(() => savePeonyEmailTemplate(eventId, kind, template.subject, template.body), "Testo salvato per questa comunicazione.")}>Salva modello</button>
              <button type="button" className="h-10 rounded-xl border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e]"
                onClick={async () => {
                  try { await copyRichHtml(html); setMessage("Email HTML copiata: puoi incollarla in Gmail."); setFailure(null); }
                  catch { setFailure("Impossibile copiare l'HTML formattato. Verifica gli appunti del browser."); }
                }}>Copia email per Gmail</button>
              <button type="button" onClick={() => copy(html, "Codice HTML copiato.")}
                className="h-10 rounded-xl border border-[#211815]/20 px-3 text-sm">Copia codice HTML</button>
            </div>
            <h3 className="mt-5 text-sm font-bold">Anteprima HTML</h3>
            <iframe title="Anteprima email Peony Studio" sandbox="" srcDoc={html}
              className="mt-2 h-[420px] w-full rounded-xl border border-[#211815]/15 bg-white" />
          </div>
          <div className={card}>
            <h3 className="font-semibold">Destinatari — {selected.length} biglietti / {distinctEmails.length} email uniche</h3>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={checked.length === eligible.length && eligible.length > 0}
                onChange={e => setChecked(e.target.checked ? eligible.map(p => p.ticketId) : [])} />
              Seleziona tutti con email
            </label>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {attendees.map(person => (
                <label key={person.ticketId} className="flex items-start gap-2 border-b border-[#211815]/10 pb-2 text-sm">
                  <input type="checkbox" disabled={!person.email} checked={checked.includes(person.ticketId)}
                    onChange={e => setChecked(prev => e.target.checked ? [...prev,person.ticketId] : prev.filter(id => id !== person.ticketId))}
                    className="mt-1" />
                  <span className="min-w-0 flex-1">
                    {person.name}<span className="block break-words text-xs text-[#5f524c]">{person.email || "Senza email"}</span>
                    {latestSend.has(person.ticketId) ? (
                      <span className="block text-xs text-[#326941]">Ultimo invio registrato: {latestSend.get(person.ticketId)?.sentOn}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={button} disabled={!distinctEmails.length}
                onClick={() => copy(distinctEmails.join(", "), "Indirizzi copiati per il Ccn di Gmail.")}>Copia indirizzi Ccn</button>
              {!confirmingSend ? (
                <button type="button" disabled={busy || !selected.length || !template.subject.trim()}
                  onClick={() => setConfirmingSend(true)}
                  className="h-10 rounded-xl border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e] disabled:opacity-50">
                  Registra invio effettuato
                </button>
              ) : null}
            </div>
            {confirmingSend ? (
              <div className="mt-3 rounded-xl bg-[#f2ede3] p-3">
                <p className="text-sm font-semibold">Hai già inviato questa email a {selected.length} biglietti selezionati?</p>
                <p className="mt-1 text-xs">La registrazione non spedisce alcun messaggio.</p>
                <div className="mt-2 flex gap-2">
                  <button className={button} disabled={busy} onClick={() => {
                    setConfirmingSend(false);
                    run(() => markPeonyEmailSent(eventId, selected.map(p => p.ticketId), kind, template.subject), "Invio registrato nello storico.");
                  }}>Conferma</button>
                  <button className="h-10 rounded-xl border border-[#211815]/15 px-3 text-sm" onClick={() => setConfirmingSend(false)}>Annulla</button>
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-[#5f524c]">L'invio avviene da Gmail, non da questa pagina. Segna come inviata soltanto dopo l'invio effettivo.</p>
          </div>
        </section>
      )}
    </div>
  );
}
