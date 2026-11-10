"use client";
import { useState, useTransition } from "react";
import { countAssignedPaymentSlots } from "@/lib/gestionale/payment-slot-progress";
import { confirmAssociationPaymentAction, findPaymentPeopleAction, ignoreAssociationPaymentAction } from "@/app/gestione/(app)/quote-email/actions";

type Person = {kind:"person"|"member";id:string;name:string;email:string|null;source:string};
type Payment = {id:string;provider:string;payer_name:string|null;amount_cents:number;note:string|null;paid_at:string;availableSlots:number;slots:number[];suggested:{id:string;name:string}|null;proposals:Person[];assigned:{slot:number;name:string}[];alreadyPaidPeriod:string|null;associationPeriodFrom:string|null;associationExpiresAt:string|null;noteKind:"membership"|"other"|"uncertain";beneficiaryHints:string[]};
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
 const periodFor=(id:string)=>payments.find(p=>p.id===id)?.associationPeriodFrom??defaultPeriod;
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

 // L'assegnazione appena confermata compare sia in saved che nelle props
 // dopo un aggiornamento server: contare gli SLOT univoci, non le righe UI.
 const countUsed=(p:Payment)=>countAssignedPaymentSlots(p.slots,saved[p.id]??[]);
 const unresolved=payments.filter(p=>!ignored[p.id]&&p.noteKind!=="other"&&countUsed(p)<p.availableSlots).length;
 const nonFee=payments.filter(p=>p.noteKind==="other"&&!ignored[p.id]).length;
 return <div className="space-y-4">
  <h2 className="font-semibold">Quote candidate da verificare ({unresolved})</h2>
  {nonFee>0&&<p className="text-xs text-[#805b26]">{nonFee} pagamenti con causale riferita a eventi: da escludere o verificare separatamente.</p>}
  {payments.length===0&&<p className="text-sm text-[#5f524c]">Nessun pagamento in attesa nei risultati caricati.</p>}
  {payments.map(p=>{
   const extra=saved[p.id]??[];
   const used=countUsed(p);
   const closed=Boolean(ignored[p.id])||used>=p.availableSlots;
   const isWorking=working===p.id;
   const notice=feedback[p.id];
   const periodAlreadyPaid=Boolean(p.alreadyPaidPeriod&&periodFor(p.id)===p.alreadyPaidPeriod);
   const eligible=p.proposals.filter(person=>!p.assigned.some(a=>a.name.toLowerCase()===person.name.toLowerCase())&&
     !extra.some(a=>a.name.toLowerCase()===person.name.toLowerCase()));
   return <section key={p.id} className="space-y-3 rounded-xl border border-[#211815]/15 bg-white p-3 sm:p-4">
    <div className="flex justify-between gap-2">
     <strong>{p.provider.toUpperCase()} · {(p.amount_cents/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"})}</strong>
     <span className="text-xs text-[#5f524c]">{new Date(p.paid_at).toLocaleDateString("it-IT")}</span>
    </div>
    <p className="text-sm">{p.payer_name||"Pagante non riconosciuto"}</p>
    {p.note&&<p className="rounded-lg bg-[#f6f1e9] p-2 text-xs text-[#5f524c]">
      <strong>Causale originale:</strong> {p.note}
    </p>}
    {p.beneficiaryHints.length>0&&<p className="text-sm">
      <strong>Beneficiari indicati:</strong> {p.beneficiaryHints.join(" · ")}
    </p>}
    {p.noteKind==="other"&&<p className="rounded-lg border border-[#d5a052]/30 bg-[#fff8eb] p-2 text-sm text-[#805b26]">
      La causale sembra riferirsi a un evento o un'attività, non alla quota associativa.
      {used>0?" Una quota è già stata assegnata: serve una verifica dell'abbinamento.":" Non assegnare quote su questo pagamento."}
    </p>}
    {p.noteKind==="uncertain"&&<p className="text-xs text-[#805b26]">
      Importo compatibile con una quota, ma la causale non conferma il beneficiario. Verifica prima di associare.
    </p>}
    <div className="flex flex-wrap items-end justify-between gap-2">
     <p className="text-xs text-[#5f524c]">Quote da 15 € assegnate: {used}/{p.availableSlots}</p>
     {!closed&&<p className="text-xs font-semibold">Annualità {periodLabel(periodFor(p.id))} · valida fino al {p.associationExpiresAt?.split("-").reverse().join("/")??"—"}</p>}
    </div>
    {p.alreadyPaidPeriod && used===0 && !closed && <p className="text-sm text-[#9b4b1e]">Quota {periodLabel(p.alreadyPaidPeriod)} già registrata: controlla l’eventuale duplicazione prima di confermare.</p>}
    {extra.filter(item=>!p.assigned.some(a=>a.slot===item.slot)).map((item,i)=><p key={`${item.slot}-${i}`} role="status" className="rounded-lg border border-[#326941]/30 bg-[#eef6ee] p-3 text-sm text-[#326941]">
     Quota salvata nel database: <strong>{item.name}</strong> · periodo {item.period} · quota {item.slot}/{p.availableSlots}.
    </p>)}
    {p.assigned.map(item=><p key={item.slot} className="rounded-lg border border-[#326941]/20 bg-[#eef6ee] px-3 py-2 text-sm text-[#326941]">
      Quota {item.slot}/{p.availableSlots} già assegnata: <strong>{item.name}</strong>.
    </p>)}
    {ignored[p.id]&&<p role="status" className="rounded-lg bg-[#f2ede3] p-3 text-sm">Pagamento ignorato e salvato.</p>}
    {notice?.tone==="error"&&<p role="alert" className="rounded-lg border border-[#9b4b1e]/30 bg-[#fdf3e9] p-3 text-sm font-medium text-[#9b4b1e]">{notice.text}</p>}
    {p.noteKind==="other"&&!closed&&used===0&&<button type="button" disabled={blocked} onClick={()=>ignore(p.id)}
      className="min-h-10 text-xs font-semibold text-[#a8583e] underline">Escludi dalla verifica quote</button>}
    {!closed&&p.noteKind!=="other"&&<>
     <p className="text-sm font-semibold text-[#5f524c]">
       {p.availableSlots>1?`Quota ${used+1} di ${p.availableSlots} (15 €): ${used===0?"scegli la prima persona":"scegli un'altra persona per la quota rimanente"}`:"Assegna la quota da 15 €"}
     </p>
     {eligible.length>0&&<div className="space-y-2 rounded-lg bg-[#f6f1e9] p-3 text-sm">
       <p className="text-xs font-semibold">{p.beneficiaryHints.length?"Corrispondenze suggerite dalla causale":"Pagante proposto: verifica che sia il beneficiario"}</p>
       {eligible.map(person=><div key={person.kind+person.id}
         className="flex flex-wrap items-center justify-between gap-2 border-t border-[#211815]/10 pt-2">
         <span><strong className="block">{person.name}</strong>
           <small className="block break-all text-[#5f524c]">{person.source}{person.email?` · ${person.email}`:""}</small>
         </span>
         <button type="button" disabled={blocked||(periodAlreadyPaid&&person.kind==="person"&&person.id===p.suggested?.id)}
           className="min-h-10 rounded-lg bg-[#a8583e] px-3 py-2 text-white disabled:opacity-50"
           onClick={()=>assign(p.id,{kind:person.kind,id:person.id},person.name)}>
           Associa 15 €
         </button>
       </div>)}
     </div>}
     {used>0&&p.availableSlots>1&&<p className="text-xs text-[#805b26]">
       La prima quota è già attribuita: ricerca il partner o un'altra persona. Non assegnare due quote alla stessa persona.
     </p>}
     <div className="flex gap-2">
      <input className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder={used>0?"Cerca la seconda persona: nome, nickname o email":"Cerca un altro nominativo"}
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
       {isWorking?"Salvataggio…":"Associa 15 €"}
      </button>
     </div>)}
     {used===0&&<button type="button" disabled={blocked} onClick={()=>ignore(p.id)}
       className="min-h-10 text-xs text-[#5f524c] underline disabled:opacity-50">Non è una quota · Ignora</button>}
    </>}
   </section>;
  })}
 </div>;
}
