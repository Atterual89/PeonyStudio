"use client";
import { useRouter } from "next/navigation";
import { useState,useTransition } from "react";
import { syncHistoricalAssociationMailAction } from "@/app/gestione/(app)/quote-email/actions";

export function HistoricalMailSyncButton({initialHasMore=false}:{initialHasMore?:boolean}){
  const router=useRouter();
  const [busy,start]=useTransition();
  const [result,setResult]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [hasMore,setHasMore]=useState(initialHasMore);

  function run(){
    setError(null);
    setResult(null);
    // Un SOLO blocco per clic. Prima erano otto richieste consecutive:
    // su Gmail questo può esaurire il limite per utente.
    start(async()=>{
      try{
        const response=await syncHistoricalAssociationMailAction();
        if(!response.ok){
          setError(response.error);
          return;
        }
        const {scanned,imported,skipped,hasMore:more}=response.data;
        setHasMore(more);
        setResult(
          `Notifiche controllate: ${scanned} · nuovi pagamenti candidati: ${imported}`+
          ` · non pertinenti: ${skipped}. `+
          (more?"Puoi proseguire con il prossimo blocco.":"Intervallo completato.")
        );
        router.refresh();
      }catch{
        setError("Lettura interrotta. I dati già importati restano salvati; riprova più tardi.");
      }
    });
  }
  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={run}
      className="min-h-10 rounded-xl border border-[#a8583e] bg-white px-4 text-sm font-semibold text-[#a8583e] disabled:opacity-50">
      {busy?"Controllo Gmail in corso…":hasMore?"Prosegui analisi email":"Analizza email dal settembre 2025"}
    </button>
    {result&&<p role="status" className="text-sm text-[#326941]">{result}</p>}
    {error&&<p role="alert" className="text-sm text-[#9b2c2c]">{error}</p>}
    <p className="text-xs text-[#5f524c]">
      Controlla un piccolo blocco per volta, conserva il punto raggiunto ed evita
      di duplicare pagamenti. La revisione non assegna automaticamente le quote.
    </p>
  </div>;
}
