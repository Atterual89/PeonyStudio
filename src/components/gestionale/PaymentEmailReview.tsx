"use client";
import { useState, useTransition } from "react";
import { countAssignedPaymentSlots } from "@/lib/gestionale/payment-slot-progress";
import { confirmAssociationPaymentAction, getMembershipVerificationDetailsAction, revokeMembershipVerificationAction, findPaymentPeopleAction, ignoreAssociationPaymentAction, restoreAssociationPaymentAction, unassignAssociationPaymentAction } from "@/app/gestione/(app)/quote-email/actions";

type Person = {kind:"person"|"member";id:string;name:string;email:string|null;source:string};
type Payment = {id:string;status:string;provider:string;payer_name:string|null;amount_cents:number;note:string|null;paid_at:string;availableSlots:number;slots:number[];suggested:{id:string;name:string}|null;proposals:Person[];assigned:{id:string;slot:number;name:string}[];alreadyPaidPeriod:string|null;associationPeriodFrom:string|null;associationExpiresAt:string|null};
type Verification = {id:string;source:string;status:string;from:string|null;until:string|null;paymentRef:string|null;linked:boolean;canRevoke:boolean;label:string};
type VerificationPanel = {personId:string;personName:string;items:Verification[]};
type SavedQuota = {name:string;period:string;slot:number};
type Notice = {tone:"error"|"success";text:string};

export function PaymentEmailReview({payments,periods,defaultPeriod}:{
 payments:Payment[];periods:{from:string;label:string}[];defaultPeriod:string
}){
 const [pending,start]=useTransition();
 const [view,setView]=useState<"pending"|"confirmed"|"ignored">("pending");
 const [removed,setRemoved]=useState<Record<string,string[]>>({});
 const [restored,setRestored]=useState<Record<string,boolean>>({});
 const [verificationPanels,setVerificationPanels]=useState<Record<string,VerificationPanel>>({});
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [revoked,setRevoked]=useState<Record<string,boolean>>({});
 const [working,setWorking]=useState<string|null>(null);
 const [searching,setSearching]=useState<string|null>(null);
 const [search,setSearch]=useState<Record<string,string>>({});
 const [results,setResults]=useState<Record<string,Person[]>>({});
 const [feedback,setFeedback]=useState<Record<string,Notice>>({});
 const [saved,setSaved]=useState<Record<string,SavedQuota[]>>({});
 const [ignored,setIgnored]=useState<Record<string,boolean>>({});
 function unassign(paymentId:string,allocationId:string){
  if(blocked||!window.confirm("Disassociare questa quota? Lo stato associativo sarà ricalcolato e la correzione registrata."))return;
  setWorking(paymentId);
  start(async()=>{
   try {
    const result=await unassignAssociationPaymentAction(allocationId,"Correzione abbinamento");
    if(result.ok){
     setRemoved(prev=>({...prev,[paymentId]:[...(prev[paymentId]??[]),allocationId]}));
     setFeedback(prev=>({...prev,[paymentId]:{tone:"success",text:"Quota disassociata. La verifica derivata è stata aggiornata."}}));
    }else setError(paymentId,result.error);
   }catch{setError(paymentId,"Disassociazione non riuscita.");}
   finally{setWorking(null);}
  });
 }
 function restore(paymentId:string){
  if(blocked)return;
  setWorking(paymentId);
  start(async()=>{
   try{
    const result=await restoreAssociationPaymentAction(paymentId);
    if(result.ok){setRestored(prev=>({...prev,[paymentId]:true}));setIgnored(prev=>({...prev,[paymentId]:false}));}
    else setError(paymentId,result.error);
   }catch{setError(paymentId,"Ripristino non riuscito.");}
   finally{setWorking(null);}
  });
 }
 function manageVerification(paymentId:string,personId:string){
  if(blocked)return;
  if(verificationPanels[paymentId]){setVerificationPanels(prev=>{const next={...prev};delete next[paymentId];return next;});return;}
  setWorking(paymentId);
  start(async()=>{
   try{
    const result=await getMembershipVerificationDetailsAction(personId);
    if(!result.ok){setError(paymentId,result.error);return;}
    setVerificationPanels(prev=>({...prev,[paymentId]:{personId,personName:result.personName,items:result.verifications}}));
   }catch{setError(paymentId,"Impossibile caricare le verifiche della persona.");}
   finally{setWorking(null);}
  });
 }
 function revokeVerification(paymentId:string,recordId:string){
  const panel=verificationPanels[paymentId];
  const reason=(reasons[recordId]??"").trim();
  if(blocked||!panel||reason.length<5)return;
  if(!window.confirm("Revocare questa specifica verifica? Il modulo Google e i pagamenti resteranno invariati."))return;
  setWorking(paymentId);
  start(async()=>{
   try{
    const result=await revokeMembershipVerificationAction(panel.personId,recordId,reason);
    if(!result.ok){setError(paymentId,result.error);return;}
    setRevoked(prev=>({...prev,[recordId]:true}));
    setFeedback(prev=>({...prev,[paymentId]:{tone:"success",text:"Verifica revocata. Modulo e pagamenti non sono stati modificati."}}));
   }catch{setError(paymentId,"Revoca non riuscita.");}
   finally{setWorking(null);}
  });
 }
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
 const countUsed=(p:Payment)=>countAssignedPaymentSlots(p.slots.filter(slot=>!p.assigned.some(a=>a.slot===slot&&(removed[p.id]??[]).includes(a.id))),saved[p.id]??[]);
 const statusFor=(p:Payment)=>ignored[p.id]?"ignored":restored[p.id]?"pending":p.status;
 const unresolved=payments.filter(p=>statusFor(p)==="pending"&&countUsed(p)<p.availableSlots).length;
 return <div className="space-y-4">
  <h2 className="font-semibold">Pagamenti da verificare ({unresolved})</h2>
  <div className="flex flex-wrap gap-2" aria-label="Filtro pagamenti">
   {([["pending","Da verificare"],["confirmed","Assegnati"],["ignored","Ignorati"]] as const).map(([value,label])=><button key={value} type="button" onClick={()=>setView(value)} aria-pressed={view===value} className={`rounded-lg border px-3 py-2 text-sm ${view===value?"border-[#a8583e] bg-[#f6f1e9] font-semibold":"border-[#211815]/15"}`}>{label}</button>)}
  </div>
  {payments.length===0&&<p className="text-sm text-[#5f524c]">Nessun pagamento in attesa nei risultati caricati.</p>}
  {payments.filter(p=>statusFor(p)===view).map(p=>{
   const extra=saved[p.id]??[];
   const activeAssigned=p.assigned.filter(item=>!(removed[p.id]??[]).includes(item.id));
   const used=countAssignedPaymentSlots(activeAssigned.map(item=>item.slot),saved[p.id]??[]);
   const closed=statusFor(p)==="ignored"||used>=p.availableSlots;
   const isWorking=working===p.id;
   const notice=feedback[p.id];
   const periodAlreadyPaid=Boolean(p.alreadyPaidPeriod&&periodFor(p.id)===p.alreadyPaidPeriod);
   return <section key={p.id} className="space-y-3 rounded-xl border border-[#211815]/15 bg-white p-3 sm:p-4">
    <div className="flex justify-between gap-2">
     <strong>{p.provider.toUpperCase()} · {(p.amount_cents/100).toLocaleString("it-IT",{style:"currency",currency:"EUR"})}</strong>
     <span className="text-xs text-[#5f524c]">{new Date(p.paid_at).toLocaleDateString("it-IT")}</span>
    </div>
    <p className="text-sm">{p.payer_name||"Pagante non riconosciuto"}</p>
    {p.note&&<p className="text-xs text-[#5f524c]">Messaggio: {p.note}</p>}
    <div className="flex flex-wrap items-end justify-between gap-2">
     <p className="text-xs text-[#5f524c]">Quote da 15 € assegnate: {used}/{p.availableSlots}</p>
     {!closed&&<p className="text-xs font-semibold">Annualità {periodLabel(periodFor(p.id))} · valida fino al {p.associationExpiresAt?.split("-").reverse().join("/")??"—"}</p>}
    </div>
    {p.alreadyPaidPeriod && used===0 && !closed && <div className="space-y-2 rounded-lg border border-[#9b4b1e]/20 p-3 text-sm">
     <p className="text-[#9b4b1e]">Quota {periodLabel(p.alreadyPaidPeriod)} già registrata: controlla l’eventuale duplicazione prima di confermare.</p>
     {(()=>{const candidate=p.suggested?.id??p.proposals.find(person=>person.kind==="person")?.id;
      return candidate?<button type="button" disabled={blocked} onClick={()=>manageVerification(p.id,candidate)}
       className="rounded-lg border border-[#9b4b1e]/40 px-3 py-2 text-[#9b4b1e] disabled:opacity-50">{verificationPanels[p.id]?"Chiudi verifiche":"Gestisci verifica"}</button>:<p className="text-xs text-[#5f524c]">Seleziona prima la persona dall’anagrafica per controllare le verifiche.</p>;
     })()}
    </div>}
    {verificationPanels[p.id]&&<div className="space-y-3 rounded-lg border border-[#211815]/15 bg-[#faf8f5] p-3 text-sm">
     <strong className="block">Verifiche di {verificationPanels[p.id].personName}</strong>
     {verificationPanels[p.id].items.length===0&&<p>Nessuna verifica trovata per questa persona.</p>}
     {verificationPanels[p.id].items.map(record=><div key={record.id} className="space-y-2 border-t border-[#211815]/10 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <span><strong>{record.label}</strong> · {revoked[record.id]?"Revocata":record.status==="verified"?"Verificata":record.status==="expired"?"Scaduta":record.status==="pending"?"Da verificare":record.status}</span>
       <small className="text-[#5f524c]">{record.from??"—"} → {record.until??"—"}</small>
      </div>
      {record.paymentRef&&<p className="break-all text-xs text-[#5f524c]">Riferimento pagamento: {record.paymentRef}</p>}
      {record.linked&&<p className="text-xs text-[#805b26]">Pagamento ancora assegnato a questa persona: per correggerlo usa «Disassocia» nella scheda Assegnati.</p>}
      {record.canRevoke&&!revoked[record.id]&&<>
       <label className="block text-xs text-[#5f524c]" htmlFor={`reason-${record.id}`}>Motivo della revoca</label>
       <input id={`reason-${record.id}`} className="w-full rounded-lg border p-2 text-sm" value={reasons[record.id]??""}
        onChange={e=>setReasons(prev=>({...prev,[record.id]:e.target.value}))}
        placeholder="Es. attribuita alla persona sbagliata" maxLength={300}/>
       <button type="button" disabled={blocked||(reasons[record.id]??"").trim().length<5}
        onClick={()=>revokeVerification(p.id,record.id)}
        className="rounded-lg border border-[#9b4b1e]/40 px-3 py-2 text-[#9b4b1e] disabled:opacity-50">Revoca questa verifica</button>
      </>}
      {!record.canRevoke&&!revoked[record.id]&&!record.linked&&<p className="text-xs text-[#5f524c]">Questa fonte non è revocabile qui.</p>}
     </div>)}
    </div>}
    {extra.filter(item=>!p.assigned.some(a=>a.slot===item.slot)).map((item,i)=><p key={`${item.slot}-${i}`} role="status" className="rounded-lg border border-[#326941]/30 bg-[#eef6ee] p-3 text-sm text-[#326941]">
     Quota salvata nel database: <strong>{item.name}</strong> · periodo {item.period} · quota {item.slot}/{p.availableSlots}.
    </p>)}
    {activeAssigned.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#326941]/20 bg-[#eef6ee] px-3 py-2 text-sm">
      <span>Quota {item.slot}/{p.availableSlots} assegnata: <strong>{item.name}</strong></span>
      <button type="button" disabled={blocked} onClick={()=>unassign(p.id,item.id)} className="rounded-lg border border-[#9b4b1e]/40 px-3 py-2 text-[#9b4b1e] disabled:opacity-50">Disassocia</button>
    </div>)}
    {ignored[p.id]&&<p role="status" className="rounded-lg bg-[#f2ede3] p-3 text-sm">Pagamento ignorato e salvato.</p>}
    {notice?.tone==="success"&&<p role="status" className="rounded-lg bg-[#eef6ee] p-3 text-sm">{notice.text}</p>}
    {notice?.tone==="error"&&<p role="alert" className="rounded-lg border border-[#9b4b1e]/30 bg-[#fdf3e9] p-3 text-sm font-medium text-[#9b4b1e]">{notice.text}</p>}
    {statusFor(p)==="ignored"&&<button type="button" disabled={blocked} onClick={()=>restore(p.id)} className="rounded-lg border px-3 py-2 text-sm">Ripristina pagamento</button>}
    {!closed&&statusFor(p)==="pending"&&<>
     <p className="text-sm font-semibold text-[#5f524c]">
       {p.availableSlots>1?`Quota ${used+1} di ${p.availableSlots} (15 €): ${used===0?"scegli la prima persona":"scegli un'altra persona per la quota rimanente"}`:"Assegna la quota da 15 €"}
     </p>
     {used===0&&p.proposals.length>0&&<div className="space-y-2 rounded-lg bg-[#f6f1e9] p-3 text-sm">
       <p className="text-xs font-semibold">Persone proposte automaticamente</p>
       {p.proposals.map(person=><div key={person.kind+person.id}
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
