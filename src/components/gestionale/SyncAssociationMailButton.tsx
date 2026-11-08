"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, RefreshCw } from "lucide-react";
import { syncAssociationMailAction } from "@/app/gestione/(app)/quote-email/actions";

export function SyncAssociationMailButton({configured,connected,lastSync,missing}:{
 configured:boolean;connected:boolean;lastSync:string|null;missing:readonly string[]
}){
 const router=useRouter();
 const [busy,start]=useTransition();
 const [result,setResult]=useState<{ok:boolean;message:string}|null>(null);
 function sync(){
  if(busy)return;
  setResult(null);
  start(async()=>{
   try{
    let scanned=0,imported=0,hasMore=false;
    for(let page=0;page<30;page++){
     const response=await syncAssociationMailAction();
     if(!response.ok){
      setResult({ok:false,message:response.error});router.refresh();return;
     }
     scanned+=response.data.scanned;
     imported+=response.data.imported;
     hasMore=response.data.hasMore;
     if(!hasMore)break;
    }
    setResult({ok:true,message:`Email controllate: ${scanned} · Pagamenti da verificare: ${imported}${hasMore?" · Altre email da controllare: premi di nuovo il pulsante.":""}`});
    router.refresh();
   }catch{
    setResult({ok:false,message:"Controllo Gmail interrotto. Ripremi per riprendere dall'ultimo punto salvato."});
   }
  });
 }
 return <div className="min-w-0 space-y-1">
  {connected?
   <button type="button" disabled={busy} onClick={sync}
    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8583e] bg-white/85 px-4 text-sm font-semibold text-[#a8583e] disabled:opacity-60 sm:w-auto">
    <RefreshCw aria-hidden="true" className={`h-4 w-4 ${busy?"animate-spin":""}`}/>
    {busy?"Controllo email…":"Sincronizza email quote"}
   </button>
   :configured?
    <a href="/api/gestione/gmail/start"
     className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#a8583e] bg-white/85 px-4 text-sm font-semibold text-[#a8583e] sm:w-auto">
     <MailCheck aria-hidden="true" className="h-4 w-4"/>Collega Gmail
    </a>
   :<span className="inline-flex min-h-10 items-center rounded-xl border border-[#9b4b1e]/30 px-3 text-xs text-[#9b4b1e]">
      Gmail non configurato nell'hosting
    </span>}
  {result&&<p role={result.ok?"status":"alert"} className={`max-w-sm text-xs ${result.ok?"text-[#326941]":"text-[#9b4b1e]"}`}>
   {result.message}
   {result.ok&&<a href="/gestione/altro/soci#quote-email" className="ml-1 underline">Controlla quote</a>}
  </p>}
  {!result&&lastSync&&<p className="text-xs text-[#5f524c]">
   Ultimo controllo: {new Date(lastSync).toLocaleDateString("it-IT")}
  </p>}
 </div>;
}
