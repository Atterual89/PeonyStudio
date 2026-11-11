"use client";

import {useRouter} from "next/navigation";
import {useState,useTransition} from "react";
import {
 organizerMatchContextAction,searchOrganizerPeopleAction,
 linkOrganizerPersonAction,splitOrganizerCompoundAction,
 type OrganizerMatchCandidate,type OrganizerMatchContext,
} from "@/app/gestione/(app)/w/person-link-actions";

const input="min-h-10 w-full rounded-lg border border-[#211815]/20 bg-white px-3 text-sm";
const outline="min-h-10 rounded-lg border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e] disabled:opacity-50";
const primary="min-h-10 rounded-lg bg-[#a8583e] px-3 text-sm font-semibold text-white disabled:opacity-50";

function CandidateList({items,selected,onSelect,radioName}:{items:OrganizerMatchCandidate[];selected:string|null;
  onSelect:(id:string)=>void;radioName:string}){
  return <div className="max-h-60 space-y-1 overflow-y-auto">
    {items.map(p=><label key={p.id}
      className={`flex min-h-10 gap-2 rounded-lg border p-2 text-sm ${p.enrolled?"opacity-50":"cursor-pointer"}`}>
      <input type="radio" name={radioName} checked={selected===p.id}
        disabled={p.enrolled} onChange={()=>onSelect(p.id)} className="mt-1 accent-[#a8583e]"/>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{p.name}</span>
        <span className="block text-xs text-[#5f524c]">
          {[p.nickname&&p.nickname!==p.name?`Nick: ${p.nickname}`:null,p.emailHint,
            p.enrolled?"Già iscritto/a a questo workshop":null].filter(Boolean).join(" · ")}
        </span>
      </span>
    </label>)}
    {items.length===0?<p className="text-sm text-[#5f524c]">Nessuna persona trovata. Prova con nome, nickname o email.</p>:null}
  </div>;
}

/** Ale può scegliere soltanto il profilo della singola persona.
 * Non può modificare dati associativi o eseguire merge.
 */
export function OrganizerPersonMatcher({participantId,enteredAs,linked=false}:{
 participantId:string;enteredAs:string;linked?:boolean;
}){
  const router=useRouter();
  const [opened,setOpened]=useState(false);
  const [context,setContext]=useState<OrganizerMatchContext|null>(null);
  const [query,setQuery]=useState(enteredAs);
  const [results,setResults]=useState<OrganizerMatchCandidate[]|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [confirm,setConfirm]=useState(false);
  const [error,setError]=useState("");
  const [done,setDone]=useState("");
  const [pending,startTransition]=useTransition();

  function open(){
    if(opened){setOpened(false);return;}
    setError("");setDone("");setSelected(null);setConfirm(false);
    setQuery(enteredAs);setResults(null);setOpened(true);
    startTransition(async()=>{
      const r=await organizerMatchContextAction({participantId});
      if(r.ok)setContext(r.data);else setError(r.error);
    });
  }
  function search(){
    setResults(null);setSelected(null);setConfirm(false);setError("");
    startTransition(async()=>{
      const r=await searchOrganizerPeopleAction({participantId,query});
      if(r.ok)setResults(r.data);else setError(r.error);
    });
  }
  function save(){
    if(!selected)return;
    setError("");
    startTransition(async()=>{
      const r=await linkOrganizerPersonAction({participantId,personId:selected});
      if(!r.ok){setError(r.error);return;}
      const refreshed=await organizerMatchContextAction({participantId});
      if(refreshed.ok)setContext(refreshed.data);
      // La RPC può terminare senza scrivere nulla se la persona è già collegata.
      // Non dichiarare "salvato" per un no-op, né confondere workshop ed Excel.
      const workshopResult=r.data.alreadyLinked
        ? "Abbinamento workshop già presente e verificato."
        : "Abbinamento workshop salvato e verificato.";
      const excelResult=r.data.excelLinked===true
        ? "Contatto Excel già collegato all'anagrafica."
        : r.data.excelLinked===false
          ? "Contatto Excel non collegato: è una verifica separata, gestita dagli admin."
          : "Collegamento Excel non verificabile in questo momento.";
      setDone(workshopResult+" "+excelResult);
      setOpened(false);setConfirm(false);router.refresh();
    });
  }
  const chosen=results?.find(p=>p.id===selected);
  return <div className="space-y-2">
    <button type="button" onClick={open} className="min-h-9 text-sm font-semibold text-[#a8583e] underline"
      aria-expanded={opened}>{opened?"Chiudi abbinamento":linked?"Modifica abbinamento":"Abbina all'anagrafica"}</button>
    {done&&<p role="status" className="text-xs text-[#326941]">{done}</p>}
    {opened&&<div className="space-y-3 rounded-lg border border-[#a8583e]/20 bg-[#f8f3ec] p-3">
      {context?.current?<p className="text-sm">
        Profilo attuale: <strong>{context.current.name}</strong>
        {context.current.nickname&&context.current.nickname!==context.current.name
          ?<span className="text-xs text-[#5f524c]"> · {context.current.nickname}</span>:null}
        <span className="ml-2 text-xs text-[#5f524c]">
          {context.confirmed?"Collegato":context.provisional?"Da abbinare":"Collegamento da verificare"}
        </span>
      </p>:null}
      <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();search();}}>
        <label className="min-w-[170px] flex-1 text-sm">Cerca una persona
          <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setResults(null);setSelected(null);}}
            placeholder="Nome, cognome, nickname o email" className={input} autoComplete="off"/>
        </label>
        <button type="submit" className={outline} disabled={pending||query.trim().length<3}>
          {pending?"Ricerca…":"Cerca"}</button>
      </form>
      {results!==null&&<CandidateList items={results} selected={selected} radioName={"person-"+participantId}
        onSelect={id=>{setSelected(id);setConfirm(false);}}/>}
      {chosen&&<div className="space-y-2 rounded-lg border border-[#211815]/10 bg-white p-2">
        <p className="text-sm"><strong>{enteredAs}</strong> → {chosen.name}
          {chosen.nickname&&chosen.nickname!==chosen.name?` (${chosen.nickname})`:""}
        </p>
        <p className="text-xs text-[#5f524c]">Modifica solo il collegamento di questa persona. Non cambia nome inserito, quota o tessera.</p>
        {!confirm?<button type="button" className={outline}
            onClick={()=>setConfirm(true)}>Rivedi abbinamento</button>:
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} disabled={pending} onClick={save}>Conferma abbinamento</button>
            <button type="button" className="min-h-10 px-2 text-sm underline" onClick={()=>setConfirm(false)}>Annulla</button>
          </div>}
      </div>}
      {error&&<p role="alert" className="text-sm text-[#9b2c2c]">{error}</p>}
    </div>}
  </div>;
}

/** Un nome composto è un solo gw_booking_participants: la scissione richiede
 * scelta manuale del partner e NON deduce l'identità da un alias.
 */
export function OrganizerCompoundSplitter({participantId,enteredAs}:{
 participantId:string;enteredAs:string;
}){
  const router=useRouter();
  const parts=enteredAs.split(/\s*\/\s*|\s*\+\s*|\s+e\s+/i).filter(Boolean);
  const [opened,setOpened]=useState(false);
  const [context,setContext]=useState<OrganizerMatchContext|null>(null);
  const [first,setFirst]=useState(parts[0]||"");
  const [second,setSecond]=useState(parts[1]||"");
  const [query,setQuery]=useState(parts[1]||"");
  const [results,setResults]=useState<OrganizerMatchCandidate[]|null>(null);
  const [partnerId,setPartnerId]=useState<string|null>(null);
  const [createProvisional,setCreateProvisional]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  if(parts.length!==2)return null;
  function open(){
    if(opened){setOpened(false);return;}
    setOpened(true);setError("");setConfirm(false);
    startTransition(async()=>{
      const r=await organizerMatchContextAction({participantId});
      if(r.ok)setContext(r.data);else setError(r.error);
    });
  }
  function search(){
    setError("");setResults(null);setPartnerId(null);setCreateProvisional(false);setConfirm(false);
    startTransition(async()=>{
      const r=await searchOrganizerPeopleAction({participantId,query});
      if(r.ok)setResults(r.data);else setError(r.error);
    });
  }
  function save(){
    setError("");
    startTransition(async()=>{
      const r=await splitOrganizerCompoundAction({
        participantId,firstName:first.trim(),secondName:second.trim(),
        secondPersonId:partnerId,createProvisional,
      });
      if(!r.ok){setError(r.error);return;}
      setOpened(false);router.refresh();
    });
  }
  const choice=results?.find(p=>p.id===partnerId);
  return <div className="space-y-2">
    <button type="button" className="min-h-9 text-sm font-semibold text-[#a8583e] underline"
      onClick={open} aria-expanded={opened}>{opened?"Chiudi divisione":"Dividi in due persone"}</button>
    {opened&&<div className="space-y-3 rounded-lg border border-[#a8583e]/20 bg-[#f8f3ec] p-3">
      {context&&!context.canSplit?<p className="text-sm text-[#9b2c2c]">
        La divisione è disponibile solo per iscrizioni con una persona provvisoria non ancora collegata.
      </p>:null}
      {context?.canSplit&&<>
        <p className="text-sm text-[#5f524c]">L'iscrizione rimane unica: prezzo, acconti e note restano invariati.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Prima persona
            <input className={input} value={first} onChange={e=>{setFirst(e.target.value);setConfirm(false);}}/>
          </label>
          <label className="text-sm">Partner
            <input className={input} value={second} onChange={e=>{setSecond(e.target.value);setConfirm(false);}}/>
          </label>
        </div>
        <p className="text-xs text-[#5f524c]">La prima persona manterrà la scheda provvisoria attuale. Il partner va scelto nell'anagrafica oppure creato esplicitamente come provvisorio.</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();search();}}>
          <label className="min-w-[160px] flex-1 text-sm">Cerca il partner nell'anagrafica
            <input className={input} value={query} onChange={e=>{setQuery(e.target.value);setResults(null);setPartnerId(null);setConfirm(false);}}
              placeholder="Es. Maru o Maryna" autoComplete="off"/>
          </label>
          <button type="submit" className={outline} disabled={pending||query.trim().length<3}>Cerca</button>
        </form>
        {results!==null&&<CandidateList items={results} selected={partnerId} radioName={"partner-"+participantId}
          onSelect={id=>{setPartnerId(id);setCreateProvisional(false);setConfirm(false);}}/>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={createProvisional}
            onChange={e=>{setCreateProvisional(e.target.checked);if(e.target.checked)setPartnerId(null);setConfirm(false);}}/>
          Il partner non esiste: crea una scheda provvisoria
        </label>
        {(choice||createProvisional)&&<div className="space-y-2 rounded-lg bg-white p-3">
          <p className="text-sm"><strong>{enteredAs}</strong> → <strong>{first}</strong> + <strong>{second}</strong></p>
          <p className="text-xs text-[#5f524c]">Partner: {choice?.name||"Nuova persona provvisoria"}.
            Non vengono modificati pagamenti, tessere né altre anagrafiche.</p>
          {!confirm?<button type="button" className={outline} disabled={!first.trim()||!second.trim()}
            onClick={()=>setConfirm(true)}>Rivedi divisione</button>:
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} disabled={pending} onClick={save}>Conferma divisione</button>
            <button type="button" className="min-h-10 px-2 text-sm underline"
              onClick={()=>setConfirm(false)}>Annulla</button>
          </div>}
        </div>}
      </>}
      {error&&<p role="alert" className="text-sm text-[#9b2c2c]">{error}</p>}
    </div>}
  </div>;
}
