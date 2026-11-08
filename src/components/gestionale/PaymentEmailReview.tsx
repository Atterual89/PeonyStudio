"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmAssociationPaymentAction, findPaymentPeopleAction, ignoreAssociationPaymentAction, syncAssociationMailAction } from "@/app/gestione/(app)/quote-email/actions";

type Person = {id:string;first_name:string|null;last_name:string|null;nickname:string|null;email:string|null};
type Payment = {id:string;provider:string;payer_name:string|null;amount_cents:number;note:string|null;paid_at:string;availableSlots:number;slots:number[]};
export function PaymentEmailReview({payments,initialised,lastSync}:{
 payments:Payment[];initialised:boolean;lastSync:string|null
}){
 const router=useRouter();
 const [busy,start]=useTransition();
 const [date,setDate]=useState("");
 const [search,setSearch]=useState<Record<string,string>>({});
 const [results,setResults]=useState<Record<string,Person[]>>({});
 const [message,setMessage]=useState("");
 function sync(){
  setMessage("");
  start(async()=>{
   const r=await syncAssociationMailAction(initialised?undefined:date);
   setMessage(r.ok?`Analizzate ${r.data.scanned} email; nuovi pagamenti: ${r.data.imported}.`:r.error);
   router.refresh();
  });
 }
 function lookup(id:string){
  start(async()=>{try{setResults(s=>({...s,[id]:await findPaymentPeopleAction(search[id]||"")}));}
   catch{setMessage("Ricerca persone non riuscita.");}});
 }
 function assign(paymentId:string,personId:string){
  start(async()=>{const r=await confirmAssociationPaymentAction(paymentId,personId);
   setMessage(r.ok?"Quota verificata.":r.error);router.refresh();});
 }
 function ignore(paymentId:string){
  start(async()=>{const r=await ignoreAssociationPaymentAction(paymentId);
   setMessage(r.ok?"Pagamento ignorato.":r.error);router.refresh();});
 }
 return <div className="space-y-4">
  <div className="rounded-xl border border-[#211815]/15 bg-white p-4 space-y-3">
   <h2 className="font-semibold">Verifica email PayPal e Qonto</h2>
   <p className="text-xs text-[#5f524c]">{lastSync?`Ultimo controllo: ${new Date(lastSync).toLocaleString("it-IT")}`:"Nessuna sincronizzazione completata."}</p>
   {!initialised&&<label className="block text-sm">Data da cui cercare le email
    <input aria-label="Data iniziale" type="date" value={date} onChange={e=>setDate(e.target.value)}
      className="mt-1 block w-full max-w-xs rounded-lg border p-2" />
   </label>}
   <button type="button" disabled={busy||(!initialised&&!date)} onClick={sync}
     className="rounded-xl bg-[#a8583e] px-4 py-2.5 font-semibold text-white disabled:opacity-50">
      {busy?"Operazione in corso…":"Verifica email"}
   </button>
   <p className="text-xs text-[#5f524c]">Importa solo nuovi messaggi (con sovrapposizione di sicurezza). Nessuna quota viene confermata automaticamente.</p>
  </div>
  {message&&<p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
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
   <div className="flex gap-2">
    <input className="min-w-0 flex-1 rounded-lg border p-2 text-sm" placeholder="Nome, nickname o email nel libro persone"
      aria-label={`Cerca persona per ${p.payer_name||p.id}`}
      value={search[p.id]||""} onChange={e=>setSearch(s=>({...s,[p.id]:e.target.value}))}/>
    <button type="button" disabled={busy||(search[p.id]||"").trim().length<2}
      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>lookup(p.id)}>Cerca</button>
   </div>
   {(results[p.id]||[]).map(person=><div key={person.id} className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
    <span>{[person.first_name,person.last_name].filter(Boolean).join(" ")||person.nickname}
      {person.nickname&&<small className="block text-[#5f524c]">{person.nickname}</small>}</span>
    <button type="button" disabled={busy} className="rounded-lg bg-[#a8583e] px-3 py-2 text-white disabled:opacity-50"
      onClick={()=>assign(p.id,person.id)}>Associa quota</button>
   </div>)}
   {p.slots.length===0&&<button type="button" disabled={busy} onClick={()=>ignore(p.id)}
     className="text-xs text-[#5f524c] underline disabled:opacity-50">Non è una quota · Ignora</button>}
  </section>)}
 </div>;
}
