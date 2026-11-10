"use client";

import { useRouter } from "next/navigation";
import { useState,useTransition } from "react";
import { setPaperFormAction } from "@/app/gestione/(app)/p/manual-form-actions";

export function PaperFormControl({personId,verified=false,onSaved}:{
  personId:string;verified?:boolean;onSaved?:(message:string)=>void;
}) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [date,setDate]=useState("");
  const [note,setNote]=useState("");
  const [error,setError]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  function save(yes:boolean) {
    setError(null);
    startTransition(async()=>{
      try{
        const result=await setPaperFormAction({personId,verified:yes,
          ...(date?{signedOn:date}:{}),note});
        if(!result.ok){setError(result.error);return;}
        setOpen(false);
        onSaved?.(yes?"Modulo cartaceo confermato. Quota invariata.":"Attestazione cartacea annullata.");
        router.refresh();
      }catch{setError("Salvataggio del modulo non riuscito.");}
    });
  }
  return <div className="min-w-0 space-y-2">
    <button type="button" disabled={pending} onClick={()=>{setOpen(!open);setError(null);}}
      className="min-h-9 rounded-lg border border-[#a8583e]/35 px-3 text-sm font-semibold text-[#a8583e]">
      {verified?"Modulo cartaceo OK · modifica":"+ Modulo cartaceo"}
    </button>
    {open&&<div className="w-full min-w-[240px] max-w-md space-y-3 rounded-xl border border-[#a8583e]/25 bg-[#f8f3ea] p-3 text-sm">
      <p className="font-semibold">Attestazione manuale del modulo</p>
      <p className="text-xs text-[#5f524c]">
        Usa solo se hai verificato una registrazione cartacea originale.
        Non conferma né modifica il pagamento della quota.
      </p>
      <label className="block text-xs font-semibold">
        Data compilazione (facoltativa)
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/15 bg-white px-2"/>
      </label>
      <label className="block text-xs font-semibold">
        Nota sulla verifica (facoltativa)
        <input type="text" maxLength={400} value={note} onChange={e=>setNote(e.target.value)}
          placeholder="Es. modulo cartaceo conservato in archivio"
          className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/15 bg-white px-2"/>
      </label>
      {error&&<p role="alert" className="text-xs text-[#9b2c2c]">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={()=>save(true)}
          className="min-h-10 rounded-lg bg-[#a8583e] px-3 font-semibold text-white disabled:opacity-50">
          {pending?"Salvataggio…":"Conferma modulo"}
        </button>
        {verified&&<button type="button" disabled={pending} onClick={()=>save(false)}
          className="min-h-10 rounded-lg border border-[#211815]/20 px-3 disabled:opacity-50">
          Annulla attestazione
        </button>}
        <button type="button" onClick={()=>setOpen(false)}
          className="min-h-10 px-2 text-[#5f524c] underline">Chiudi</button>
      </div>
    </div>}
  </div>;
}
