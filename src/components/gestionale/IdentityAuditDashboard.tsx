"use client";

import Link from "next/link";
import { useMemo,useState } from "react";
import { PaperFormControl } from "./PaperFormControl";
import { QuickPersonQuota } from "./PersonDirectoryActions";
import type { UnifiedContact } from "@/lib/gestionale/unified-directory";
import type { AuditDuplicate } from "@/lib/gestionale/server/identity-audit";

type Filter="all"|"form"|"quota"|"ok";
const action="inline-flex min-h-9 items-center rounded-lg border border-[#a8583e]/35 px-3 text-xs font-semibold text-[#a8583e]";

export function IdentityAuditDashboard({contacts,duplicates,counts}:{
  contacts:UnifiedContact[];
  duplicates:AuditDuplicate[];
  counts:{people:number;formsToVerify:number;paymentsToVerify:number;verified:number;duplicates:number};
}) {
  const [tab,setTab]=useState<"people"|"duplicates">("people");
  const [filter,setFilter]=useState<Filter>("all");
  const [query,setQuery]=useState("");
  const [showAll,setShowAll]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const filtered=useMemo(()=>contacts.filter(c=>{
    const text=[c.name,c.nickname,c.email,c.source].filter(Boolean).join(" ").toLowerCase();
    const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return terms.every(term=>text.includes(term)) &&
      (filter==="all"||(filter==="form"&&!c.formPresent)||
       (filter==="quota"&&c.formPresent&&!c.quotaPaid)||
       (filter==="ok"&&c.formPresent&&c.quotaPaid));
  }),[contacts,query,filter]);
  const listed=showAll?filtered:filtered.slice(0,35);
  const matchingDuplicates=duplicates.filter(d=>
    [d.name,d.email,d.reason].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {[
        ["Persone",counts.people],
        ["Moduli da verificare",counts.formsToVerify],
        ["Quote da verificare",counts.paymentsToVerify],
        ["In regola",counts.verified],
        ["Possibili doppioni",counts.duplicates],
      ].map(([label,value])=><div key={label} className="rounded-xl border border-[#211815]/10 bg-white/80 p-3">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-[#5f524c]">{label}</p>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>{setTab("people");setShowAll(false);}}
        className={tab==="people"?"rounded-lg bg-[#a8583e] px-3 py-2 text-sm font-semibold text-white":"rounded-lg border border-[#211815]/15 px-3 py-2 text-sm"}>
        Anagrafiche
      </button>
      <button type="button" onClick={()=>{setTab("duplicates");setShowAll(false);}}
        className={tab==="duplicates"?"rounded-lg bg-[#a8583e] px-3 py-2 text-sm font-semibold text-white":"rounded-lg border border-[#211815]/15 px-3 py-2 text-sm"}>
        Doppioni e conflitti ({counts.duplicates})
      </button>
    </div>
    <label className="block text-sm">
      Cerca nome, nickname o email
      <input value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false);}}
        placeholder="Cerca nell'anagrafica" className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/15 bg-white px-3"/>
    </label>
    {tab==="people"&&<label className="block max-w-sm text-sm">
      Visualizza
      <select className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/15 bg-white px-3"
        value={filter} onChange={e=>{setFilter(e.target.value as Filter);setShowAll(false);}}>
        <option value="all">Tutte le anagrafiche</option>
        <option value="form">Modulo da verificare</option>
        <option value="quota">Modulo OK, quota da verificare</option>
        <option value="ok">Modulo e quota OK</option>
      </select>
    </label>}
    {message&&<p role="status" className="rounded-lg border border-[#326941]/20 bg-white p-2 text-sm text-[#326941]">{message}</p>}
    {tab==="people"?<div className="space-y-2">
      <p className="text-xs text-[#5f524c]">{filtered.length} anagrafiche</p>
      {listed.map(c=><div key={c.key} className="space-y-2 rounded-xl border border-[#211815]/10 bg-white/85 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{c.name}</p>
            {c.nickname&&<p className="text-xs">Nickname: {c.nickname}</p>}
            {c.email&&<p className="break-all text-xs text-[#5f524c]">{c.email}</p>}
          </div>
          {c.personId&&<Link prefetch={false} className={action} href={"/gestione/p/"+c.personId}>Apri scheda</Link>}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={c.formPresent?"rounded-lg border border-[#326941]/25 px-2 py-1 text-[#326941]":"rounded-lg border border-[#c73535]/25 px-2 py-1 text-[#9b2c2c]"}>
            Modulo: {c.formPresent?(c.formSource==="cartaceo"?"cartaceo confermato":"Google confermato"):"da verificare"}
          </span>
          <span className={c.quotaPaid?"rounded-lg border border-[#326941]/25 px-2 py-1 text-[#326941]":"rounded-lg border border-[#d99b23]/30 px-2 py-1 text-[#8b651d]"}>
            Quota: {c.quotaPaid?"OK"+(c.expiresAt?" fino al "+c.expiresAt.split("-").reverse().join("/"):""):"da verificare"}
          </span>
        </div>
        {c.personId&&<div className="flex flex-wrap items-start gap-2">
          <PaperFormControl personId={c.personId} verified={Boolean(c.paperFormVerified)} onSaved={setMessage}/>
          {c.formPresent&&!c.quotaPaid&&<QuickPersonQuota personId={c.personId} onSaved={setMessage}/>}
        </div>}
        {!c.formPresent&&c.quotaPaid&&<p className="text-xs text-[#9b4b1e]">Quota già presente: non ripetere il pagamento. Controlla solo il modulo.</p>}
      </div>)}
      {filtered.length>listed.length&&<button type="button" onClick={()=>setShowAll(true)}
        className="min-h-10 text-sm font-semibold text-[#a8583e] underline">
        Mostra tutte ({filtered.length})
      </button>}
      {filtered.length===0&&<p className="text-sm">Nessuna anagrafica per questo filtro.</p>}
    </div>:<div className="space-y-2">
      <p className="text-xs text-[#5f524c]">
        Le segnalazioni non equivalgono a duplicati certi. Nessuna cancellazione automatica.
      </p>
      {matchingDuplicates.slice(0,showAll?undefined:50).map(d=><div key={d.key}
        className="rounded-xl border border-[#211815]/10 bg-white/85 p-3">
        <p className="text-xs font-semibold text-[#a8583e]">{d.reason} · {d.recordCount} record</p>
        <p className="mt-1 font-semibold">{d.name}</p>
        {d.email&&<p className="break-all text-xs">{d.email}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {d.personIds.map(id=><Link key={id} prefetch={false} className={action} href={"/gestione/p/"+id}>Apri anagrafica</Link>)}
          {d.personIds.length>=2&&<Link prefetch={false} className={action}
            href={"/gestione/p/"+d.personIds[0]+"/unisci/"+d.personIds[1]}>
            Valuta accorpamento
          </Link>}
          {d.reason==="modulo duplicato"&&<Link prefetch={false} className={action}
            href="/gestione/altro/soci/revisione">Esamina i moduli</Link>}
        </div>
      </div>)}
      {matchingDuplicates.length>50&&!showAll&&<button type="button" onClick={()=>setShowAll(true)}
        className="text-sm font-semibold text-[#a8583e] underline">Mostra tutte ({matchingDuplicates.length})</button>}
      {matchingDuplicates.length===0&&<p className="text-sm">Nessuna incongruenza per questa ricerca.</p>}
    </div>}
  </div>;
}
