"use client";

import { useState, useTransition } from "react";
import { saveEmailDefaultsAction } from "@/app/gestione/(app)/w/email-actions";
import type { WorkshopEmailData } from "@/lib/gestionale/email/types";
import { buttonClass, inputClass, Notice } from "./ui";

const FIELDS: {key:keyof WorkshopEmailData;label:string;type?:"list"|"multiline"|"number"}[] = [
  {key:"associationName",label:"Nome associazione"},
  {key:"associationPresident",label:"Presidente"},
  {key:"associationVicePresident",label:"Vicepresidente"},
  {key:"membershipFormUrl",label:"Link modulo associazione"},
  {key:"membershipFeeEuro",label:"Quota associativa (€)",type:"number"},
  {key:"transferInstructions",label:"Causale del bonifico unico"},
  {key:"location",label:"Indirizzo e piano"},
  {key:"intercom",label:"Citofono"},
  {key:"mapsUrl",label:"Google Maps"},
  {key:"accessInfo",label:"Come arrivare (una voce per riga)",type:"list"},
  {key:"lunchMapUrl",label:"Mappa pranzo"},
  {key:"lunchInfo",label:"Pranzo e servizi (una voce per riga)",type:"list"},
  {key:"venueRules",label:"Regole del luogo (una voce per riga)",type:"list"},
  {key:"photoPolicy",label:"Policy foto e video (una voce per riga)",type:"list"},
  {key:"emergencyContact",label:"Contatto emergenze",type:"multiline"},
  {key:"signature",label:"Firma"},
];

export function EmailDefaultsForm({initial,initialVersion}:{initial:Partial<WorkshopEmailData>;initialVersion:number}) {
  const [fields,setFields]=useState(initial);
  const [version,setVersion]=useState(initialVersion);
  const [pending,startTransition]=useTransition();
  const [message,setMessage]=useState<{tone:"success"|"error";text:string}|null>(null);
  return <div className="mt-4 max-w-xl space-y-3">
    <p className="text-sm text-[#5f524c]">Le modifiche valgono per tutte le email generate dopo il salvataggio. I dettagli specifici di ciascun workshop rimangono invariati.</p>
    {FIELDS.map(({key,label,type})=>{
      const v=fields[key];const value=Array.isArray(v)?v.join("\n"):String(v??"");
      const update=(text:string)=>setFields(prev=>({...prev,[key]:type==="number"?Number(text):type==="list"?text.split("\n").map(x=>x.trim()).filter(Boolean):text}));
      return <label key={key} className="block text-sm font-medium">{label}
        {type==="list"||type==="multiline"?
          <textarea rows={type==="list"?4:2} className={inputClass+" mt-1 w-full"} value={value} onChange={e=>update(e.target.value)}/>:
          <input className={inputClass+" mt-1 w-full"} type={type==="number"?"number":"text"} min={type==="number"?0:undefined} value={value} onChange={e=>update(e.target.value)}/>}
      </label>;
    })}
    <button type="button" disabled={pending} className={buttonClass.primary} onClick={()=>startTransition(async()=>{
      const result=await saveEmailDefaultsAction({version,fields});
      if(result.ok){setVersion(result.data.version);setMessage({tone:"success",text:"Impostazioni email salvate."});}
      else setMessage({tone:"error",text:result.error});
    })}>{pending?"Salvataggio…":"Salva impostazioni"}</button>
    {message?<Notice tone={message.tone}>{message.text}</Notice>:null}
  </div>;
}
