"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmAssociationPaymentAction, findPaymentPeopleAction, ignoreAssociationPaymentAction } from "@/app/gestione/(app)/quote-email/actions";

type Person = {kind:"person"|"member";id:string;name:string;email:string|null;source:string};
type Payment = {id:string;provider:string;payer_name:string|null;amount_cents:number;note:string|null;paid_at:string;availableSlots:number;slots:number[];suggested:{id:string;name:string}|null};
export function PaymentEmailReview({payments,periods,defaultPeriod}:{
 payments:Payment[];periods:{from:string;label:string}[];defaultPeriod:string
}){
 const router=useRouter();
 const [busy,start]=useTransition();
 const [search,setSearch]=useState<Record<string,string>>({});
 const [results,setResults]=useState<Record<string,Person[]>>({});
 const [message,setMessage]=useState("");
 const [periodFrom,setPeriodFrom]=useState(defaultPeriod);
 function lookup(id:string){
  start(async()=>{try{const found=await findPaymentPeopleAction(search[id]||"");setResults(s=>({...s,[id]:found}));}
   catch{setMessage("Ricerca persone non riuscita.");}});
 }
 function assign(paymentId:string,target:{kind:"person"|"member";id:string}){
  start(async()=>{const r=await confirmAssociationPaymentAction(paymentId,target,periodFrom);
   setMessage(r.ok?"Quota verificata.":r.error);router.refresh();});
 }
 function ignore(paymentId:string){
  start(async()=>{const r=await ignoreAssociationPaymentAction(paymentId);
   setMessage(r.ok?"Pagamento ignorato.":r.error);router.refresh();});
 }
 return <div className="space-y-4">
  {message&&<p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
  <div className="flex flex-wrap items-center gap-2 text-sm">
   <label htmlFor="quota-periodo" className="font-semibold">Periodo associativo della quota:</label>
   <select id="quota-periodo" className="rounded-lg border p-2" value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)}>
    {periods.map(period=><option key={period.from} value={period.from}>{period.label}</option>)}
   </select>
  </div>
  <h2 className="font-semibold">Pagamenti da associare ({payments.length})</h2>
  {payments.length===0&&<p className="text-sm text-[#5f524c]">Nessun pagamento in attesa nei risultati caricati.</p>}
  {payments.map(p=><section key={p.id} className="rounded-xl border border-[#211815]/15 bg-white p-4 space-y-2">
   <div className="flex justify-between gap-2">
    <strong>{p.provider.toUpperCase()} · {(p.amount_cents/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"})}</strong>
    <span className="text-xs text-[#5f524c]">{new Date(p.paid_at).toLocaleDateString("it-IT")}</span>
   </div>
   <p className="text-sm">{p.payer_name||"Pagante non riconosciuto"}</p>
   {p.note&&<p className="text-xs text-[#5f524c]">Messaggio: {p.note}</p>}
   <p className="text-xs text-[#5f524c]">Quote assegnate: {p.slots.length}/{p.availableSlots}</p>
   {p.suggested&&p.slots.length<p.availableSlots&&<div className="flex items-center justify-between gap-2 rounded-lg bg-[#f6f1e9] p-2 text-sm">
    <span>Persona proposta: <strong>{p.suggested.name}</strong></span>
    <button type="button" disabled={busy} className="rounded-lg bg-[#a8583e] px-3 py-2 text-white disabled:opacity-50"
      onClick={()=>assign(p.id,{kind:"person",id:p.suggested!.id})}>Conferma</button>
   </div>}
   <div className="flex gap-2">
    <input className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="Nome, nickname o email nel libro persone"
      aria-label={`Cerca persona per ${p.payer_name||p.id}`}
      value={search[p.id]||""} onChange={e=>setSearch(s=>({...s,[p.id]:e.target.value}))}/>
    <button type="button" disabled={busy||(search[p.id]||"").trim().length<2}
      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>lookup(p.id)}>Cerca</button>
   </div>
   {(results[p.id]||[]).map(person=><div key={person.kind+person.id} className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
    <span className="min-w-0"><strong className="block">{person.name}</strong>
      <small className="block text-[#5f524c]">{person.source}{person.email?` · ${person.email}`:""}</small></span>
    <button type="button" disabled={busy} className="rounded-lg bg-[#a8583e] px-3 py-2 text-white disabled:opacity-50"
      onClick={()=>assign(p.id,{kind:person.kind,id:person.id})}>Associa quota</button>
   </div>)}
   {p.slots.length===0&&<button type="button" disabled={busy} onClick={()=>ignore(p.id)}
     className="text-xs text-[#5f524c] underline disabled:opacity-50">Non è una quota · Ignora</button>}
  </section>)}
 </div>;
}
