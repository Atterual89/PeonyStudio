"use client";

import { useEffect, useState, useTransition } from "react";
import {
  importBillingFileAction, listBillingDirectoryAction, previewBillingFileAction, resolveBillingReviewAction,
  type BillingEntry, type BillingReview,
} from "@/app/gestione/(app)/anagrafica/billing-actions";

type Preview = { headers:string[]; sample:string[][]; total:number; suggest:{first:string;last:string;email:string} };

export function BillingDirectoryManager() {
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [first,setFirst]=useState("");
  const [last,setLast]=useState("");
  const [email,setEmail]=useState("");
  const [people,setPeople]=useState<BillingEntry[]>([]);
  const [reviews,setReviews]=useState<BillingReview[]>([]);
  const [filter,setFilter]=useState("");
  const [opened,setOpened]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [pending,startTransition]=useTransition();
  const [reviewChoice,setReviewChoice]=useState<{reviewId:string;personId:string|null}|null>(null);
  async function reload() {
    const res=await listBillingDirectoryAction();
    if(res.ok){setPeople(res.data.people);setReviews(res.data.reviews);}
    else setMessage(res.error);
  }
  useEffect(()=>{void reload();},[]);
  function inspect(){
    if(!file)return;
    setMessage("");
    startTransition(async()=>{
      const form=new FormData();form.set("file",file);
      const res=await previewBillingFileAction(form);
      if(!res.ok){setMessage(res.error);return;}
      setPreview(res.data);setFirst(res.data.suggest.first);
      setLast(res.data.suggest.last);setEmail(res.data.suggest.email);
    });
  }
  function importFile(){
    if(!file||!preview||first===""||last===""||first===last){setMessage("Seleziona due colonne distinte per nome e cognome.");return;}
    setMessage("");
    startTransition(async()=>{
      const form=new FormData();
      form.set("file",file);form.set("first",first);form.set("last",last);form.set("email",email);
      const res=await importBillingFileAction(form);
      if(!res.ok){setMessage(res.error);return;}
      setMessage("Importazione completata: "+res.data.created+" nuove, "+res.data.matched+" collegate, "+res.data.review+" da rivedere, "+res.data.skipped+" saltate.");
      setFile(null);setPreview(null);
      await reload();
    });
  }
  function resolve(id:string,personId:string|null){setReviewChoice({reviewId:id,personId});}
  function commitReview(){
    if(!reviewChoice)return;
    const choice=reviewChoice;
    setMessage("");
    startTransition(async()=>{
      const res=await resolveBillingReviewAction({reviewId:choice.reviewId,personId:choice.personId});
      if(!res.ok){setMessage(res.error);return;}
      setReviewChoice(null);
      setMessage("Abbinamento salvato.");
      await reload();
    });
  }
  const filtered=people.filter(p=>(p.name+" "+p.email).toLowerCase().includes(filter.trim().toLowerCase()));
  return <div className="space-y-4">
    <section className="space-y-3 rounded-xl border border-[#211815]/15 bg-white p-3">
      <h2 className="font-semibold">Importa anagrafica per fatture</h2>
      <p className="text-xs text-[#5f524c]">Excel .xlsx o CSV, massimo 3 MB / 1000 righe. Il file non viene conservato: rimangono soltanto i dati delle persone.</p>
      <input type="file" accept=".xlsx,.csv,.tsv" className="block w-full text-sm" onChange={e=>{
        setFile(e.target.files?.[0]||null);setPreview(null);setMessage("");
      }}/>
      {file&&<button type="button" disabled={pending} className="rounded-lg border border-[#a8583e] px-3 py-2 text-sm font-semibold" onClick={inspect}>
        {pending?"Lettura…":"Leggi colonne"}
      </button>}
      {preview&&<div className="space-y-3 border-t border-[#211815]/10 pt-3">
        <p className="text-sm font-semibold">{preview.total} righe trovate</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {([["first","Nome",first,setFirst],["last","Cognome",last,setLast],["email","Email (facoltativa)",email,setEmail]] as const).map(([key,label,value,setter])=>
            <label key={key} className="text-sm font-medium">{label}
              <select className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/20 px-2" value={value}
                onChange={e=>setter(e.target.value)}>
                <option value="">Non selezionata</option>
                {preview.headers.map((h,i)=><option key={i} value={String(i)}>{h}</option>)}
              </select>
            </label>)}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead><tr>{preview.headers.slice(0,10).map((h,i)=><th key={i} className="border-b px-2 py-1">{h}</th>)}</tr></thead>
            <tbody>{preview.sample.map((r,i)=><tr key={i}>{preview.headers.slice(0,10).map((_,j)=>
              <td key={j} className="border-b px-2 py-1">{r[j]||"—"}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-[#5f524c]">Le altre colonne, compresi gli eventuali dati fiscali, saranno mantenute nella scheda senza modificare i dati associativi.</p>
        <button type="button" disabled={pending||first===""||last===""||first===last}
          className="min-h-10 rounded-lg bg-[#a8583e] px-4 text-sm font-semibold text-white disabled:opacity-50"
          onClick={importFile}>{pending?"Importazione…":"Conferma importazione"}</button>
      </div>}
    </section>
    {message&&<p role="status" className="rounded-lg bg-[#f2ede3] p-3 text-sm">{message}</p>}
    {reviews.length>0&&<section className="space-y-2">
      <h2 className="font-semibold">Da rivedere ({reviews.length})</h2>
      <p className="text-xs text-[#5f524c]">Nessun omonimo viene collegato senza conferma.</p>
      {reviews.map(review=><div key={review.id} className="rounded-lg border border-amber-500/40 bg-white p-3 space-y-2">
        <p className="font-semibold">{review.name}</p>
        <p className="text-xs text-[#5f524c]">{review.reason==="duplicato_file"?"Ripetuto nel file":"Più persone con lo stesso nome"}{review.email?" · "+review.email:""}</p>
        <div className="flex flex-wrap gap-2">
          {review.candidates.map(c=><button key={c.id} disabled={pending} onClick={()=>resolve(review.id,c.id)}
            className="rounded-lg border px-3 py-2 text-sm">Collega a {c.name}</button>)}
          <button disabled={pending} onClick={()=>resolve(review.id,null)} className="rounded-lg border px-3 py-2 text-sm">
            Crea scheda distinta
          </button>
        </div>
        {reviewChoice?.reviewId===review.id&&<div className="rounded-lg bg-[#f2ede3] p-2 text-sm">
          <p>Confermi {reviewChoice.personId?"l\'abbinamento":"la creazione di una nuova scheda"} per {review.name}?</p>
          <div className="mt-2 flex gap-3">
            <button type="button" disabled={pending} onClick={commitReview} className="font-semibold text-[#a8583e] underline">Conferma</button>
            <button type="button" disabled={pending} onClick={()=>setReviewChoice(null)} className="underline">Annulla</button>
          </div>
        </div>}
      </div>)}
    </section>}
    <section className="space-y-2">
      <h2 className="font-semibold">Anagrafica fatture ({people.length})</h2>
      <input type="search" value={filter} onChange={e=>setFilter(e.target.value)}
        placeholder="Cerca nome, cognome o email" className="min-h-10 w-full rounded-lg border border-[#211815]/20 bg-white px-3 text-sm"/>
      <ul className="divide-y rounded-xl border border-[#211815]/10 bg-white">
        {filtered.slice(0,100).map(p=><li key={p.id} className="p-3">
          <button type="button" onClick={()=>setOpened(opened===p.id?null:p.id)} className="w-full text-left">
            <span className="block font-semibold">{p.name}</span>
            <span className="block text-xs text-[#5f524c]">{p.email||"Dati di fatturazione"} · {opened===p.id?"Nascondi":"Mostra dettagli"}</span>
          </button>
          {opened===p.id&&p.fields&&<dl className="mt-2 grid gap-1 border-t pt-2 text-sm sm:grid-cols-2">
            {Object.entries(p.fields).filter(([k])=>!k.startsWith("__")).map(([key,value])=>
              <div key={key}><dt className="text-xs text-[#5f524c]">{key}</dt><dd className="break-words">{String(value)}</dd></div>)}
          </dl>}
        </li>)}
      </ul>
      {filtered.length>100&&<p className="text-xs text-[#5f524c]">Mostrate le prime 100 persone. Usa la ricerca per restringere.</p>}
    </section>
  </div>;
}
