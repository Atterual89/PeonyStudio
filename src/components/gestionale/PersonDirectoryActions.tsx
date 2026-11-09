"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  createRegistryPersonAction, linkRegistryProfileAction, searchDirectoryProfilesAction,
  type DirectoryProfileChoice,
} from "@/app/gestione/(app)/persone/actions";
import { addAliasAction } from "@/app/gestione/(app)/p/alias-actions";
import { markQuotaOkAction } from "@/app/gestione/(app)/p/membership-actions";

const actionClass="min-h-9 rounded-lg border border-[#a8583e]/35 px-3 py-1.5 text-sm font-semibold text-[#a8583e] disabled:opacity-50";
const secondaryClass="min-h-9 rounded-lg border border-[#211815]/15 px-3 py-1.5 text-sm text-[#5f524c]";
const inputClass="min-h-10 w-full rounded-lg border border-[#211815]/20 bg-white px-3 text-sm";

export function InlinePersonNickname({personId,onSaved}:{
  personId:string;onSaved:(message:string)=>void;
}) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [error,setError]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();

  function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!name.trim())return;
    startTransition(async()=>{
      try{
        const result=await addAliasAction({personId,alias:name.trim()});
        if(!result.ok){setError(result.error);return;}
        setOpen(false);setName("");setError(null);
        onSaved("Nickname aggiunto.");
        router.refresh();
      }catch{setError("Impossibile salvare il nickname.");}
    });
  }
  return <div className="min-w-0">
    <button type="button" className={actionClass} onClick={()=>{setOpen(!open);setError(null);}}>
      + Nickname
    </button>
    {open&&<form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={save}>
      <label className="min-w-[150px] flex-1 text-xs text-[#5f524c]">
        Altro nickname
        <input autoFocus maxLength={100} className={inputClass} value={name}
          onChange={event=>{setName(event.target.value);setError(null);}}
          placeholder="Inserisci nickname"/>
      </label>
      <button className={actionClass} type="submit" disabled={pending||!name.trim()}>
        {pending?"Salvataggio…":"Salva"}
      </button>
      {error&&<p role="alert" className="w-full text-xs text-[#9b2c2c]">{error}</p>}
    </form>}
  </div>;
}

export function QuickPersonQuota({personId,onSaved}:{
  personId:string;onSaved:(message:string)=>void;
}){
  const router=useRouter();
  const [error,setError]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  return <div>
    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#211815]/15 px-3 text-sm">
      <input type="checkbox" disabled={pending} checked={false} onChange={checked=>{
        if(!checked)return;
        setError(null);
        startTransition(async()=>{
          try{
            const result=await markQuotaOkAction({personId});
            if(!result.ok){setError(result.error);return;}
            onSaved("Quota OK salvata.");router.refresh();
          }catch{setError("Impossibile salvare la quota.");}
        });
      }} className="h-4 w-4 accent-[#a8583e]"/>
      {pending?"Salvataggio…":"Quota OK"}
    </label>
    {error&&<p role="alert" className="mt-1 text-xs text-[#9b2c2c]">{error}</p>}
  </div>;
}

export function RegistryPersonActions({
  memberKey,registryName,onSaved,
}:{
  memberKey:string;registryName:string;onSaved:(message:string)=>void;
}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState(registryName);
  const [results,setResults]=useState<DirectoryProfileChoice[]|null>(null);
  const [selected,setSelected]=useState<DirectoryProfileChoice|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [confirmCreate,setConfirmCreate]=useState(false);
  const [created,setCreated]=useState<{id:string;warning:string|null}|null>(null);
  const [pending,startTransition]=useTransition();

  function search(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setSelected(null);setError(null);setConfirmCreate(false);
    startTransition(async()=>{
      try{
        const result=await searchDirectoryProfilesAction(query);
        if(!result.ok){setError(result.error);setResults(null);return;}
        setResults(result.data);
      }catch{setError("Ricerca non riuscita.");}
    });
  }
  function link(){
    if(!selected)return;
    setError(null);
    startTransition(async()=>{
      try{
        const result=await linkRegistryProfileAction({
          personId:selected.id,version:selected.version,memberKey,
        });
        if(!result.ok){setError(result.error);return;}
        setOpen(false);onSaved("Anagrafica collegata.");router.refresh();
      }catch{setError("Collegamento non riuscito.");}
    });
  }
  function create(){
    setError(null);
    startTransition(async()=>{
      try{
        const result=await createRegistryPersonAction(memberKey);
        if(!result.ok){setError(result.error);setConfirmCreate(false);return;}
        setCreated({id:result.data.id,warning:result.data.warning});
        setConfirmCreate(false);
        onSaved(result.data.linked?"Anagrafica creata e collegata.":"Anagrafica creata: collegamento da completare.");
        router.refresh();
      }catch{setError("Creazione non riuscita.");}
    });
  }
  return <div className="space-y-2">
    <button type="button" className={actionClass}
      aria-expanded={open} onClick={()=>{setOpen(!open);setError(null);}}>
      Collega o crea anagrafica
    </button>
    {open&&<div className="space-y-3 rounded-xl border border-[#a8583e]/25 bg-[#f8f3ea] p-3">
      <p className="text-sm font-semibold">Anagrafica per {registryName}</p>
      <form className="flex flex-wrap gap-2" onSubmit={search}>
        <label className="sr-only" htmlFor={`registry-search-${memberKey}`}>Cerca nell'anagrafica</label>
        <input id={`registry-search-${memberKey}`} className={`${inputClass} min-w-[170px] flex-1`}
          value={query} onChange={event=>{setQuery(event.target.value);setResults(null);setSelected(null);}}
          placeholder="Nome, nickname o email" autoComplete="off"/>
        <button type="submit" className={actionClass} disabled={pending||query.trim().length<2}>
          {pending?"Ricerca…":"Cerca"}
        </button>
      </form>
      {results&&results.length>0&&<div className="space-y-1">
        <p className="text-xs font-semibold text-[#5f524c]">Scegli la scheda corretta</p>
        {results.map(p=><label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#211815]/10 bg-white p-2 text-sm">
          <input type="radio" className="mt-1 accent-[#a8583e]" name={`select-${memberKey}`}
            checked={selected?.id===p.id} onChange={()=>{setSelected(p);setError(null);}}/>
          <span className="min-w-0 flex-1">
            <strong>{p.name}</strong>
            {p.nickname&&<span className="block text-xs text-[#5f524c]">Nickname: {p.nickname}</span>}
            {p.email&&<span className="block break-all text-xs text-[#5f524c]">{p.email}</span>}
            {p.hasMemberLink&&<span className="block text-xs text-[#946321]">Già collegata a un socio: verificare prima di sostituire</span>}
          </span>
          <Link href={`/gestione/p/${p.id}`} className="text-xs text-[#a8583e] underline">Apri</Link>
        </label>)}
      </div>}
      {results?.length===0&&<p className="text-xs text-[#5f524c]">Nessuna scheda trovata con questa ricerca.</p>}
      {selected&&<div className="space-y-2 rounded-lg border border-[#a8583e]/25 bg-white p-3 text-sm">
        <p>Confermi che <strong>{registryName}</strong> e <strong>{selected.name}</strong> sono la stessa persona?</p>
        <button type="button" className={actionClass} onClick={link} disabled={pending}>
          {pending?"Collegamento…":"Conferma collegamento"}
        </button>
      </div>}
      <div className="border-t border-[#211815]/10 pt-2">
        {!confirmCreate?<button type="button" className={secondaryClass}
          disabled={pending} onClick={()=>{setConfirmCreate(true);setSelected(null);}}>
          + Crea nuova scheda
        </button>:<div className="space-y-2 rounded-lg bg-white p-3 text-sm">
          <p>Crea una nuova anagrafica per <strong>{registryName}</strong> solo se non esiste già. Il sistema controlla eventuali duplicati.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={actionClass} onClick={create} disabled={pending}>
              {pending?"Creazione…":"Conferma creazione"}
            </button>
            <button type="button" className={secondaryClass} onClick={()=>setConfirmCreate(false)} disabled={pending}>Annulla</button>
          </div>
        </div>}
      </div>
      {created&&<p role="status" className="text-sm text-[#326941]">
        {created.warning??"Scheda collegata."} <Link href={`/gestione/p/${created.id}`} className="underline">Apri scheda</Link>
      </p>}
      {error&&<p role="alert" className="text-sm text-[#9b2c2c]">{error}</p>}
      <button type="button" className="text-xs text-[#5f524c] underline"
        onClick={()=>{setOpen(false);setSelected(null);}}>Chiudi</button>
    </div>}
  </div>;
}
