"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { syncTicketTailorPageFromGestionale } from "@/app/gestione/(app)/peony/sync/actions";

/** Una richiesta per pagina: il browser continua finché gli ordini sono
 * esauriti. Il server non deve elaborare l'intera box office in una volta. */
export function SyncTicketTailorButton({eventId=null}:{eventId?:string|null}) {
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const [progress,setProgress]=useState<string|null>(null);
  const [result,setResult]=useState<{ok:boolean;text:string}|null>(null);

  function sync(){
    setResult(null);setProgress(null);
    startTransition(async()=>{
      let events=0,orders=0,tickets=0,warnings=0;
      let cursor:string|null=null;
      const seen=new Set<string>();
      const partial=()=> orders||tickets
        ? ` Finora salvati: ${orders} ordini, ${tickets} biglietti.` : "";
      for(let page=1;page<=100;page++){
        setProgress(`Aggiornamento Ticket Tailor · pagina ${page}. ${tickets} biglietti salvati.`);
        try{
          const response=await syncTicketTailorPageFromGestionale(eventId,cursor,page===1);
          if(!response.ok){
            setResult({ok:false,text:response.message+partial()});
            setProgress(null);router.refresh();return;
          }
          events+=response.events;orders+=response.orders;tickets+=response.tickets;warnings+=response.warnings;
          if(!response.nextCursor){
            setResult({ok:true,text:`Sincronizzazione completata: ${orders} ordini e ${tickets} biglietti aggiornati${eventId?" per questo evento":` (più ${events} eventi)`}.${warnings?` Avvisi: ${warnings}.`:""}`});
            setProgress(null);router.refresh();return;
          }
          if(response.nextCursor===cursor||seen.has(response.nextCursor)){
            setResult({ok:false,text:"Paginazione Ticket Tailor ripetuta. Sincronizzazione fermata per sicurezza."+partial()});
            setProgress(null);router.refresh();return;
          }
          seen.add(response.nextCursor);
          cursor=response.nextCursor;
        }catch{
          setResult({ok:false,text:
            "La richiesta al server si è interrotta. Controlla i dati già aggiornati e i log della funzione di hosting prima di riprovare."+partial()});
          setProgress(null);router.refresh();return;
        }
      }
      setResult({ok:false,text:"Raggiunto il limite di 100 pagine; controllo da completare. I dati già salvati restano disponibili."+partial()});
      setProgress(null);router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={sync} disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#a8583e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#923e2b] disabled:cursor-wait disabled:opacity-65 sm:w-auto">
        <RefreshCw className={`h-4 w-4 ${pending?"animate-spin":""}`} aria-hidden="true"/>
        {pending?"Sincronizzazione in corso…":"Sincronizza Ticket Tailor"}
      </button>
      {pending&&progress?<p role="status" className="text-xs text-[#5f524c]">{progress}</p>:null}
      {result?(
        <div role={result.ok?"status":"alert"} className={`rounded-xl border p-3 text-sm ${result.ok
          ?"border-[#326941]/30 bg-white/75 text-[#326941]"
          :"border-[#9b4b1e]/30 bg-[#f3e8d4] text-[#733a18]"}`}>
          {result.text}
        </div>
      ):null}
    </div>
  );
}
