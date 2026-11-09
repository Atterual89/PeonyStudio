"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveWorkshopEmailAction, deleteEmailSentAction } from "@/app/gestione/(app)/w/email-actions";
import { deleteContactAction } from "@/app/gestione/(app)/w/contact-actions";
import { WORKSHOP_EMAIL_KEYS, type WorkshopEmailData } from "@/lib/gestionale/email/types";
import { emailRecipients, type EmailRecipient } from "@/lib/gestionale/email/recipients";
import { workshopEmailDefaults, emailMembershipDates } from "@/lib/gestionale/email/defaults";
import type { EmailSavedFields, EmailDefaults, EmailSendRow } from "@/lib/gestionale/server/email";
import type { BookingView, WorkshopView } from "@/lib/gestionale/types";
import { EmailWorkflow, type EmailWorkflowKind } from "./EmailWorkflow";
import { Notice, buttonClass, cardClass, inputClass } from "./ui";

type Props = {
  workshop: WorkshopView;
  bookings: BookingView[];
  saved: EmailSavedFields;
  defaults: EmailDefaults;
  ticketTailorFields: Partial<WorkshopEmailData>;
  sends: EmailSendRow[];
  today: string;
  previousConfigs: { workshopId: string; name: string; fields: Partial<WorkshopEmailData> }[];
};

const FIELDS: { key: keyof WorkshopEmailData; label: string; multiline?: boolean; list?: boolean; reusable?: boolean }[] = [
  {key:"title",label:"Titolo nelle email"},
  {key:"dateLabel",label:"Date mostrate nelle email"},
  {key:"location",label:"Indirizzo",reusable:true},
  {key:"intercom",label:"Citofono",reusable:true},
  {key:"mapsUrl",label:"Link Google Maps",reusable:true},
  {key:"membershipFormUrl",label:"Modulo associazione",reusable:true},
  {key:"membershipFeeEuro",label:"Quota associativa in €",reusable:true},
  {key:"membershipDeadline",label:"Scadenza associazione"},
  {key:"intro",label:"Presentazione del workshop",multiline:true},
  {key:"schedule",label:"Date, orari e pause (una riga per voce)",list:true},
  {key:"arrival",label:"Nota sull'arrivo",multiline:true},
  {key:"program",label:"Programma (un punto per riga)",list:true},
  {key:"prerequisitesRiggers",label:"Prerequisiti rigger (un punto per riga)",list:true},
  {key:"prerequisitesModels",label:"Prerequisiti model (un punto per riga)",list:true},
  {key:"ropes",label:"Corde da portare",multiline:true},
  {key:"clothing",label:"Abbigliamento",multiline:true},
  {key:"partnerPolicy",label:"Regole per i partner",multiline:true},
  {key:"extraNotes",label:"Note extra",multiline:true},
  {key:"accessInfo",label:"Come arrivare (una riga per voce)",list:true},
  {key:"lunchInfo",label:"Pranzo e servizi (una riga per voce)",list:true},
  {key:"venueRules",label:"Regole dello studio (una riga per voce)",list:true},
  {key:"photoPolicy",label:"Foto e video (una riga per voce)",list:true},
  {key:"emergencyContact",label:"Contatto emergenze",multiline:true},
  {key:"signature",label:"Firma",reusable:true},
];
const SECTIONS = [
  {label:"Date, orari e presentazione",keys:["title","dateLabel","intro","schedule","arrival"]},
  {label:"Programma e prerequisiti",keys:["program","prerequisitesRiggers","prerequisitesModels"]},
  {label:"Cosa portare e partner",keys:["ropes","clothing","partnerPolicy"]},
  {label:"Associazione e contatti",keys:["membershipFeeEuro","membershipDeadline","membershipFormUrl","location","intercom","mapsUrl","signature"]},
  {label:"Logistica e regole",keys:["accessInfo","lunchInfo","venueRules","photoPolicy","emergencyContact"]},
  {label:"Note extra",keys:["extraNotes"]},
] as const;

function initialData(workshop: WorkshopView, defaults: EmailDefaults, saved: EmailSavedFields, ticketTailorFields: Partial<WorkshopEmailData>): WorkshopEmailData {
  return { ...workshopEmailDefaults(workshop), ...defaults.fields, ...ticketTailorFields, ...saved.fields,
    ticketTailor:ticketTailorFields.ticketTailor } as WorkshopEmailData;
}

function EditWorkshopDetails({workshop,defaults,saved,ticketTailorFields,onSave,previousConfigs}:{workshop:WorkshopView;defaults:EmailDefaults;saved:EmailSavedFields;ticketTailorFields:Partial<WorkshopEmailData>;onSave:(data:WorkshopEmailData)=>void;previousConfigs:Props["previousConfigs"]}) {
  const router=useRouter();
  const [data,setData]=useState<WorkshopEmailData>(()=>initialData(workshop,defaults,saved,ticketTailorFields));
  const [version,setVersion]=useState(saved.version);
  const [sourceId,setSourceId]=useState("");
  const [pending,startTransition]=useTransition();
  const [message,setMessage]=useState<{tone:"success"|"error";text:string}|null>(null);
  function update(key:keyof WorkshopEmailData,value:string,list=false) {
    const next={...data,[key]:key==="membershipFeeEuro"?Number(value):list?value.split("\n").map(s=>s.trim()).filter(Boolean):value};
    setData(next);onSave(next);
    setMessage(null);
  }
  function save() {
    startTransition(async()=>{
      const fields:Partial<WorkshopEmailData>={...data};
      delete fields.ticketTailor; // TT remains live, not part of saved overrides.
      // TT-sourced values remain live; only explicitly edited overrides are stored.
      // Keep TT-derived source fields live after later synchronizations.
      if (ticketTailorFields.title && fields.title===ticketTailorFields.title)
        delete fields.title;
      if (ticketTailorFields.dateLabel && fields.dateLabel===ticketTailorFields.dateLabel)
        delete fields.dateLabel;
      if (ticketTailorFields.schedule && JSON.stringify(fields.schedule)===JSON.stringify(ticketTailorFields.schedule))
        delete fields.schedule;
      if (ticketTailorFields.extraNotes && fields.extraNotes===ticketTailorFields.extraNotes)
        delete fields.extraNotes;
      const result=await saveWorkshopEmailAction({workshopId:workshop.id,version,fields});
      if(result.ok) {
        setVersion(result.data.version);onSave(data);setMessage({tone:"success",text:"Dettagli salvati."});router.refresh();
      } else setMessage({tone:"error",text:result.error});
    });
  }
  const fromTicketTailor=Boolean(data.ticketTailor?.description || data.extraNotes?.startsWith("From Ticket Tailor:"));
  const missing=[!data.schedule?.length?"Orari":null,
    !fromTicketTailor&&!data.program?.length?"Descrizione workshop":null].filter(Boolean);
  return <details className={cardClass+" p-3"}>
    <summary className="min-h-10 cursor-pointer font-semibold">Dettagli del workshop · {fromTicketTailor ? "Recuperati da Ticket Tailor ✓" : missing.length ? "Dati non disponibili: "+missing.join(", ") : "Completi ✓"}</summary>
    <p className="mt-2 text-sm text-[#5f524c]">Programma, materiali, requisiti e orari vengono letti dall’evento Ticket Tailor collegato. Gli eventuali campi sottostanti servono solo per integrazioni o correzioni specifiche.</p>
    {data.ticketTailor?.description ? <details className="mt-2 rounded-lg bg-[#f2ede3] p-3 text-sm"><summary className="cursor-pointer font-medium">Fonte Ticket Tailor · programma e materiali originali</summary><p className="mt-2 whitespace-pre-wrap text-xs">{data.ticketTailor.description}</p></details> :
      <p className="mt-2 text-sm text-[#9b4b1e]">Descrizione non disponibile nella scheda Ticket Tailor collegata. Puoi integrare il testo manualmente.</p>}
    <p className="mt-2 text-sm"><Link prefetch={false} href="/gestione/altro/impostazioni-email" className="text-[#8f2635] underline">Modifica impostazioni generali: associazione, indirizzo, regole, firma</Link></p>
    {previousConfigs.length ? <div className="mt-3 rounded-lg bg-[#f2ede3] p-3">
      <label className="block text-sm font-medium">Copia testi da un workshop precedente
        <select className={inputClass+" mt-1 w-full"} value={sourceId} onChange={e=>setSourceId(e.target.value)}>
          <option value="">Seleziona un workshop</option>
          {previousConfigs.map(item=><option key={item.workshopId} value={item.workshopId}>{item.name}</option>)}
        </select>
      </label>
      <button type="button" disabled={!sourceId} className={buttonClass.secondary+" mt-2"} onClick={()=>{
        const source=previousConfigs.find(item=>item.workshopId===sourceId);
        if(!source)return;
        const next={...data};
        for(const key of WORKSHOP_EMAIL_KEYS){
          if(["title","dateLabel","membershipDeadline"].includes(key))continue;
          const value=source.fields[key];
          if(value!==undefined)Object.assign(next,{[key]:value});
        }
        setData(next);onSave(next);
        setMessage({tone:"success",text:"Testi copiati nella bozza. Verifica programma e orari, poi salva."});
      }}>Copia testi nella bozza</button>
    </div> : null}
    {SECTIONS.filter(section=>section.keys.some(key=>WORKSHOP_EMAIL_KEYS.some(k=>k===key))).map(section=><details key={section.label} className="mt-3 rounded-lg border border-[#211815]/10 p-3">
      <summary className="min-h-10 cursor-pointer font-medium">{section.label}</summary>
      <div className="mt-3 space-y-3">{FIELDS.filter(f=>WORKSHOP_EMAIL_KEYS.some(k=>k===f.key) && section.keys.some(key=>key===f.key)).map(field=>{
        const value=data[field.key];
        const text=Array.isArray(value)?value.join("\n"):String(value??"");
        return <label key={field.key} className="block text-sm font-medium">
          {field.label}
          {field.multiline||field.list?<textarea rows={field.list?4:3} className={inputClass+" mt-1 w-full"} value={text}
            onChange={e=>update(field.key,e.target.value,Boolean(field.list))} />:
            <input className={inputClass+" mt-1 w-full"} type={field.key==="membershipFeeEuro"?"number":"text"} min={field.key==="membershipFeeEuro"?0:undefined}
              value={text} onChange={e=>update(field.key,e.target.value)} />}
        </label>;
      })}</div>
    </details>)}
    <button type="button" className={buttonClass.primary+" mt-3"} disabled={pending} onClick={save}>{pending?"Salvataggio…":"Salva dettagli del workshop"}</button>
    {message?<div className="mt-2"><Notice tone={message.tone}>{message.text}</Notice></div>:null}
  </details>;
}

function SendHistory({bookings,sends}:{bookings:BookingView[];sends:EmailSendRow[]}) {
  const router=useRouter();
  const [busy,start]=useTransition();
  const [error,setError]=useState("");
  const [confirmId,setConfirmId]=useState<string|null>(null);
  const names=new Map(bookings.flatMap(b=>b.people).map(p=>[p.person.id,p.fullName||p.displayName]));
  const contacts=[...new Map(bookings.flatMap(b=>b.people).map(p=>[p.person.id,p])).values()]
    .flatMap(p=>p.contacts.map(c=>({id:c.id,personId:p.person.id,kind:c.kind,sentOn:c.sentOn,number:c.number})));
  const items=[...sends,...contacts].sort((a,b)=>b.sentOn.localeCompare(a.sentOn));
  return <details className={cardClass+" p-3"}>
    <summary className="min-h-10 cursor-pointer font-semibold">Storico invii · {items.length}</summary>
    {error?<Notice tone="error">{error}</Notice>:null}
    {!items.length?<p className="mt-2 text-sm text-[#5f524c]">Nessun invio registrato.</p>:<ul className="mt-3 divide-y divide-[#211815]/10">
      {items.map(item=><li key={item.kind+"-"+item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <div><strong>{names.get(item.personId)||"Persona non presente nell'elenco attuale"}</strong>
          <span className="block text-[#5f524c]">{item.kind==="richiesta"?"Richiesta associazione":item.kind==="sollecito"?"Sollecito associazione "+item.number:
            item.kind==="partner"?"Richiesta partner":item.kind==="partner_reminder"?"Sollecito partner "+item.number:item.kind==="workshop_details"&&item.number>0?"Sollecito dettagli workshop "+item.number:"Dettagli workshop"} · {item.sentOn}</span></div>
        {confirmId===item.id ? <div className="w-full rounded-lg bg-[#f2ede3] p-2">
          <p className="mb-2 text-sm font-medium">Segnare questo messaggio come non inviato?</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.danger} disabled={busy} onClick={()=>start(async()=>{
              const result=item.kind==="richiesta"||item.kind==="sollecito" ?
                await deleteContactAction({id:item.id}) : await deleteEmailSentAction(item.id);
              if(result.ok){setError("");setConfirmId(null);router.refresh();}
              else setError(result.error);
            })}>{busy?"Salvataggio…":"Conferma"}</button>
            <button type="button" className={buttonClass.ghost} disabled={busy} onClick={()=>setConfirmId(null)}>Chiudi</button>
          </div>
        </div> : <button type="button" disabled={busy} className={buttonClass.ghost} onClick={()=>setConfirmId(item.id)}>Segna non inviata</button>}
      </li>)}
    </ul>}
  </details>;
}

export function EmailTab({workshop,bookings,saved,defaults,ticketTailorFields,sends,today,previousConfigs}:Props) {
  const [fields,setFields]=useState<WorkshopEmailData>(()=>initialData(workshop,defaults,saved,ticketTailorFields));
  const candidates=emailRecipients(bookings,sends);
  const groups=(["membership_request","partner","membership_reminder","partner_reminder","workshop_details","workshop_details_reminder"] as EmailWorkflowKind[])
    .map(kind=>({kind,recipients:candidates.filter(r=>r.type===kind)}));
  const first=groups.find(g=>g.recipients.some(r=>r.email))?.kind;
  const [openKind,setOpenKind]=useState<EmailWorkflowKind|null>(first||null);
  const dates=emailMembershipDates(workshop.startsOn);
  return <div className="max-w-2xl space-y-3">
    <EditWorkshopDetails workshop={workshop} defaults={defaults} saved={saved} ticketTailorFields={ticketTailorFields} onSave={setFields} previousConfigs={previousConfigs} />
    <div><h2 className="text-lg font-semibold">Quale email vuoi mandare?</h2>
      <p className="mt-1 text-sm text-[#5f524c]">Sono proposte soltanto le persone idonee. Copia l'HTML in Gmail; segna l'invio soltanto dopo averlo davvero effettuato.</p></div>
    {groups.map(group=><EmailWorkflow key={group.kind} kind={group.kind} recipients={group.recipients} workshopId={workshop.id}
      today={today} fields={fields} validUntil={dates.validUntil} renewalUntil={dates.renewalUntil} open={openKind===group.kind} onToggle={()=>setOpenKind(prev=>prev===group.kind?null:group.kind)} />)}
    <SendHistory bookings={bookings} sends={sends} />
  </div>;
}
