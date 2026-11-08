"use client";
import { useState, useTransition } from "react";
import { confirmAssociationPaymentAction, findPaymentPeopleAction, ignoreAssociationPaymentAction } from "@/app/gestione/(app)/quote-email/actions";

type Person = {kind:"person"|"member";id:string;name:string;email:string|null;source:string};
type Payment = {id:string;provider:string;payer_name:string|null;amount_cents:number;note:string|null;paid_at:string;availableSlots:number;slots:number[];suggested:{id:string;name:string}|null};
type SavedQuota = {name:string;period:string;slot:number};
type Notice = {tone:"error"|"success";text:string};

export function PaymentEmailReview({payments,periods,defaultPeriod}:{
 payments:Payment[];periods:{from:string;label:string}[];defaultPeriod:string
}){
 const [pending,start]=useTransition();
 const [working,setWorking]=useState<string|null>(null);
 const [searching,setSearching]=useState<string|null>(null);
 const [search,setSearch]=useState<Record<string,string>>({});
 const [results,setResults]=useState<Record<string,Person[]>>({});
 const [feedback,setFeedback]=useState<Record<string,Notice>>({});
 const [saved,setSaved]=useState<Record<string,SavedQuota[]>>({});
 const [ignored,setIgnored]=useState<Record<string,boolean>>({});
 const [periodByPayment,setPeriodByPayment]=useState<Record<string,string>>({});
 const [lastConfirmed,setLastConfirmed]=useState<string|null>(null);
 const periodFor=(id:string)=>periodByPayment[id]??defaultPeriod;
 const periodLabel=(from:string)=>periods.find(p=>p.from===from)?.label??from;
 const blocked=pending||Boolean(working)||Boolean(searching);
 const setError=(id:string,text:string)=>setFeedback(prev=>({...prev,[id]:{tone:"error",text}}));

 function lookup(id:string){
  if(blocked)return;
  const query=search[id]||"";
  setSearching(id);
  setFeedback(prev=>{const next={...prev};delete next[id];return next;});
  start(async()=>{
   try {
    const found=await findPaymentPeopleAction(query);
    setResults(prev=>({...prev,[id]:found}));
    if(found.length===0)setError(id,"Nessuna persona trovata. Prova con il cognome, il nickname o l'email.");
   }catch{setError(id,"Ricerca persone non riuscita. Riprova.");}
   finally{setSearching(null);}
  });
 }

 function assign(paymentId:string,target:{kind:"person"|"member";id:string},name:string){
  if(blocked)return;
  const from=periodFor(paymentId);
  setWorking(paymentId);
  setFeedback(prev=>{const next={...prev};delete next[paymentId];return next;});
  start(async()=>{
   try {
    const result=await confirmAssociationPaymentAction(paymentId,target,from);
    if(!result.ok){setError(paymentId,result.error);return;}
    // Il server ha controllato anche la presenza dell'assegnazione nel database.
    setSaved(prev=>({...prev,[paymentId]:[
      ...(prev[paymentId]??[]),
      {name,period:periodLabel(result.data.periodFrom),slot:result.data.slot},
    ]}));
    setLastConfirmed(`Quota salvata: ${name} · ${periodLabel(result.data.periodFrom)}. Conferma verificata nel database.`);
   }catch{setError(paymentId,"Non è stato possibile confermare il salvataggio. Ricarica e controlla la quota prima di riprovare.");}
   finally{setWorking(null);}
  });
 }

 function ignore(paymentId:string){
  if(blocked)return;
  setWorking(paymentId);
  start(async()=>{
   try {
    const result=await ignoreAssociationPaymentAction(paymentId);
    if(result.ok)setIgnored(prev=>({...prev,[paymentId]:true}));
    else setError(paymentId,result.error);
   }catch{setError(paymentId,"Operazione non riuscita. Il pagamento non è stato ignorato.");}
   finally{setWorking(null);}
  });
 }

 const unresolved=payments.filter(p=>!ignored[p.id]&&p.slots.length+(saved[p.id]?.length??0)<p.availableSlots).length;
 return <div className="space-y-4">
  {lastConfirmed&&<div role="status" className="fixed bottom-24 left-4 right-4 z-40 mx-auto flex max-w-xl items-start justify-between gap-3 rounded-xl border border-[#326941]/40 bg-[#eef6ee] p-3 text-sm text-[#326941] shadow-lg">
    <span>{lastConfirmed}</span>
    <button type="button" className="shrink-0 font-semibold underline" onClick={()=>setLastConfirmed(null)}>Chiudi</button>
   </div>}
  <h2 className="font-semibold">Pagamenti da associare ({unresolved})</h2>
  {payments.length===0&&<p className="text-sm text-[#5f524c]">Nessun pagamento in attesa nei risultati caricati.</p>}
  {payments.map(p=>{
   const extra=saved[p.id]??[];
   const used=p.slots.length+extra.length;
   const closed=Boolean(ignored[p.id])||used>=p.availableSlots;
   const isWorking=working===p.id;
   const notice=feedback[p.id];
   return <section key={p.id} className="space-y-3 rounded-xl border border-[#211815]/15 bg-white p-3 sm:p-4">
    <div className="flex justify-between gap-2">
     <strong>{p.provider.toUpperCase()} · {(p.amount_cents/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"})}</strong>
     <span className="text-xs text-[#5f524c]">{new Date(p.paid_at).toLocaleDateString("it-IT")}</span>
    </div>
    <p className="text-sm">{p.payer_name||"Pagante non riconosciuto"}</p>
    {p.note&&<p className="text-xs text-[#5f524c]">Messaggio: {p.note}</p>}
    <div className="flex flex-wrap items-end justify-between gap-2">
     <p className="text-xs text-[#5f524c]">Quote assegnate: {used}/{p.availableSlots}</p>
     {!closed&&<label className="text-xs font-semibold" htmlFor={`period-${p.id}`}>
      Periodo della quota
      <select id={`period-${p.id}`} className="ml-2 min-h-10 rounded-lg border border-[#211815]/25 bg-white px-2 text-sm"
       value={periodFor(p.id)} disabled={blocked} onChange={e=>{
        setPeriodByPayment(prev=>({...prev,[p.id]:e.target.value}));
        setFeedback(prev=>{const next={...prev};delete next[p.id];return next;});
       }}>
       {periods.map(period=><option key={period.from} value={period.from}>{period.label}</option>)}
      </select>
     </label>}
    </div>
    {extra.map((item,i)=><p key={`${item.slot}-${i}`} role="status" className="rounded-lg border border-[#326941]/30 bg-[#eef6ee] p-3 text-sm text-[#326941]">
     Quota salvata nel database: <strong>{item.name}</strong> · periodo {item.period} · quota {item.slot}/{p.availableSlots}.
    </p>)}
    {ignored[p.id]&&<p role="status" className="rounded-lg bg-[#f2ede3] p-3 text-sm">Pagamento ignorato e salvato.</p>}
    {notice?.tone==="error"&&<p role="alert" className="rounded-lg border border-[#9b4b1e]/30 bg-[#fdf3e9] p-3 text-sm font-medium text-[#9b4b1e]">{notice.text}</p>}
    {!closed&&<>
     {p.suggested&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f6f1e9] p-2 text-sm">
      <span>Persona proposta: <strong>{p.suggested.name}</strong></span>
      <button type="button" disabled={blocked} className="min-h-10 rounded-lg bg-[#a8583e] px-3 py-2 text-white disabled:opacity-50"
       onClick={()=>assign(p.id,{kind:"person",id:p.suggested!.id},p.suggested!.name)}>
       {isWorking?"Salvataggio…":"Conferma"}
      </button>
     </div>}
     <div className="flex gap-2">
      <input className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="Nome, nickname o email nel libro persone"
       aria-label={`Cerca persona per ${p.payer_name||p.id}`}
       value={search[p.id]||""} onChange={e=>setSearch(prev=>({...prev,[p.id]:e.target.value}))}/>
      <button type="button" disabled={blocked||(search[p.id]||"").trim().length<2}
       className="min-h-10 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
       onClick={()=>lookup(p.id)}>{searching===p.id?"Ricerca…":"Cerca"}</button>
     </div>
     {(results[p.id]||[]).map(person=><div key={person.kind+person.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
      <span className="min-w-0"><strong className="block">{person.name}</strong>
       <small className="block break-all text-[#5f524c]">{person.source}{person.email?` · ${person.email}`:""}</small>
      </span>
      <button type="button" disabled={blocked} className="min-h-10 rounded-lg bg-[#a8583e] px-3 py-2 text-white disabled:opacity-50"
       onClick={()=>assign(p.id,{kind:person.kind,id:person.id},person.name)}>
       {isWorking?"Salvataggio…":"Associa quota"}
      </button>
     </div>)}
     {used===0&&<button type="button" disabled={blocked} onClick={()=>ignore(p.id)}
       className="min-h-10 text-xs text-[#5f524c] underline disabled:opacity-50">Non è una quota · Ignora</button>}
    </>}
   </section>;
  })}
 </div>;
}
