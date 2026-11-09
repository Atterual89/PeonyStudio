"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PeonyAttendee, PeonyMembership } from "@/lib/gestionale/server/peony-events";
import { PeonyPartnerFinder } from "@/components/gestionale/PeonyPartnerFinder";
import { UnifiedParticipantCard } from "@/components/gestionale/UnifiedParticipantCard";
import { UnifiedPersonPanel } from "@/components/gestionale/UnifiedPersonPanel";
import { QuotaOkCheckbox } from "@/components/gestionale/QuotaOkCheckbox";
import { AssociationStatusDot, AssociationDotLegend, type AssociationDotStatus } from "@/components/gestionale/AssociationStatusDot";
import type { PeonyEmailSend } from "@/lib/gestionale/server/peony-email";
import {
  PEONY_EMAIL_KINDS, buildPeonyEmailHtml, defaultPeonyEmailTemplate, resolvePeonyTemplateText,
  type PeonyEmailKind, type PeonyEmailTemplate,
} from "@/lib/gestionale/peony-email-html";
import { isWorkshopEvent, peonyEmailLanguage, type PeonyEmailAudience, type PeonyEmailEventContext, type PeonyEmailLanguage } from "@/lib/gestionale/peony-email-context";
import { PEONY_DETAIL_FIELDS, type PeonyEmailDetailFields } from "@/lib/gestionale/peony-email-details";
import { markPeonyEmailSent, savePeonyEmailSettings, savePeonyEmailTemplate, setPeonyQuotaOkAction } from "@/app/gestione/(app)/peony/actions";

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
  if(info?.status==="valid")return "verified";
  if(!required)return "not_required";
  if(!info)return "unknown";
  return info.status==="payment_missing"?"payment_missing":"missing_form";
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
      <details className="text-xs text-[#5f524c]">
        <summary className="w-fit cursor-pointer break-words py-1 text-[#a8583e]">Dettagli associazione · {ownerLabel}</summary>
        <div className="space-y-0.5 pt-1">
          {info.status==="valid"&&info.expiresAt?<p>Tessera fino al {formatMembershipDate(info.expiresAt)}</p>:null}
          {info.verifiedInOfficialBook ? <p>Libro soci ufficiale: tessera verificata</p> : <>
            <p>Modulo: {info.formPresent ? "trovato" : "assente"}</p>
            <p>Quota: {info.feePaid ? "verificata" : "non verificata"}</p>
            <p>Abbinamento: {matchLabel}</p>
          </>}
        </div>
      </details>
    </div>
  );
}

function PersonRow({ person, eventId,initialExpanded=false }: { person: PeonyAttendee; eventId: string;initialExpanded?:boolean }) {
  const [expanded,setExpanded]=useState(initialExpanded);
  const roleLabel=person.freeEvent?"Ingresso libero":person.ticketRole==="observer"?"Observer":person.ticketRole==="practitioner"?"Praticante":"Tipo da identificare";
  const partnerLabel=person.partner?.name||person.partner?.email||"Partner da indicare";
  const ticketAlias=person.enteredName&&person.enteredName.trim()!==person.name.trim()?person.enteredName:null;
  const displayAlias=person.profileAlias||ticketAlias;
  const primaryEmail=person.linkedPersonId?person.profileEmail:person.email;
  const partnerEmail=person.partner?.linkedPersonId?person.partner.profileEmail:person.partner?.email;
  const date=person.createdAt?new Intl.DateTimeFormat("it-IT",{
    day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Rome",
  }).format(new Date(person.createdAt)):null;
  return <li>
    <UnifiedParticipantCard
      expanded={expanded} onToggle={()=>setExpanded(v=>!v)}
      primary={<span className="inline-flex flex-wrap items-center gap-2">
        <AssociationStatusDot status={peonyStatus(person.association,person.associationRequired)}/>
        <span>{person.name}</span>
        {displayAlias?<span className="text-xs font-normal text-[#5f524c]">{displayAlias}</span>:null}
        {person.partnerRequired&&<span className="inline-flex items-center gap-1.5 font-normal">
          <span>+</span>
          {person.partner&&<AssociationStatusDot status={peonyStatus(person.partner.membership,person.associationRequired)}/>}
          <span>{partnerLabel}</span>
        </span>}
      </span>}
      secondary={<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {date?<span>{date}</span>:null}
        <span>{roleLabel}</span>
      </span>}>
      <div className="space-y-2">
        <h3 className="text-base font-semibold">{person.partnerRequired?"Persone della coppia":"Partecipante"}</h3>
        <UnifiedPersonPanel role="holder"
          badge={<AssociationStatusDot status={peonyStatus(person.association,person.associationRequired)}/>}
          name={person.linkedPersonId
            ?<a href={"/gestione/p/"+person.linkedPersonId} className="underline-offset-2 hover:underline">{person.name}</a>
            :person.name}
          alias={displayAlias}
          email={primaryEmail} emailLabel={!person.linkedPersonId?"Biglietto:":undefined}>
          {person.associationRequired&&person.association?.matchMethod !== "payment_email"&&
            <QuotaOkCheckbox
              checked={Boolean(person.association?.feePaid||person.association?.verifiedInOfficialBook)}
              editable={!person.association?.verifiedInOfficialBook&&(!person.association?.feePaid||person.association.matchMethod==="manual")}
              onToggle={paid=>setPeonyQuotaOkAction({eventId,ticketId:person.ticketId,person:"holder",paid})}
            />}
          {person.associationRequired&&<MembershipFacts info={person.association} ownerLabel={person.name}/>}
          {!person.linkedPersonId?<p className="text-xs text-[#9b4b1e]">Anagrafica non ancora collegata</p>:null}
          <PeonyPartnerFinder role="holder" eventId={eventId} ticketId={person.ticketId}
            hasPartner={Boolean(person.linkedPersonId)} />
        </UnifiedPersonPanel>
        {person.partnerRequired&&(person.partner?
          <UnifiedPersonPanel role="partner"
            badge={<AssociationStatusDot status={peonyStatus(person.partner.membership,person.associationRequired)}/>}
            name={person.partner.linkedPersonId
              ?<a href={"/gestione/p/"+person.partner.linkedPersonId} className="underline-offset-2 hover:underline">{partnerLabel}</a>
              :partnerLabel}
            alias={person.partner.profileAlias||(person.partner.enteredName&&person.partner.enteredName!==partnerLabel?person.partner.enteredName:null)}
            email={partnerEmail} emailLabel={!person.partner.linkedPersonId?"Biglietto:":undefined}>
            {person.associationRequired&&person.partner.membership?.matchMethod !== "payment_email"&&
              <QuotaOkCheckbox checked={Boolean(person.partner.membership?.feePaid||person.partner.membership?.verifiedInOfficialBook)}
                editable={!person.partner.membership?.verifiedInOfficialBook&&(!person.partner.membership?.feePaid||person.partner.membership.matchMethod==="manual")}
                onToggle={paid=>setPeonyQuotaOkAction({eventId,ticketId:person.ticketId,person:"partner",paid})}/>}
            {person.associationRequired&&<MembershipFacts info={person.partner.membership} ownerLabel={partnerLabel}/>}
            <PeonyPartnerFinder eventId={eventId} ticketId={person.ticketId} hasPartner={true}/>
          </UnifiedPersonPanel>:
          <PeonyPartnerFinder eventId={eventId} ticketId={person.ticketId} hasPartner={false}/>
        )}
        {person.notes?<p className="text-sm"><strong>Nota:</strong> {person.notes}</p>:null}
        <details className="text-xs text-[#5f524c]">
          <summary className="w-fit cursor-pointer py-1 text-[#a8583e]">Dati biglietto</summary>
          <p>Nome nel biglietto: {person.enteredName??person.name}</p>
          <p>Email nel biglietto: {person.email??"non disponibile"}</p>
          <p>Ordine: {person.orderId||"non disponibile"}</p>
          {person.ticketType&&<p>Tipo: {person.ticketType}</p>}
          {person.partner&&<p>Partner: {partnerLabel} · indicato {person.partner.source==="gestionale"?"nel gestionale":person.partner.source==="ticket_tailor"?"in Ticket Tailor":person.partner.source==="admin"?"in Admin":"dal partecipante"} come {person.partner.enteredName??person.partner.name}</p>}
        </details>
      </div>
    </UnifiedParticipantCard>
  </li>;
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

function defaultRecipients(kind: PeonyEmailKind, attendees: PeonyAttendee[], audience: PeonyEmailAudience = "practitioner", sends: PeonyEmailSend[] = []): string[] {
  return attendees.filter((person) => {
    if (!person.email || sends.some(send => send.kind === kind && send.ticketId === person.ticketId)) return false;
    if (kind === "membership") return person.associationRequired && person.association?.status !== "valid";
    if (kind === "partner") return person.partnerRequired && !person.partner;
    return audience === "observer" ? person.ticketRole === "observer" : person.ticketRole !== "observer";
  }).map((person) => person.ticketId);
}

export function PeonyEventOperations({
  eventId, eventTitle, dateLabel, attendees,
  ticketsLastSyncedAt, associationLastSyncedAt, templates: initialTemplates, sends,initialTicketId, emailContext, initialLanguageOverride, initialDetailFields,
}: {
  eventId: string;
  eventTitle: string;
  dateLabel: string;
  attendees: PeonyAttendee[];
  ticketsLastSyncedAt: string | null;
  associationLastSyncedAt: string | null;
  templates: Record<PeonyEmailKind, PeonyEmailTemplate>;
  emailContext: PeonyEmailEventContext;
  initialLanguageOverride: PeonyEmailLanguage|null;
  initialDetailFields: PeonyEmailDetailFields;
  sends: PeonyEmailSend[];
  initialTicketId?:string|null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("partecipanti");
  const [kind, setKind] = useState<PeonyEmailKind>("membership");
  const [audience, setAudience] = useState<PeonyEmailAudience>("practitioner");
  const [sendMode,setSendMode] = useState<"initial"|"reminder">("initial");
  const [templates, setTemplates] = useState(initialTemplates);
  const [languageChoice,setLanguageChoice] = useState<"auto"|PeonyEmailLanguage>(initialLanguageOverride??"auto");
  const [detailFields,setDetailFields] = useState<PeonyEmailDetailFields>(initialDetailFields);
  const resolvedLanguage:PeonyEmailLanguage=languageChoice==="auto"?
    peonyEmailLanguage(eventTitle,emailContext):languageChoice;
  const isWorkshop=isWorkshopEvent(eventTitle,emailContext);
  const [checked, setChecked] = useState<string[]>(() => defaultRecipients("membership", attendees, "practitioner", sends));
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [search, setSearch] = useState(()=>initialTicketId?
    attendees.find(a=>a.ticketId===initialTicketId)?.name??"":"");
  const [ticketFilter,setTicketFilter]=useState<TicketFilter>("all");
  const [confirmingSend, setConfirmingSend] = useState(false);

  const template = templates[kind];
  const baseSubject = resolvePeonyTemplateText(template.subject,eventTitle,dateLabel);
  const audienceSubject = kind === "details" && audience === "observer" ? baseSubject + " | Observer" : baseSubject;
  const emailSubject = sendMode === "reminder" ?
    (resolvedLanguage==="en" ? "Reminder | " : "Sollecito | ") + audienceSubject : audienceSubject;
  const reminderIntro = sendMode === "reminder" ?
    (resolvedLanguage==="en" ?
      "This is a reminder regarding the information requested for your booking. Please reply if you have already completed the necessary steps.\n\n" :
      "Questo è un promemoria relativo alla tua iscrizione. Se hai già completato i passaggi richiesti, rispondi a questa email per una verifica.\n\n") : "";
  const observerDefault = kind==="details" && audience==="observer" &&
    template.body===defaultPeonyEmailTemplate("details",eventTitle,dateLabel,resolvedLanguage).body;
  const intro=observerDefault ?
    (resolvedLanguage==="en"?
      "Dear,\n\nYou booked an observer ticket for {{event_title}} ({{event_date}}). Below are the practical details for your visit.":
      "Ciao!\n\nRicevi questa email perché hai prenotato un posto come observer per {{event_title}} ({{event_date}}). Qui sotto trovi le informazioni utili per la serata.") :
    template.body;
  const html = useMemo(() => buildPeonyEmailHtml({
    kind, eventTitle, dateLabel, template: { ...template, subject: emailSubject, body: reminderIntro+intro },
    context: emailContext, audience,language:resolvedLanguage,detailFields,
  }), [kind, eventTitle, dateLabel, template, emailContext, audience, emailSubject, reminderIntro, intro, resolvedLanguage,detailFields]);
  const sendCounts = useMemo(() => {
    const counts = new Map<string,number>();
    for (const record of sends.filter(send=>send.kind===kind))
      counts.set(record.ticketId,(counts.get(record.ticketId)??0)+1);
    return counts;
  },[kind,sends]);
  const hasObserverTickets = attendees.some(person => person.ticketRole === "observer");
  const templateLanguage = resolvedLanguage;
  const missingSchedule=isWorkshop && kind==="details" &&
    (!detailFields.doorsOpen?.trim() || !detailFields.dailyStart?.trim() || !detailFields.dailyEnd?.trim());
  const canCopyDetails = !missingSchedule;
  const eligible = attendees.filter((person) =>
    Boolean(person.email) &&
    (sendMode === "reminder" ?
      sends.some(send=>send.kind===kind && send.ticketId===person.ticketId) :
      !sends.some(send=>send.kind===kind && send.ticketId===person.ticketId)) && (
    kind==="membership" ? person.associationRequired && person.association?.status!=="valid" :
    kind==="partner" ? person.partnerRequired && !person.partner :
    audience==="observer" ? person.ticketRole==="observer" : person.ticketRole!=="observer"
  ));
  const selected = eligible.filter((person) => checked.includes(person.ticketId));
  const distinctEmails = [...new Set(selected.map((person) => person.email!.trim().toLowerCase()))];
  const latestSend = useMemo(() => {
    const items = new Map<string, PeonyEmailSend>();
    for (const item of sends.filter((item) => item.kind === kind)) {
      if (!items.has(item.ticketId)) items.set(item.ticketId, item);
    }
    return items;
  }, [kind, sends]);
  const freeOnly=attendees.length>0&&attendees.every(person=>person.freeEvent);
  const visible = attendees.filter((person) =>
    (freeOnly||ticketFilter==="all"||person.ticketRole===ticketFilter) &&
    [person.name, person.profileAlias, person.enteredName, person.email, person.profileEmail, person.ticketType, person.orderId, person.partner?.name, person.partner?.profileAlias, person.partner?.enteredName, person.partner?.email]
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
        setChecked([]);
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
    setSendMode("initial");
    setChecked(defaultRecipients(next, attendees, audience, sends));
    setMessage(null); setFailure(null); setConfirmingSend(false);
  }
  function changeAudience(next: PeonyEmailAudience) {
    setAudience(next);
    setChecked(sendMode==="initial" ? defaultRecipients("details", attendees, next, sends) : []);
    setMessage(null); setFailure(null); setConfirmingSend(false);
  }
  function changeSendMode(next:"initial"|"reminder") {
    setSendMode(next);
    // No implicit selection for reminders: the operator must choose recipients.
    setChecked(next==="initial" ? defaultRecipients(kind,attendees,audience,sends) : []);
    setMessage(null);setFailure(null);setConfirmingSend(false);
  }
  function changeLanguage(next:"auto"|PeonyEmailLanguage) {
    const old=resolvedLanguage;
    const nextLanguage=next==="auto"?peonyEmailLanguage(eventTitle,emailContext):next;
    setTemplates(prev=>{
      const updated={...prev};
      for(const currentKind of PEONY_EMAIL_KINDS.map(item=>item.id)){
        const oldDefault=defaultPeonyEmailTemplate(currentKind,eventTitle,dateLabel,old);
        if(prev[currentKind].subject===oldDefault.subject && prev[currentKind].body===oldDefault.body)
          updated[currentKind]=defaultPeonyEmailTemplate(currentKind,eventTitle,dateLabel,nextLanguage);
      }
      return updated;
    });
    setLanguageChoice(next);setMessage(null);setFailure(null);
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
            {freeOnly?<span>Tessera non richiesta · ingresso libero</span>
              :<span>{practitioners} praticanti · {observers} observer</span>}
            {!freeOnly&&unknownTypes>0?<span className="font-semibold text-[#9b4b1e]">{unknownTypes} tipi da identificare</span>:null}
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
            <p>Registrazione dai moduli Google; quota da email o conferma manuale.</p>
          </details>
          <AssociationDotLegend/>
          {!freeOnly&&<div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="peony-ticket-role-filter" className="text-[#5f524c]">Biglietti</label>
            <select id="peony-ticket-role-filter" value={ticketFilter} onChange={event=>setTicketFilter(event.target.value as TicketFilter)}
              className="min-h-10 flex-1 rounded-xl border border-[#211815]/15 bg-white px-3">
              <option value="all">Tutti ({attendees.length})</option>
              <option value="practitioner">Praticanti ({practitioners})</option>
              <option value="observer">Observer ({observers})</option>
              {unknownTypes>0?<option value="unknown">Tipo mancante ({unknownTypes})</option>:null}
            </select>
          </div>}
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Cerca nome o partner" aria-label="Cerca partecipanti e partner"
            className="h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm" />
          {visible.length === 0 ? <p className={card}>Nessun partecipante nei dati sincronizzati.</p> : null}
          <ul className="space-y-1.5">{visible.map(person => <PersonRow key={person.ticketId} person={person} eventId={eventId} initialExpanded={person.ticketId===initialTicketId} />)}</ul>
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
          <label className="block text-sm font-semibold">Lingua delle email
            <select value={languageChoice} aria-label="Lingua email"
              onChange={e=>changeLanguage(e.target.value as "auto"|PeonyEmailLanguage)}
              className="mt-1 h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm">
              <option value="auto">Automatica ({peonyEmailLanguage(eventTitle,emailContext)==="en"?"English":"Italiano"})</option>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </label>
          {isWorkshop&&resolvedLanguage!=="en" ?
            <p className="text-xs text-[#9b4b1e]">Per workshop internazionali usa English. Controlla anche il testo introduttivo.</p> : null}
          <label className="block text-sm font-semibold">Tipo invio
            <select value={sendMode} aria-label="Tipo invio" onChange={e=>changeSendMode(e.target.value as "initial"|"reminder")}
              className="mt-1 h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm">
              <option value="initial">Prima email</option>
              <option value="reminder">Sollecito</option>
            </select>
          </label>
          {sendMode==="reminder" ?
            <p className="text-xs text-[#5f524c]">Mostra solo chi ha già ricevuto questa comunicazione. Seleziona esplicitamente a chi inviare il sollecito.</p> :
            <p className="text-xs text-[#5f524c]">Chi ha già ricevuto questa comunicazione viene escluso dalla selezione.</p>}
          {kind === "details" && hasObserverTickets ? (
            <label className="block text-sm">
              <span className="font-semibold">Destinatari</span>
              <select aria-label="Pubblico email" value={audience}
                onChange={e => changeAudience(e.target.value as PeonyEmailAudience)}
                className="mt-1 h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-2 text-sm">
                <option value="practitioner">Praticanti</option>
                <option value="observer">Observer</option>
              </select>
            </label>
          ) : null}
          <p className="text-xs text-[#5f524c]">
            Ticket Tailor: titolo, data, orario e descrizione dell'evento, quando disponibili.
            Le regole dello studio sono condivise tra i template.
          </p>
          {kind === "details" && !emailContext.startTime ?
            <p className="text-xs text-[#9b4b1e]">Orario non disponibile nei dati sincronizzati di Ticket Tailor: controlla prima di inviare.</p> : null}
          {kind==="details" ? <details className={card}>
            <summary className="cursor-pointer text-sm font-semibold">
              {isWorkshop?"Programma e dettagli del workshop":"Orari e dettagli dell'evento"}
            </summary>
            <p className="mt-2 text-xs text-[#5f524c]">
              Titolo e date arrivano da Ticket Tailor. Compila solo le informazioni non disponibili in forma strutturata.
              Per i workshop di più giorni gli orari giornalieri non si deducono dall'orario dell'evento.
            </p>
            <div className="mt-3 rounded-lg bg-[#f2ede3] p-3 text-sm">
              <strong>Fonte Ticket Tailor</strong>
              <p>{eventTitle} · {dateLabel}</p>
              {emailContext.startTime?<p>Inizio evento: {emailContext.startTime}</p>:null}
              {emailContext.endTime?<p>Fine evento: {emailContext.endTime}</p>:null}
              {emailContext.description?<details className="mt-2"><summary className="cursor-pointer underline">Leggi descrizione originale</summary>
                <p className="mt-2 whitespace-pre-wrap text-xs">{emailContext.description}</p>
              </details>:<p>Descrizione non presente nei dati sincronizzati.</p>}
            </div>
            {isWorkshop?<label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={detailFields.includeTicketTailorDescription!==false}
                onChange={e=>setDetailFields(prev=>({...prev,includeTicketTailorDescription:e.target.checked}))}/>
              Includi la descrizione Ticket Tailor in Workshop Information
            </label>:null}
            <div className="mt-3 grid gap-3">
              {PEONY_DETAIL_FIELDS.filter(field=>isWorkshop ? field.key!=="lastEntry" :
                ["doorsOpen","dailyStart","dailyEnd","lastEntry","extraNotes"].includes(field.key)).map(field=>
                <label key={field.key} className="block text-sm font-semibold">{field.label}
                  {field.multiline ? <textarea rows={3} value={String(detailFields[field.key]??"")}
                    onChange={e=>setDetailFields(prev=>({...prev,[field.key]:e.target.value}))}
                    className="mt-1 w-full rounded-lg border border-[#211815]/15 bg-white p-3 text-sm"/> :
                    <input type="text" value={String(detailFields[field.key]??"")}
                      onChange={e=>setDetailFields(prev=>({...prev,[field.key]:e.target.value}))}
                      className="mt-1 h-10 w-full rounded-lg border border-[#211815]/15 bg-white p-2 text-sm"/>}
                </label>)}
            </div>
            {missingSchedule?<p className="mt-2 text-sm text-[#9b4b1e]">
              Per copiare l'email completa occorre indicare apertura porte, inizio e fine della giornata.
            </p>:null}
            <button type="button" className={button} disabled={busy}
              onClick={()=>run(()=>savePeonyEmailSettings(eventId,languageChoice==="auto"?null:languageChoice,detailFields),
                "Lingua e dettagli salvati.")}>Salva lingua e dettagli</button>
          </details> : <button type="button" className="h-10 rounded-xl border border-[#211815]/20 px-3 text-sm"
              onClick={()=>run(()=>savePeonyEmailSettings(eventId,languageChoice==="auto"?null:languageChoice,detailFields),
                "Lingua salvata.")}>Salva lingua</button>}
          <div className={card}>
            <label htmlFor="peony-subject" className="block text-sm font-semibold">Oggetto</label>
            <input id="peony-subject" value={template.subject} maxLength={300}
              onChange={e => setTemplateField("subject",e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-[#211815]/15 bg-white p-2 text-sm" />
            <p className="mt-1 break-words text-xs text-[#5f524c]">Oggetto finale: {emailSubject}</p>
            <p className="mt-1 text-xs text-[#5f524c]">Puoi usare {"{{event_title}}"} e {"{{event_date}}"}: saranno sostituiti con i dati Ticket Tailor.</p>
            <label htmlFor="peony-body" className="mt-3 block text-sm font-semibold">Introduzione / note aggiuntive</label>
            <textarea id="peony-body" rows={7} value={template.body} maxLength={30000}
              onChange={e => setTemplateField("body",e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#211815]/15 bg-white p-3 text-sm" />
            {template.body.includes("[Inserisci qui gli orari effettivi") ? <p className="mt-2 text-xs text-[#9b4b1e]">Questo testo contiene un segnaposto del vecchio modello. Rimuovilo oppure ripristina il modello base.</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="h-10 rounded-xl border border-[#211815]/20 px-3 text-sm" onClick={() => {
                const regenerated=defaultPeonyEmailTemplate(kind,eventTitle,dateLabel,templateLanguage);
                setTemplates(prev => ({...prev,[kind]: regenerated}));
              }}>Ripristina base</button>
              <button type="button" className={button} disabled={busy || !template.subject.trim()}
                onClick={() => run(() => savePeonyEmailTemplate(eventId, kind, template.subject, template.body), "Testo salvato per questa comunicazione.")}>Salva</button>
              <button type="button" className="h-10 rounded-xl border border-[#211815]/20 px-3 text-sm" onClick={() => copy(emailSubject, "Oggetto copiato.")}>Copia oggetto</button>
              <button type="button" disabled={!canCopyDetails} className="h-10 rounded-xl border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e] disabled:opacity-50"
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
            <h3 className="text-sm font-semibold">Destinatari {sendMode==="reminder"?"del sollecito":"del primo invio"} · {distinctEmails.length}</h3>
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
                    <input type="checkbox" disabled={!eligible.some(entry=>entry.ticketId===person.ticketId)} checked={checked.includes(person.ticketId)}
                      onChange={e => setChecked(prev => e.target.checked ? [...prev,person.ticketId] : prev.filter(id => id !== person.ticketId))}
                      className="mt-1" />
                    <span className="min-w-0 flex-1">
                      {person.name}<span className="block break-words text-xs text-[#5f524c]">{person.email || "Senza email"}</span>
                      {latestSend.has(person.ticketId) ? (
                        <span className="block text-xs text-[#326941]">Inviata: {latestSend.get(person.ticketId)?.sentOn}{(sendCounts.get(person.ticketId)??0)>1 ? " · Solleciti: "+((sendCounts.get(person.ticketId)??1)-1) : ""}</span>
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
                <button type="button" disabled={busy || !selected.length || !template.subject.trim() || !canCopyDetails}
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
                    run(() => markPeonyEmailSent(eventId, selected.map(p => p.ticketId), kind, emailSubject, sendMode), "Invio registrato nello storico.");
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
