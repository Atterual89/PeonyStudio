"use client";

import { useState, useTransition } from "react";
import { saveEmailDefaultsAction } from "@/app/gestione/(app)/w/email-actions";
import { buttonClass, inputClass, Notice } from "./ui";

const FIELDS = [
  ["location","Indirizzo dello studio"],
  ["intercom","Citofono"],
  ["mapsUrl","Link Google Maps"],
  ["membershipFormUrl","Modulo associazione"],
  ["membershipFeeEuro","Quota associativa (€)"],
  ["signature","Firma"],
] as const;

export function EmailDefaultsForm({initial,initialVersion}:{initial:Record<string,string|number>;initialVersion:number}) {
  const [fields,setFields]=useState(initial);
  const [version,setVersion]=useState(initialVersion);
  const [pending,startTransition]=useTransition();
  const [message,setMessage]=useState<{tone:"success"|"error";text:string}|null>(null);
  return <div className="mt-4 max-w-xl space-y-3">
    <p className="text-sm text-[#5f524c]">Questi valori sono proposti nei nuovi workshop. I dati già personalizzati di un workshop restano invariati.</p>
    {FIELDS.map(([key,label])=><label key={key} className="block text-sm font-medium">{label}
      <input className={inputClass+" mt-1 w-full"} type={key==="membershipFeeEuro"?"number":"text"}
        value={String(fields[key]??"")} onChange={e=>setFields(prev=>({...prev,[key]:key==="membershipFeeEuro"?Number(e.target.value):e.target.value}))}/>
    </label>)}
    <button type="button" disabled={pending} className={buttonClass.primary} onClick={()=>startTransition(async()=>{
      const result=await saveEmailDefaultsAction({version,fields});
      if(result.ok){setVersion(result.data.version);setMessage({tone:"success",text:"Impostazioni email salvate."});}
      else setMessage({tone:"error",text:result.error});
    })}>{pending?"Salvataggio…":"Salva impostazioni"}</button>
    {message?<Notice tone={message.tone}>{message.text}</Notice>:null}
  </div>;
}
