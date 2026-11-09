"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PeonyAttendee, PeonyMembership } from "@/lib/gestionale/server/peony-events";
import { PeonyPartnerFinder } from "@/components/gestionale/PeonyPartnerFinder";
import { AssociationStatusDot, type AssociationDotStatus } from "@/components/gestionale/AssociationStatusDot";
import type { PeonyEmailSend } from "@/lib/gestionale/server/peony-email";
import {
  PEONY_EMAIL_KINDS, buildPeonyEmailHtml,
  type PeonyEmailKind, type PeonyEmailTemplate,
} from "@/lib/gestionale/peony-email-html";
import { markPeonyEmailSent, savePeonyEmailTemplate } from "@/app/gestione/(app)/peony/actions";

type Tab = "partecipanti" | "email";
type TicketFilter = "all" | "practitioner" | "observer" | "unknown";
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

function peonyStatus(info:PeonyMembership|null,required:boolean):AssociationDotStatus{
  if(!required)return "not_required";
  if(!info)return "unknown";
  return info.status==="valid"?"verified":
    info.status==="payment_missing"?"payment_missing":"missing_form";
}


function formatMembershipDate(value: string): string {
  const parts = value.slice(0, 10).split("-");
  return parts.length === 3 ? parts[2] + "/" + parts[1] + "/" + parts[0] : value;
}

/** I dati tecnici restano disponibili a richiesta, senza ripetere il badge. */
function MembershipFacts({ info, ownerLabel }: { info: PeonyMembership | null; ownerLabel: string }) {
  if (!info) return null;
  const matchLabel = info.matchMethod === "email" ? "email" :
    info.matchMethod === "name" ? "nome e cognome" :
    info.matchMethod === "payment_email" ? "email pagamento" :
    info.matchMethod === "manual" ? "manuale" : "non disponibile";
  return (
    <div className="space-y-1 text-sm">
      {info.expiresAt ? (
        <p className="text-[#5f524c]">Tessera fino al {formatMembershipDate(info.expiresAt)}</p>
      ) : null}
      <details className="text-xs text-[#5f524c]">
        <summary className="w-fit cursor-pointer break-words py-1 text-[#a8583e]">Dettagli associazione · {ownerLabel}</summary>
        <div className="space-y-0.5 pt-1">
          <p>Modulo: {info.formPresent ? "trovato" : "assente"}</p>
          <p>Quota: {info.feePaid ? "verificata" : "non verificata"}</p>
          <p>Abbinamento: {matchLabel}</p>
        </div>
      </details>
    </div>
  );
}

function PersonRow({ person, eventId }: { person: PeonyAttendee; eventId: string }) {
  const [expanded,setExpanded]=useState(false);
  const roleLabel=person.freeEvent?"Ingresso libero":person.ticketRole==="observer"?"Observer":person.ticketRole==="practitioner"?"Praticante":"Tipo da identificare";
  const partnerLabel=person.partner?.name||person.partner?.email||"Partner da indicare";
  return (
    <li className="rounded-xl border border-[#211815]/10 bg-white/80 px-3 py-2.5">
      <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}
        className="flex min-h-10 w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <AssociationStatusDot status={peonyStatus(person.association,person.associationRequired)}/>
            <span className="min-w-0 break-words">{person.name}</span>
            {person.partnerRequired && person.partner ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 font-normal">
                + <AssociationStatusDot status={peonyStatus(person.partner.membership,true)}/>
                <span className="break-words">{partnerLabel}</span>
              </span>
            ) : person.partnerRequired ? <span className="font-normal"> + {partnerLabel}</span> : null}
          </span>
          <span className="block text-xs text-[#5f524c]">
            {roleLabel}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-[#a8583e]">{expanded?"−":"+"}</span>
      </button>
      {expanded?(
        <div className="mt-2 space-y-2 border-t border-[#211815]/10 pt-2 text-sm">
          <div>
            <p className="text-xs font-semibold text-[#5f524c]">Intestatario · {person.name}</p>
            {person.email?<a href={"mailto:"+person.email} className="block break-all text-sm text-[#a8583e] underline">{person.email}</a>:null}
            {person.associationRequired
              ? <MembershipFacts info={person.association} ownerLabel={person.name}/>
              : <p className="text-xs text-[#5f524c]">Tessera associativa non richiesta per questo evento.</p>}
            {person.holderMatch ? (
              <p className="mt-1 break-words text-xs text-[#5f524c]">
                Associato a: {person.holderMatch.name}
                {person.holderMatch.email ? ` · ${person.holderMatch.email}` : ""}
              </p>
            ):null}
            <PeonyPartnerFinder role="holder" eventId={eventId}
              ticketId={person.ticketId} hasPartner={Boolean(person.holderMatch)} />
          </div>
          {person.partnerRequired?(
            <div className="space-y-1 border-t border-[#211815]/10 pt-2">
              <p className="text-xs font-semibold text-[#5f524c]">Partner: {partnerLabel}</p>
              {person.partner?.email?<p className="break-all text-xs text-[#5f524c]">{person.partner.email}</p>:null}
              {person.partner?<MembershipFacts info={person.partner.membership} ownerLabel={`Partner: ${partnerLabel}`}/>:null}
              <PeonyPartnerFinder eventId={eventId} ticketId={person.ticketId} hasPartner={Boolean(person.partner)}/>
            </div>
          ):null}
          {person.notes?<p className="text-sm"><strong>Nota:</strong> {person.notes}</p>:null}
          {person.linkedPersonId?(
            <a href={"/gestione/p/"+person.linkedPersonId}
              className="inline-block text-sm font-semibold text-[#a8583e] underline">Apri anagrafica</a>
          ):null}
          <details className="text-xs text-[#5f524c]">
            <summary className="w-fit cursor-pointer py-1 text-[#a8583e]">Dati biglietto</summary>
            <p>Ordine: {person.orderId||"non disponibile"}</p>
            {person.ticketType?<p>Tipo: {person.ticketType}</p>:null}
            {person.partner?<p>Partner indicato {person.partner.source==="gestionale"?"nel gestionale":person.partner.source==="ticket_tailor"?"in Ticket Tailor":person.partner.source==="admin"?"in Admin":"dal partecipante"}</p>:null}
          </details>
        </div>
      ):null}
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
  const [ticketFilter,setTicketFilter]=useState<TicketFilter>("all");
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
    (ticketFilter==="all"||person.ticketRole===ticketFilter) &&
    [person.name, person.email, person.ticketType, person.orderId, person.partner?.name, person.partner?.email]
      .some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const observers=attendees.filter(person=>person.ticketRole==="observer").length;
  const practitioners=attendees.filter(person=>person.ticketRole==="practitioner").length;
  const unknownTypes=attendees.length-observers-practitioners;
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Gestione evento">
        {(["partecipanti", "email"] as const).map((name) => (
          <button type="button" key={name} role="tab" aria-selected={tab === name}
            onClick={() => { setTab(name); setMessage(null); setFailure(null); }}
            className={`h-10 rounded-xl px-2 text-sm font-semibold ${tab === name ? "bg-[#a8583e] text-white" : "bg-white/75"}`}>
            {name === "partecipanti" ? "Partecipanti" : "Email"}
          </button>
        ))}
      </div>
      {message ? <p role="status" className="text-sm font-semibold text-[#326941]">{message}</p> : null}
      {failure ? <p role="alert" className="text-sm font-semibold text-[#9b2c2c]">{failure}</p> : null}

      {tab === "partecipanti" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span><strong>{attendees.length}</strong> iscritti</span>
            <span>{practitioners} praticanti · {observers} observer</span>
            {unknownTypes>0?<span className="font-semibold text-[#9b4b1e]">{unknownTypes} tipi da identificare</span>:null}
            {formToCheck > 0 ? <span className="font-semibold text-[#9b4b1e]">{formToCheck} associazioni da verificare</span> : null}
            {partnerToCheck > 0 ? <span className="font-semibold text-[#9b4b1e]">{partnerToCheck} partner da verificare</span> : null}
          </div>
          {stale ? (
            <p className="text-xs text-[#9b4b1e]">
              Biglietti non aggiornati · usa «Sincronizza Ticket Tailor» qui sopra
            </p>
          ) : null}
          <details className="text-xs text-[#5f524c]">
            <summary className="w-fit cursor-pointer py-1 text-[#a8583e]">Ultimi aggiornamenti</summary>
            <p>Biglietti: {formattedSync(ticketsLastSyncedAt)}</p>
            <p>Associazione: {formattedSync(associationLastSyncedAt)}</p>
            <p>Le verifiche associative derivano dai dati salvati; controlla TeamArtist per le conferme recenti.</p>
          </details>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="peony-ticket-role-filter" className="text-[#5f524c]">Biglietti</label>
            <select id="peony-ticket-role-filter" value={ticketFilter} onChange={event=>setTicketFilter(event.target.value as TicketFilter)}
              className="min-h-10 flex-1 rounded-xl border border-[#211815]/15 bg-white px-3">
              <option value="all">Tutti ({attendees.length})</option>
              <option value="practitioner">Praticanti ({practitioners})</option>
              <option value="observer">Observer ({observers})</option>
              {unknownTypes>0?<option value="unknown">Tipo mancante ({unknownTypes})</option>:null}
            </select>
          </div>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca nome o partner" aria-label="Cerca partecipanti e partner"
            className="h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm" />
          {visible.length === 0 ? <p className={card}>Nessun partecipante nei dati sincronizzati.</p> : null}
          <ul className="space-y-1.5">{visible.map(person => <PersonRow key={person.ticketId} person={person} eventId={eventId} />)}</ul>
        </section>
      ) : (
        <section className="space-y-3">
          <div>
            <select id="peony-kind" aria-label="Tipo di email" value={kind}
              onChange={(event) => switchKind(event.target.value as PeonyEmailKind)}
              className="h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-2 text-sm">
              {PEONY_EMAIL_KINDS.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div className={card}>
            <label htmlFor="peony-subject" className="block text-sm font-semibold">Oggetto</label>
            <input id="peony-subject" value={template.subject} maxLength={300}
              onChange={e => setTemplateField("subject",e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#211815]/15 bg-white p-2 text-sm" />
            <label htmlFor="peony-body" className="mt-3 block text-sm font-semibold">Contenuto</label>
            <textarea id="peony-body" rows={7} value={template.body} maxLength={30000}
              onChange={e => setTemplateField("body",e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#211815]/15 bg-white p-3 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={button} disabled={busy || !template.subject.trim()}
                onClick={() => run(() => savePeonyEmailTemplate(eventId, kind, template.subject, template.body), "Testo salvato per questa comunicazione.")}>Salva</button>
              <button type="button" className="h-10 rounded-xl border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e]"
                onClick={async () => {
                  try { await copyRichHtml(html); setMessage("Email HTML copiata: puoi incollarla in Gmail."); setFailure(null); }
                  catch { setFailure("Impossibile copiare l'HTML formattato. Verifica gli appunti del browser."); }
                }}>Copia per Gmail</button>
            </div>
            <details className="mt-3 border-t border-[#211815]/10 pt-2">
              <summary className="w-fit cursor-pointer text-sm font-semibold text-[#a8583e]">Anteprima HTML</summary>
              <div className="mt-2 space-y-2">
                <iframe title="Anteprima email Peony Studio" sandbox="" srcDoc={html}
                  className="h-[360px] w-full rounded-xl border border-[#211815]/15 bg-white" />
                <button type="button" onClick={() => copy(html, "Codice HTML copiato.")}
                  className="h-9 rounded-xl border border-[#211815]/20 px-3 text-sm">Copia codice</button>
              </div>
            </details>
          </div>
          <div className={card}>
            <h3 className="text-sm font-semibold">Destinatari · {distinctEmails.length}</h3>
            <details className="mt-2">
              <summary className="w-fit cursor-pointer py-1 text-sm text-[#a8583e]">Modifica selezione ({selected.length}/{eligible.length})</summary>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checked.length === eligible.length && eligible.length > 0}
                  onChange={e => setChecked(e.target.checked ? eligible.map(p => p.ticketId) : [])} />
                Tutti
              </label>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {attendees.map(person => (
                  <label key={person.ticketId} className="flex items-start gap-2 border-b border-[#211815]/10 pb-2 text-sm">
                    <input type="checkbox" disabled={!person.email} checked={checked.includes(person.ticketId)}
                      onChange={e => setChecked(prev => e.target.checked ? [...prev,person.ticketId] : prev.filter(id => id !== person.ticketId))}
                      className="mt-1" />
                    <span className="min-w-0 flex-1">
                      {person.name}<span className="block break-words text-xs text-[#5f524c]">{person.email || "Senza email"}</span>
                      {latestSend.has(person.ticketId) ? (
                        <span className="block text-xs text-[#326941]">Inviata: {latestSend.get(person.ticketId)?.sentOn}</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </details>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={button} disabled={!distinctEmails.length}
                onClick={() => copy(distinctEmails.join(", "), "Indirizzi copiati per il Ccn di Gmail.")}>Copia indirizzi Ccn</button>
              {!confirmingSend ? (
                <button type="button" disabled={busy || !selected.length || !template.subject.trim()}
                  onClick={() => setConfirmingSend(true)}
                  className="h-10 rounded-xl border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e] disabled:opacity-50">
                  Registra invio
                </button>
              ) : null}
            </div>
            {confirmingSend ? (
              <div className="mt-3 rounded-xl bg-[#f2ede3] p-3">
                <p className="text-sm font-semibold">Email già inviata a {selected.length} iscritti?</p>
                <p className="mt-1 text-xs">Registra nello storico, senza inviare.</p>
                <div className="mt-2 flex gap-2">
                  <button className={button} disabled={busy} onClick={() => {
                    setConfirmingSend(false);
                    run(() => markPeonyEmailSent(eventId, selected.map(p => p.ticketId), kind, template.subject), "Invio registrato nello storico.");
                  }}>Conferma</button>
                  <button className="h-10 rounded-xl border border-[#211815]/15 px-3 text-sm" onClick={() => setConfirmingSend(false)}>Annulla</button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
