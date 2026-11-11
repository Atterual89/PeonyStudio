"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { confirmReviewedGoogleFormAction, consolidateIdenticalGoogleFormsAction } from "@/app/gestione/(app)/altro/soci/revisione/actions";
import type { FormReviewCase,FormReviewKind } from "@/lib/gestionale/google-form-review";

const kinds:Record<FormReviewKind,string>={
  new:"Nuovi moduli",duplicate:"Duplicati",homonym:"Omonimi / email diverse",
  missing_form:"Quota senza modulo",changed:"Dati modificati",
};
const filters:Array<{value:"all"|FormReviewKind;label:string}>=[
  {value:"all",label:"Tutte"},
  ...Object.entries(kinds).map(([value,label])=>({value:value as FormReviewKind,label})),
];

export function GoogleFormsReview({cases,readCount}:{cases:FormReviewCase[];readCount:number}){
  const router=useRouter();
  const [filter,setFilter]=useState<"all"|FormReviewKind>("all");
  const [index,setIndex]=useState(0);
  const [approved,setApproved]=useState<string[]>([]);
  const [deferred,setDeferred]=useState<string[]>([]);
  const [feedback,setFeedback]=useState<{kind:"error"|"success";text:string}|null>(null);
  const [confirmConsolidateFor,setConfirmConsolidateFor]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const visible=useMemo(()=>cases.filter(c=>
    !approved.includes(c.id)&&!deferred.includes(c.id)&&
    (filter==="all"||c.kind===filter)),[cases,approved,deferred,filter]);
  const current=visible[Math.min(index,Math.max(0,visible.length-1))];
  const counter=(kind:FormReviewKind)=>cases.filter(c=>c.kind===kind&&!approved.includes(c.id)&&!deferred.includes(c.id)).length;
  function chooseFilter(next:"all"|FormReviewKind){setFilter(next);setIndex(0);setFeedback(null);setConfirmConsolidateFor(null);}
  function go(step:number){setIndex(old=>Math.max(0,Math.min(visible.length-1,old+step)));setFeedback(null);setConfirmConsolidateFor(null);}
  function defer(){
    if(!current)return;
    setDeferred(old=>[...old,current.id]);
    setIndex(0);setFeedback(null);setConfirmConsolidateFor(null);
  }
  function consolidate(){
    if(!current||current.kind!=="duplicate"||!current.sourceRowId)return;
    if(confirmConsolidateFor!==current.sourceRowId)return;
    setConfirmConsolidateFor(null);
    setFeedback(null);
    startTransition(async()=>{
      try{
        const result=await consolidateIdenticalGoogleFormsAction(current.sourceRowId!);
        if(!result.ok){setFeedback({kind:"error",text:result.error});return;}
        setApproved(old=>[...old,current.id]);setIndex(0);
        setFeedback({kind:"success",text:result.message});router.refresh();
      }catch{
        setFeedback({kind:"error",text:"Consolidamento non riuscito. Nessun dato modificato."});
      }
    });
  }
  function confirm(){
    if(!current?.canConfirm||!current.sourceRowId||!current.sourceHash)return;
    setFeedback(null);
    startTransition(async()=>{
      try{
        const result=await confirmReviewedGoogleFormAction(current.sourceRowId!,current.sourceHash!);
        if(!result.ok){setFeedback({kind:"error",text:result.error});return;}
        setApproved(old=>[...old,current.id]);setIndex(0);
        setFeedback({kind:"success",text:result.message});router.refresh();
      }catch{
        setFeedback({kind:"error",text:"La conferma non è riuscita: non ripetere senza verificare la scheda."});
      }
    });
  }
  return <section className="space-y-3" aria-label="Revisione moduli e anagrafiche">
    <div className="rounded-xl border border-[#211815]/10 bg-white/80 p-3">
      <p className="font-semibold">Moduli letti: {readCount} · Casi da verificare: {cases.length}</p>
      <p className="mt-1 text-xs text-[#5f524c]">
        Nessun accorpamento o pagamento viene confermato automaticamente.
        I casi rinviati rimarranno da controllare al prossimo accesso.
      </p>
      <label className="mt-3 block max-w-sm text-xs font-semibold text-[#5f524c]">
        Filtra le incongruenze
        <select value={filter} onChange={event=>chooseFilter(event.target.value as "all"|FormReviewKind)}
          className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/20 bg-white px-3 text-sm">
          {filters.map(item=><option key={item.value} value={item.value}>
            {item.label} ({item.value==="all"?cases.length-approved.length-deferred.length:counter(item.value)})
          </option>)}
        </select>
      </label>
    </div>
    {feedback&&<p role={feedback.kind==="error"?"alert":"status"} className={`rounded-lg border p-3 text-sm ${feedback.kind==="error"?"border-[#a8583e]/35 text-[#9b2c2c]":"border-[#326941]/35 text-[#326941]"}`}>{feedback.text}</p>}
    {current?<div className="space-y-3 rounded-xl border border-[#211815]/15 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5f524c]">
        <strong className="rounded-lg bg-[#f2e9d9] px-2 py-1 text-[#915539]">{kinds[current.kind]}</strong>
        <span>{Math.min(index+1,visible.length)} di {visible.length} nel filtro</span>
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-xl">{current.name}</h2>
        {current.email&&<p className="break-all text-sm">{current.email}</p>}
        {current.sourceRowId&&<p className="text-xs text-[#5f524c]">Modulo Google: {current.sourceRowId}</p>}
        {current.relatedRecords>1&&<p className="text-xs text-[#9b4b1e]">Record da confrontare: {current.relatedRecords}</p>}
      </div>
      <p className="text-sm text-[#5f524c]">{current.explanation}</p>
      {current.differences.length>0&&<div className="rounded-lg border border-[#211815]/10 p-3">
        <p className="mb-2 text-sm font-semibold">Differenze da verificare</p>
        <div className="space-y-2">
          {current.differences.map(change=><div key={change.label} className="grid gap-1 border-b border-[#211815]/10 pb-2 text-xs sm:grid-cols-[120px_1fr_1fr]">
            <strong>{change.label}</strong>
            <span className="break-all text-[#6d5c54]">Prima: {change.before}</span>
            <span className="break-all text-[#326941]">Google: {change.after}</span>
          </div>)}
        </div>
      </div>}
      {current.kind==="changed"&&current.differences.length===0&&
        <p className="text-xs text-[#5f524c]">Differenza tecnica nella versione della registrazione; i campi principali non sono cambiati.</p>}
      {current.evidence.length>0&&<details className="rounded-lg border border-[#211815]/10 bg-[#fcfaf5] p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Confronta le fonti · {current.evidence.length}
        </summary>
        <div className="mt-2 space-y-2">
          {current.evidence.map((row,i)=><div key={row.id+"-"+i}
            className="rounded-lg border border-[#211815]/10 bg-white p-2 text-xs">
            <p className="font-semibold">{row.source} · {row.name} {current.kind==="duplicate"?`· Copia ${i+1}`:""}</p>
            {row.email&&<p className="break-all">{row.email}</p>}
            <p className="text-[#5f524c]">Stato: {row.status??"non disponibile"}{row.expiresAt?` · Scadenza registrata: ${row.expiresAt.split("-").reverse().join("/")}`:""}</p>
          </div>)}
        </div>
      </details>}
      {current.candidates.length>0&&<div className="space-y-2 rounded-lg bg-[#f8f3ea] p-3">
        <p className="text-sm font-semibold">Anagrafiche potenzialmente corrispondenti</p>
        {current.candidates.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#211815]/10 bg-white p-2 text-sm">
          <div><strong>{p.name}</strong>{p.email&&<p className="break-all text-xs">{p.email}</p>}</div>
          <Link prefetch={false} className="text-[#a8583e] underline" href={`/gestione/p/${p.id}`}>Apri / modifica</Link>
        </div>)}
        {current.candidates.length>1&&<Link prefetch={false}
          className="inline-flex rounded-lg border border-[#a8583e]/35 px-3 py-2 text-sm font-semibold text-[#a8583e]"
          href={`/gestione/p/${current.candidates[0].id}/unisci/${current.candidates[1].id}`}>
          Valuta accorpamento delle prime due schede
        </Link>}
      </div>}
      <div className="flex flex-wrap gap-2">
        {current.kind==="duplicate"&&current.sourceRowId&&<button type="button" disabled={pending} onClick={()=>setConfirmConsolidateFor(current.sourceRowId!)}
          className="min-h-10 rounded-lg bg-[#a8583e] px-4 text-sm font-semibold text-white disabled:opacity-50">
          {pending?"Controllo in corso…":"Consolida versioni della stessa risposta"}
        </button>}
        {current.canConfirm&&current.sourceHash&&<button type="button" disabled={pending} onClick={confirm}
          className="min-h-10 rounded-lg bg-[#a8583e] px-4 text-sm font-semibold text-white disabled:opacity-50">
          {pending?"Conferma in corso…":"Conferma questo modulo"}
        </button>}
        <Link prefetch={false} className="inline-flex min-h-10 items-center rounded-lg border border-[#a8583e]/30 px-3 text-sm font-semibold text-[#a8583e]"
          href={`/gestione/persone?q=${encodeURIComponent((current.email||current.name).slice(0,100))}`}>
          Cerca / collega in Persone
        </Link>
        <button type="button" disabled={pending} onClick={defer}
          className="min-h-10 rounded-lg border border-[#211815]/15 px-3 text-sm text-[#5f524c] disabled:opacity-50">
          Rinvia
        </button>
      </div>
      {current.kind==="duplicate"&&current.sourceRowId&&confirmConsolidateFor===current.sourceRowId&&<div className="space-y-2 rounded-lg border border-[#a8583e]/30 bg-[#fcfaf5] p-3 text-sm">
        <p>Confrontare con il modulo Google attuale e archiviare le copie precedenti? Se i dati personali differiscono, il consolidamento sarà bloccato.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={consolidate} className="rounded-lg bg-[#a8583e] px-3 py-2 font-semibold text-white disabled:opacity-50">Conferma consolidamento</button>
          <button type="button" disabled={pending} onClick={()=>setConfirmConsolidateFor(null)} className="rounded-lg border px-3 py-2">Annulla</button>
        </div>
      </div>}
      <div className="flex items-center justify-between border-t border-[#211815]/10 pt-3">
        <button disabled={index===0||pending} onClick={()=>go(-1)} className="text-sm underline disabled:opacity-40">Precedente</button>
        <button disabled={index>=visible.length-1||pending} onClick={()=>go(1)} className="text-sm underline disabled:opacity-40">Successivo</button>
      </div>
    </div>:<div className="rounded-xl border border-[#326941]/20 bg-white p-4">
      <p className="font-semibold">Nessun altro caso in questo filtro.</p>
      <p className="mt-1 text-sm text-[#5f524c]">
        Approvati in questa sessione: {approved.length}. Rinviati: {deferred.length}.
        I rinviati non sono considerati risolti e riappariranno dopo una nuova lettura.
      </p>
    </div>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>router.refresh()}
        className="rounded-lg border border-[#211815]/15 px-3 py-2 text-sm">Ricarica i dati</button>
      <Link prefetch={false} href="/gestione/altro/soci?quote=1#quote-email"
        className="rounded-lg border border-[#a8583e]/35 px-3 py-2 text-sm text-[#a8583e]">
        Vai alle quote
      </Link>
    </div>
  </section>;
}
