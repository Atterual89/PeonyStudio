"use client";
import { useRouter } from "next/navigation";
import { useState,useTransition } from "react";
import { syncHistoricalAssociationMailAction } from "@/app/gestione/(app)/quote-email/actions";

export function HistoricalMailSyncButton(){
  const router=useRouter();
  const [busy,start]=useTransition();
  const [progress,setProgress]=useState("");
  const [result,setResult]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  function run(){
    setError(null);setResult(null);setProgress("Ricerca delle email del 2024…");
    start(async()=>{
      try{
        let scanned=0,found=0,skipped=0,more=false;
        for(let page=0;page<8;page++){
          const response=await syncHistoricalAssociationMailAction();
          if(!response.ok){setError(response.error);setProgress("");return;}
          scanned+=response.data.scanned;found+=response.data.imported;
          skipped+=response.data.skipped;more=response.data.hasMore;
          setProgress("Email controllate: "+scanned+" · candidate nuove: "+found+
            (more?" · Altre email da esaminare…":""));
          if(!more)break;
        }
        setResult("Controllate "+scanned+" notifiche. "+found+" nuovi pagamenti candidati, "+
          skipped+" esclusi dal filtro quote. "+(more?"Premi di nuovo per proseguire.":"Intervallo storico completato."));
        setProgress("");
        router.refresh();
      }catch{
        setError("L'importazione si è interrotta: premi ancora per riprendere dall'ultimo checkpoint.");
        setProgress("");
      }
    });
  }
  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={run}
      className="min-h-10 rounded-xl border border-[#a8583e] bg-white px-4 text-sm font-semibold text-[#a8583e] disabled:opacity-50">
      {busy?"Analisi email in corso…":"Analizza email dal gennaio 2024"}
    </button>
    {progress&&<p role="status" className="text-xs text-[#5f524c]">{progress}</p>}
    {result&&<p role="status" className="text-sm text-[#326941]">{result}</p>}
    {error&&<p role="alert" className="text-sm text-[#9b2c2c]">{error}</p>}
    <p className="text-xs text-[#5f524c]">
      Cerca notifiche PayPal e Qonto in blocchi, evita i duplicati e conserva
      il punto raggiunto. Le quote vengono soltanto proposte per revisione,
      mai assegnate automaticamente.
    </p>
  </div>;
}
