"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { syncOfficialBookAction } from "@/app/gestione/(app)/soci/sync/actions";

/** Legge SOLO la copia Google del libro soci Team Artist, su richiesta. */
export function SyncOfficialBookButton() {
  const router=useRouter();
  const [busy,startTransition]=useTransition();
  const [message,setMessage]=useState<{ok:boolean;text:string}|null>(null);
  return <div className="min-w-0 space-y-2">
    <button type="button" disabled={busy} onClick={()=>{
      setMessage(null);
      startTransition(async()=>{
        try{
          const result=await syncOfficialBookAction();
          if(!result.ok){
            setMessage({ok:false,text:result.message});
            return;
          }
          const unchanged=result.created===0&&result.updated===0;
          setMessage({ok:true,text:unchanged
            ?`Libro soci già allineato (${result.rows} registrazioni).`
            :`Libro soci allineato: ${result.created} nuove, ${result.updated} aggiornate. Nessuna cancellazione.`});
          router.refresh();
        }catch{
          setMessage({ok:false,text:"Lettura del libro soci non completata. I dati già salvati restano disponibili."});
        }
      });
    }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8583e] bg-white/85 px-4 text-sm font-semibold text-[#a8583e] disabled:opacity-60 sm:w-auto">
      <BookOpenCheck aria-hidden="true" className={`h-4 w-4 ${busy?"animate-pulse":""}`}/>
      {busy?"Allineamento libro soci…":"Allinea libro soci"}
    </button>
    {message&&<p role={message.ok?"status":"alert"} className={`max-w-sm rounded-lg border p-2 text-xs ${message.ok
      ?"border-[#326941]/25 bg-white text-[#326941]"
      :"border-[#9b4b1e]/25 bg-[#fff4e7] text-[#733a18]"}`}>{message.text}</p>}
  </div>;
}
