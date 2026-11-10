"use client";

import { useEffect, useState, useTransition } from "react";

import { updateEnteredParticipantAction } from "@/app/gestione/(app)/w/registration-actions";
import { EMAIL_PATTERN, findEmail } from "@/lib/gestionale/parse-roster";
import { registrationPersonLabel } from "@/lib/gestionale/registrations";
import { suggestCoupleSplit } from "@/lib/gestionale/couple-input";
import { OrganizerPersonMatcher, OrganizerCompoundSplitter } from "./OrganizerPersonMatcher";
import type { Registration } from "@/lib/gestionale/types";

import { Notice, buttonClass, inputClass } from "./ui";

type Entry = Registration["people"][number];
type Message = { tone:"success"|"error";text:string } | null;

/** L'organizzatrice può modificare sia intestatario sia partner.
 * Sono i dati INSERITI nell'iscrizione: non il nominativo ufficiale del socio.
 */
function ParticipantLine({entry,suggestedEmail}:{
  entry:Entry;suggestedEmail:string|null;
}) {
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(entry.enteredAs??"");
  const [email,setEmail]=useState(entry.enteredEmail??"");
  const [message,setMessage]=useState<Message>(null);
  const [pending,startTransition]=useTransition();
  const display=registrationPersonLabel(entry);
  const status=display.linked?"Anagrafica abbinata":entry.matchStatus==="automatico"?"Abbinamento da confermare":"Da abbinare";
  useEffect(()=>{
    if(editing)return;
    setName(entry.enteredAs??"");
    setEmail(entry.enteredEmail??"");
  },[entry.enteredAs,entry.enteredEmail,editing]);

  function save(){
    const cleanName=name.trim();
    const cleanEmail=email.trim().toLowerCase();
    if(!cleanName){setMessage({tone:"error",text:"Inserisci un nome o nickname."});return;}
    if(cleanEmail&&!EMAIL_PATTERN.test(cleanEmail)){
      setMessage({tone:"error",text:"Email non valida: controlla l'indirizzo."});return;
    }
    setMessage(null);
    startTransition(async()=>{
      try {
        const result=await updateEnteredParticipantAction({
          participantId:entry.participantId,name:cleanName,email:cleanEmail,
        });
        if(result.ok){
          setName(cleanName);
          setEmail(cleanEmail);
          setEditing(false);
          setMessage({tone:"success",text:`Dati ${entry.isPrimary?"dell'intestatario":"del partner"} salvati.`});
        }else setMessage({tone:"error",text:result.error});
      }catch{setMessage({tone:"error",text:"Salvataggio non riuscito. Riprova."});}
    });
  }

  return <section className="space-y-2 rounded-xl border border-[#211815]/15 bg-white p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#7a5212]">
          {entry.isPrimary?"1 · Intestatario":"2 · Partner"}
        </p>
        <p className="break-words text-base font-semibold">
          {display.name}{display.alias ? <span className="ml-1 font-normal text-xs text-[#5f524c]">({display.alias})</span> : null}
        </p>
        {!editing&&<>
          <p className={`text-xs font-semibold ${display.linked?"text-[#326941]":"text-[#9b5928]"}`}>
            {status}
          </p>
          <p className="break-all text-sm text-[#5f524c]">
            {display.email||"Email mancante"}
            {display.emailSource?<span className="ml-1 text-xs">· {display.emailSource==="anagrafica"?"dall'anagrafica":"inserita nel workshop"}</span>:null}
          </p>
          {entry.enteredEmail && entry.linkedProfile?.email &&
            entry.enteredEmail.trim().toLowerCase()!==entry.linkedProfile.email.trim().toLowerCase() ?
            <p className="break-all text-xs text-[#7a5212]">
              Email diversa nell'iscrizione: {entry.enteredEmail}
            </p> : null}
        </>}

      </div>
      {!editing&&<button type="button" className={buttonClass.secondary}
        onClick={()=>{setEditing(true);setMessage(null);}}>
        Modifica dati
      </button>}
    </div>
    {editing&&<div className="space-y-3 rounded-lg border border-[#a8583e]/20 bg-[#f8f3ea] p-3">
      <label className="block text-sm font-semibold">
        Nome o nickname usato per il workshop
        <input className={`${inputClass} mt-1`} value={name} maxLength={200}
          onChange={event=>setName(event.target.value)} autoComplete="off" />
      </label>
      <label className="block text-sm font-semibold">
        Email {entry.isPrimary?"intestatario":"partner"}
        <input className={`${inputClass} mt-1`} type="email" inputMode="email"
          autoComplete="off" value={email} onChange={event=>setEmail(event.target.value)}
          placeholder="nome@esempio.it" />
      </label>
      {suggestedEmail&&!email&&<button type="button" className="text-sm font-semibold text-[#a8583e] underline"
        onClick={()=>setEmail(suggestedEmail)}>
        Usa l'email trovata nelle note: {suggestedEmail}
      </button>}
      <p className="text-xs text-[#5f524c]">
        Questi dati sono quelli dell'iscrizione; non modificano la tessera né l'anagrafica ufficiale.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.primary} disabled={pending} onClick={save}>
          {pending?"Salvataggio…":"Salva partecipante"}
        </button>
        <button type="button" className={buttonClass.ghost} disabled={pending}
          onClick={()=>{setName(entry.enteredAs??"");setEmail(entry.enteredEmail??"");setEditing(false);setMessage(null);}}>
          Chiudi
        </button>
      </div>
    </div>}
    {message&&<Notice tone={message.tone}>{message.text}</Notice>}
    {!editing&&!(entry.autoCreated&&entry.matchStatus==="da_abbinare"&&
      suggestCoupleSplit(entry.enteredAs??""))&&
      <OrganizerPersonMatcher participantId={entry.participantId} enteredAs={entry.enteredAs??""} linked={display.linked}/>}
    {!editing&&entry.autoCreated&&entry.matchStatus==="da_abbinare"&&
      suggestCoupleSplit(entry.enteredAs??"")&&
      <p className="text-xs text-[#7a5212]">Prima dividi la coppia; poi abbina le due persone separatamente.</p>}
  </section>;
}

/** Mostrato all'inizio della scheda coppia; le due persone hanno le stesse
 * azioni. La quota e i pagamenti restano a livello d'iscrizione, non per persona.
 */
export function EnteredEmails({registration}:{registration:Registration}){
  const people=registration.people;
  const fromNotes=findEmail(registration.notes);
  const target=fromNotes&&!people.some(entry=>entry.enteredEmail===fromNotes)
    ?people.find(entry=>!entry.enteredEmail):undefined;
  if(!people.length)return null;
  return <div className="space-y-2">
    <h3 className="text-base font-semibold">
      {people.length>1?"Persone della coppia":"Partecipante"}
    </h3>
    <div className="grid gap-3 sm:grid-cols-2">
      {people.map(entry=><ParticipantLine key={entry.participantId} entry={entry}
        suggestedEmail={target?.participantId===entry.participantId?fromNotes:null}/>)}
    </div>
    {people.length===1&&people[0].autoCreated&&people[0].matchStatus==="da_abbinare"&&
      <OrganizerCompoundSplitter participantId={people[0].participantId}
        enteredAs={people[0].enteredAs??""}/>}

  </div>;
}
