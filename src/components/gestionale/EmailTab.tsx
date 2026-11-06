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
  sends: EmailSendRow[];
  today: string;
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
  {label:"Cosa portare",keys:["ropes","clothing"]},
  {label:"Associazione e contatti",keys:["membershipFeeEuro","membershipDeadline","membershipFormUrl","location","intercom","mapsUrl","signature"]},
  {label:"Logistica e regole",keys:["accessInfo","lunchInfo","venueRules","photoPolicy","emergencyContact"]},
  {label:"Note extra",keys:["extraNotes"]},
] as const;

function initialData(workshop: WorkshopView, defaults: EmailDefaults, saved: EmailSavedFields): WorkshopEmailData {
  return { ...workshopEmailDefaults(workshop), ...defaults.fields, ...saved.fields } as WorkshopEmailData;
}

function EditWorkshopDetails({workshop,defaults,saved,onSave}:{workshop:WorkshopView;defaults:EmailDefaults;saved:EmailSavedFields;onSave:(data:WorkshopEmailData)=>void}) {
  const router=useRouter();
  const [data,setData]=useState<WorkshopEmailData>(()=>initialData(workshop,defaults,saved));
  const [version,setVersion]=useState(saved.version);
  const [pending,startTransition]=useTransition();
  const [message,setMessage]=useState<{tone:"success"|"error";text:string}|null>(null);
  function update(key:keyof WorkshopEmailData,value:string,list=false) {
    setData(prev=>({...prev,[key]:key==="membershipFeeEuro"?Number(value):list?value.split("\n").map(s=>s.trim()).filter(Boolean):value}));
    setMessage(null);
  }
  function save() {
    startTransition(async()=>{
      const result=await saveWorkshopEmailAction({workshopId:workshop.id,version,fields:data});
      if(result.ok) {
        setVersion(result.data.version);onSave(data);setMessage({tone:"success",text:"Dettagli salvati."});router.refresh();
      } else setMessage({tone:"error",text:result.error});
    });
  }
  const missing=[!data.schedule?.length?"Orari":null,!data.program?.length?"Programma":null,!data.ropes?.trim()?"Corde":null,!data.clothing?.trim()?"Abbigliamento":null].filter(Boolean);
  return <details className={cardClass+" p-3"}>
    <summary className="min-h-10 cursor-pointer font-semibold">Dettagli del workshop · {missing.length ? "Da completare: "+missing.join(", ") : "Completi ✓"}</summary>
    <p className="mt-2 text-sm text-[#5f524c]">Compila una volta i dettagli condivisi dalle email. Programma e prerequisiti non vengono inventati o copiati automaticamente da altri workshop.</p>
    <p className="mt-2 text-sm"><Link prefetch={false} href="/gestione/altro/impostazioni-email" className="text-[#8f2635] underline">Modifica impostazioni generali: associazione, indirizzo, regole, firma</Link></p>
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
            item.kind==="partner"?"Richiesta partner":item.kind==="partner_reminder"?"Sollecito partner "+item.number:"Dettagli workshop"} · {item.sentOn}</span></div>
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

export function EmailTab({workshop,bookings,saved,defaults,sends,today}:Props) {
  const [fields,setFields]=useState<WorkshopEmailData>(()=>initialData(workshop,defaults,saved));
  const candidates=emailRecipients(bookings,sends);
  const groups=(["membership_request","partner","membership_reminder","partner_reminder","workshop_details"] as EmailWorkflowKind[])
    .map(kind=>({kind,recipients:candidates.filter(r=>r.type===kind)}));
  const first=groups.find(g=>g.recipients.some(r=>r.email))?.kind;
  const dates=emailMembershipDates(workshop.startsOn);
  return <div className="max-w-2xl space-y-3">
    <EditWorkshopDetails workshop={workshop} defaults={defaults} saved={saved} onSave={setFields} />
    <div><h2 className="text-lg font-semibold">Quale email vuoi mandare?</h2>
      <p className="mt-1 text-sm text-[#5f524c]">Sono proposte soltanto le persone idonee. Copia l'HTML in Gmail; segna l'invio soltanto dopo averlo davvero effettuato.</p></div>
    {groups.map(group=><EmailWorkflow key={group.kind} kind={group.kind} recipients={group.recipients} workshopId={workshop.id}
      today={today} fields={fields} validUntil={dates.validUntil} renewalUntil={dates.renewalUntil} initiallyOpen={first===group.kind} />)}
    <SendHistory bookings={bookings} sends={sends} />
  </div>;
}
