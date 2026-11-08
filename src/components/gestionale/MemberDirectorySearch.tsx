"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { memberSearchAction } from "@/app/gestione/(app)/w/actions";

type Result=Extract<Awaited<ReturnType<typeof memberSearchAction>>,{ok:true}>["data"];
export function MemberDirectorySearch(){
 const [q,setQ]=useState("");
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const query=q.trim();
  if(query.length<2){setResult(null);setError(null);setBusy(false);return;}
  let cancelled=false;
  setBusy(true);
  const t=setTimeout(async()=>{
   try{
    const response=await memberSearchAction(query);
    if(cancelled)return;
    setError(response.ok?null:response.error);
    setResult(response.ok?response.data:null);
   }catch{if(!cancelled){setError("Ricerca non disponibile. Riprova.");setResult(null);}}
   finally{if(!cancelled)setBusy(false);}
  },300);
  return ()=>{cancelled=true;clearTimeout(t);};
 },[q]);
 return <div className="space-y-2">
  <label className="block text-sm font-semibold" htmlFor="find-member-global">Cerca nel libro soci</label>
  <input id="find-member-global" type="search" value={q} onChange={e=>setQ(e.target.value)}
   className="w-full rounded-xl border border-[#211815]/20 bg-white px-3 py-2.5 text-sm"
   placeholder="Nome, cognome, nickname o parte dell’email" autoComplete="off" />
  {busy&&<p className="text-xs text-[#5f524c]">Ricerca…</p>}
  {error&&<p role="alert" className="text-sm text-[#9b4b1e]">{error}</p>}
  {result&&q.trim().length>=2&&<div className="space-y-2 text-sm">
    {result.members.length>0&&<div className="rounded-xl border border-[#211815]/10 bg-white p-3">
     <p className="mb-2 font-semibold">Nel libro soci e nei moduli</p>
     <ul className="divide-y divide-[#211815]/10">
      {result.members.map(member=><li key={member.id} className="py-2">
       <span className="block font-semibold">{[member.first_name,member.last_name].filter(Boolean).join(" ")||member.email||"Socio"}</span>
       <span className="block text-xs text-[#5f524c]">{member.source==="libro"?"Libro soci Team Artist":member.source==="modulo"?"Modulo Google":"Registrazione manuale"}{member.email?` · ${member.email}`:""}</span>
      </li>)}
     </ul>
    </div>}
    {result.people.length>0&&<div className="rounded-xl border border-[#211815]/10 bg-white p-3">
     <p className="mb-2 font-semibold">Nell’anagrafica del gestionale</p>
     <ul className="divide-y divide-[#211815]/10">
      {result.people.map(person=><li key={person.id} className="py-2">
       <Link prefetch={false} href={`/gestione/p/${person.id}`} className="block font-semibold underline">
        {person.displayName}
       </Link>
       {person.detail&&<span className="block text-xs text-[#5f524c]">{person.detail}</span>}
      </li>)}
     </ul>
    </div>}
    {result.members.length===0&&result.people.length===0&&<p className="text-sm text-[#5f524c]">Nessuna corrispondenza. Prova anche una sola parte del nome o del nickname.</p>}
    {result.members.length>0&&result.people.length>0&&<p className="text-xs text-[#5f524c]">Per collegare due schede, apri la persona nell’anagrafica e seleziona il socio corretto. Non vengono unite automaticamente.</p>}
   </div>}
 </div>;
}
