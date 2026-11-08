"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { normalizeText } from "@/lib/gestionale/format";
import type { UnifiedContact } from "@/lib/gestionale/unified-directory";
import { MemberQuickLink } from "./MemberQuickLink";

const stateLabel:Record<UnifiedContact["association"],string>={
 verificata:"Verificata",da_verificare:"Quota da verificare",
 solo_modulo:"Modulo presente",non_presente:"Non nel libro soci",non_disponibile:"Stato non disponibile",
};
const linkLabel:Record<UnifiedContact["link"],string>={
 confermato:"Abbinamento confermato",email:"Stessa email",
 da_verificare:"Abbinamento da controllare",nessuno:"",
};
type Filter="all"|"to_review"|"book_only";
export function UnifiedPeopleDirectory({contacts,initialQuery=""}:{contacts:UnifiedContact[];initialQuery?:string}){
 const [q,setQ]=useState(initialQuery);
 const [filter,setFilter]=useState<Filter>("all");
 const [expanded,setExpanded]=useState(false);
 const matching=useMemo(()=>{
  const tokens=normalizeText(q).split(/\s+/).filter(Boolean);
  return contacts.filter(contact=>(filter!=="to_review"||contact.link==="da_verificare"||(Boolean(contact.personId)&&contact.link==="nessuno"))&&
    (filter!=="book_only"||contact.kind==="registro")&&
    tokens.every(token=>normalizeText(contact.search).includes(token)));
 },[contacts,q,filter]);
 const shown=expanded?matching:matching.slice(0,60);
 const memberCount=contacts.filter(c=>c.kind==="registro").length;
 const reviewCount=contacts.filter(c=>c.link==="da_verificare"||(c.personId&&c.link==="nessuno")).length;
 return <div className="space-y-3">
  <div>
   <label htmlFor="unified-directory-search" className="sr-only">Cerca persone nel gestionale e nel libro soci</label>
   <input id="unified-directory-search" type="search" autoComplete="off" value={q}
    onChange={event=>{setQ(event.target.value);setExpanded(false);}}
    placeholder="Cerca nome, cognome, nickname o email"
    className="min-h-10 w-full rounded-xl border border-[#211815]/20 bg-white p-3 text-sm"/>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <label htmlFor="unified-directory-filter" className="text-xs text-[#5f524c]">Mostra</label>
   <select id="unified-directory-filter" value={filter}
    onChange={event=>{setFilter(event.target.value as Filter);setExpanded(false);}}
    className="min-h-10 rounded-lg border border-[#211815]/20 bg-white px-2 text-sm">
    <option value="all">Tutte le persone</option>
    <option value="book_only">Solo nel libro soci ({memberCount})</option>
    <option value="to_review">Abbinamenti da controllare ({reviewCount})</option>
   </select>
  </div>
  <p className="text-xs text-[#5f524c]">
    {matching.length} persone · Una scheda per i contatti corrispondenti, senza unire omonimi
  </p>
  <ul className="divide-y divide-[#211815]/10 overflow-hidden rounded-xl border border-[#211815]/10 bg-white">
   {shown.map(contact=><li key={contact.key} className="space-y-2 p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
     <div className="min-w-0">
      <p className="font-semibold">{contact.name}</p>
      {contact.nickname&&<p className="text-xs text-[#5f524c]">Nickname: {contact.nickname}</p>}
      {contact.email&&<p className="break-all text-xs text-[#5f524c]">{contact.email}</p>}
     </div>
     <span className={`rounded-md px-2 py-1 text-xs font-semibold ${contact.association==="verificata"?"bg-[#eef6ee] text-[#326941]":"bg-[#f5f0e8] text-[#675244]"}`}>
      {stateLabel[contact.association]}
     </span>
    </div>
    <p className="text-xs text-[#5f524c]">{contact.source}{contact.link!=="nessuno"?` · ${linkLabel[contact.link]}`:""}</p>
    <div className="flex flex-wrap items-center gap-3 text-sm">
     {contact.personId&&<Link prefetch={false} href={`/gestione/p/${contact.personId}`}
       className="text-[#5f524c] underline">Dettagli persona</Link>}
     {!contact.personId&&contact.possiblePersonId&&<Link prefetch={false} href={`/gestione/p/${contact.possiblePersonId}`}
       className="text-[#5f524c] underline">Apri persona possibile</Link>}
    </div>
    {contact.personId&&contact.personVersion!==null&&contact.link!=="confermato"&&
      <MemberQuickLink personId={contact.personId} version={contact.personVersion}
        personName={contact.nickname||contact.name}/>}
    {!contact.personId&&contact.possiblePersonId&&contact.possiblePersonVersion!==null&&
      <MemberQuickLink personId={contact.possiblePersonId} version={contact.possiblePersonVersion}
        personName={contact.name}/>}
    {!contact.personId&&!contact.possiblePersonId&&
      <p className="text-xs text-[#5f524c]">Presente solo nelle fonti associative. Non creare duplicati: cerca prima un'anagrafica esistente.</p>}
   </li>)}
  </ul>
  {matching.length===0&&<p className="text-sm">Nessun risultato con questi filtri.</p>}
  {!expanded&&matching.length>shown.length&&
   <button type="button" className="min-h-10 text-sm font-semibold text-[#a8583e] underline"
    onClick={()=>setExpanded(true)}>Mostra tutti ({matching.length})</button>}
 </div>;
}
