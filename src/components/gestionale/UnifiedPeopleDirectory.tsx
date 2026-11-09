"use client";

import Link from "next/link";
import { useMemo,useState } from "react";
import { normalizeText } from "@/lib/gestionale/format";
import type { UnifiedContact } from "@/lib/gestionale/unified-directory";
import { MemberQuickLink } from "./MemberQuickLink";
import { InlinePersonNickname,QuickPersonQuota,RegistryPersonActions } from "./PersonDirectoryActions";
import { AssociationStatusDot,AssociationDotLegend,type AssociationDotStatus } from "./AssociationStatusDot";

const directoryDot:Record<UnifiedContact["association"],AssociationDotStatus>={
  verificata:"verified",da_verificare:"missing_form",solo_modulo:"payment_missing",
  non_presente:"unlinked",non_disponibile:"unknown",
};
type View="people"|"review"|"registry";
type Status="all"|"verified"|"payment_missing"|"missing";
type Source="all"|"google"|"official"|"manual";
const isReview=(c:UnifiedContact)=>c.kind==="registro"||c.link==="da_verificare"||
  (c.personId!==null&&c.link!=="confermato"&&c.association!=="verificata");
const contains=(a:string,b:string)=>normalizeText(a).includes(normalizeText(b));

export function UnifiedPeopleDirectory({contacts,initialQuery=""}:{contacts:UnifiedContact[];initialQuery?:string}){
  const [query,setQuery]=useState(initialQuery);
  const [view,setView]=useState<View>("people");
  const [status,setStatus]=useState<Status>("all");
  const [source,setSource]=useState<Source>("all");
  const [missingEmail,setMissingEmail]=useState(false);
  const [openKey,setOpenKey]=useState<string|null>(null);
  const [showAll,setShowAll]=useState(false);
  const [savedMessage,setSavedMessage]=useState<string|null>(null);
  const counts={
    people:contacts.filter(c=>Boolean(c.personId)).length,
    review:contacts.filter(isReview).length,
    registry:contacts.filter(c=>c.kind==="registro").length,
  };
  const filtered=useMemo(()=>{
    const tokens=normalizeText(query).split(/\s+/).filter(Boolean);
    return contacts.filter(contact=>{
      // Una ricerca esplicita include sempre le fonti non ancora collegate.
      const fromView=tokens.length>0||(
        view==="people"?Boolean(contact.personId):
        view==="review"?isReview(contact):contact.kind==="registro"
      );
      const statusOkay=status==="all"||
        (status==="verified"&&contact.association==="verificata")||
        (status==="payment_missing"&&contact.association==="solo_modulo")||
        (status==="missing"&&["da_verificare","non_presente"].includes(contact.association));
      const sourceOkay=source==="all"||
        (source==="google"&&contains(contact.source,"Google"))||
        (source==="official"&&contains(contact.source,"Libro soci"))||
        (source==="manual"&&contains(contact.source,"manuale"));
      return fromView&&statusOkay&&sourceOkay&&(!missingEmail||!contact.email)&&
        tokens.every(token=>normalizeText(contact.search).includes(token));
    });
  },[contacts,query,view,status,source,missingEmail]);
  const shown=showAll?filtered:filtered.slice(0,80);
  return <div className="space-y-3">
    {savedMessage&&<div role="status" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border border-[#326941]/40 bg-[#eef6ee] p-3 text-sm text-[#326941] shadow-lg">
      <span>{savedMessage}</span>
      <button type="button" className="font-semibold underline" onClick={()=>setSavedMessage(null)}>Chiudi</button>
    </div>}
    <label htmlFor="people-lookup" className="sr-only">Cerca persone, nickname o email</label>
    <input id="people-lookup" type="search" autoComplete="off"
      value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false);}}
      placeholder="Cerca nome, cognome, nickname o email"
      className="min-h-10 w-full rounded-xl border border-[#211815]/20 bg-white p-3 text-sm"/>
    <div className="flex flex-wrap gap-2" aria-label="Viste anagrafica">
      {([
        {id:"people",name:"Anagrafiche",count:counts.people},
        {id:"review",name:"Da sistemare",count:counts.review},
        {id:"registry",name:"Solo registro soci",count:counts.registry},
      ] as const).map(item=><button type="button" key={item.id} onClick={()=>{setView(item.id);setShowAll(false);}}
        aria-pressed={view===item.id}
        className={`min-h-10 rounded-xl px-3 text-sm font-semibold ${view===item.id?"bg-[#a8583e] text-white":"border border-[#211815]/15 bg-white text-[#5f524c]"}`}>
        {item.name} ({item.count})
      </button>)}
    </div>
    <details className="rounded-xl border border-[#211815]/10 bg-white/65 p-3">
      <summary className="min-h-9 cursor-pointer py-1 text-sm font-semibold text-[#5f524c]">
        Altri filtri{status!=="all"||source!=="all"||missingEmail?" · attivi":""}
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-[#5f524c]">Stato associazione
          <select value={status} onChange={e=>setStatus(e.target.value as Status)}
            className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/15 bg-white px-2 text-sm">
            <option value="all">Tutti</option>
            <option value="verified">In regola</option>
            <option value="payment_missing">Quota da verificare</option>
            <option value="missing">Modulo o collegamento mancante</option>
          </select>
        </label>
        <label className="text-xs text-[#5f524c]">Provenienza
          <select value={source} onChange={e=>setSource(e.target.value as Source)}
            className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/15 bg-white px-2 text-sm">
            <option value="all">Tutte le fonti</option>
            <option value="google">Modulo Google</option>
            <option value="official">Libro soci ufficiale</option>
            <option value="manual">Verifica manuale</option>
          </select>
        </label>
      </div>
      <label className="mt-3 flex min-h-9 items-center gap-2 text-sm">
        <input type="checkbox" checked={missingEmail} onChange={e=>setMissingEmail(e.target.checked)}
          className="h-4 w-4 accent-[#a8583e]"/> Solo senza email
      </label>
      <AssociationDotLegend/>
    </details>
    <p className="text-xs text-[#5f524c]">{filtered.length} {filtered.length===1?"risultato":"risultati"}</p>
    <ul className="divide-y divide-[#211815]/10 overflow-hidden rounded-xl border border-[#211815]/10 bg-white">
      {shown.map(contact=>{
        const open=openKey===contact.key;
        return <li key={contact.key} className="p-3">
          <button type="button" onClick={()=>setOpenKey(open?null:contact.key)}
            aria-expanded={open} className="flex min-h-10 w-full items-center justify-between gap-2 text-left">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold">
                <AssociationStatusDot status={directoryDot[contact.association]}/>
                <span className="break-words">{contact.name}</span>
              </span>
              <span className="mt-1 block text-xs text-[#5f524c]">
                {[contact.nickname?"Nickname: "+contact.nickname:null,
                  contact.kind==="registro"?"Solo nel registro soci":null].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 text-lg text-[#a8583e]" aria-hidden="true">{open?"−":"+"}</span>
          </button>
          {open&&<div className="mt-2 space-y-3 border-t border-[#211815]/10 pt-3 text-sm">
            {contact.email?<p className="break-all">{contact.email}</p>:<p className="text-[#9b4b1e]">Email non disponibile</p>}
            <details className="text-xs text-[#5f524c]">
              <summary className="cursor-pointer text-[#a8583e]">Origine e abbinamento</summary>
              <p className="mt-1">{contact.source}{contact.link==="confermato"?" · Confermato":
                contact.link==="email"?" · Corrispondenza email":
                contact.link==="da_verificare"?" · Da confermare":""}</p>
            </details>
            <div className="flex flex-wrap items-start gap-2">
              {contact.personId&&<Link prefetch={false} href={`/gestione/p/${contact.personId}`}
                className="inline-flex min-h-9 items-center rounded-lg border border-[#211815]/15 px-3 font-semibold text-[#a8583e]">Apri / modifica</Link>}
              {contact.personId&&<InlinePersonNickname personId={contact.personId} onSaved={setSavedMessage}/>}
              {contact.personId&&contact.association==="solo_modulo"&&
                <QuickPersonQuota personId={contact.personId} onSaved={setSavedMessage}/>}
              {!contact.personId&&contact.possiblePersonId&&
                <Link prefetch={false} href={`/gestione/p/${contact.possiblePersonId}`}
                  className="inline-flex min-h-9 items-center text-[#a8583e] underline">Apri anagrafica suggerita</Link>}
              {!contact.personId&&contact.memberKey&&
                <RegistryPersonActions memberKey={contact.memberKey} registryName={contact.name} onSaved={setSavedMessage}/>}
            </div>
            {contact.personId&&contact.personVersion!==null&&
              <MemberQuickLink personId={contact.personId} version={contact.personVersion}
                personName={contact.nickname||contact.name} mode={contact.link==="confermato"?"change":"link"}
                onSaved={setSavedMessage}/>}
            {!contact.personId&&!contact.memberKey&&
              <p className="text-xs text-[#5f524c]">Controlla l'identità prima di collegare una scheda.</p>}
          </div>}
        </li>;
      })}
    </ul>
    {filtered.length===0&&<p className="text-sm">Nessun risultato con questi filtri.</p>}
    {!showAll&&filtered.length>shown.length&&<button type="button"
      className="min-h-10 text-sm font-semibold text-[#a8583e] underline"
      onClick={()=>setShowAll(true)}>Mostra tutti ({filtered.length})</button>}
  </div>;
}
