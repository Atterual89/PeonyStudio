"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSharedPersonAction } from "@/app/gestione/(app)/anagrafica/actions";
import type { PersonFormValues } from "@/lib/gestionale/people";

type Person = {
  id: string; version: number; first_name: string | null; last_name: string | null;
  nickname: string | null; email: string | null; instagram: string | null; phone: string | null;
  courses: string[]; enteredEmails: string[]; enteredNames: string[];
};
const fieldNames = [
  ["first_name","Nome"],["last_name","Cognome"],["nickname","Nickname"],
  ["email","Email"],["phone","Telefono"],["instagram","Instagram"],
] as const;
const empty = { teamartist_id:"", notes:"" };
function draft(person: Person): PersonFormValues {
  return {...empty,first_name:person.first_name??"",last_name:person.last_name??"",
    nickname:person.nickname??"",email:person.email??"",phone:person.phone??"",
    instagram:person.instagram??""};
}
function parseInfo(text: string): Partial<PersonFormValues> {
  const found: Partial<PersonFormValues> = {};
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) found.email = email[0].toLowerCase();
  const phone = text.match(/(?:\+\d{1,3}[\s.-]*)?(?:\d[\s.-]*){8,14}/);
  if (phone) found.phone = phone[0].trim();
  const instagram = text.match(/(?:instagram|ig)\s*[:=]\s*(@?[\w.]+)/i);
  if (instagram) found.instagram = instagram[1];
  const nickname = text.match(/(?:nickname|nick)\s*[:=]\s*([^,;\n]+)/i);
  if (nickname) found.nickname = nickname[1].trim();
  const named = text.match(/(?:nome)\s*[:=]\s*([^,;\n]+)/i);
  const surname = text.match(/(?:cognome)\s*[:=]\s*([^,;\n]+)/i);
  if (named) found.first_name = named[1].trim();
  if (surname) found.last_name = surname[1].trim();
  // Non dedurre nome/cognome da testo libero ambiguo.
  return found;
}
function DirectoryPerson({person}:{person:Person}) {
  const router = useRouter();
  const [open,setOpen]=useState(false);
  const [values,setValues]=useState<PersonFormValues>(()=>draft(person));
  const [raw,setRaw]=useState("");
  const [proposal,setProposal]=useState<Partial<PersonFormValues>|null>(null);
  const [error,setError]=useState("");
  const [pending,startTransition]=useTransition();
  const name = [person.first_name,person.last_name].filter(Boolean).join(" ") || person.nickname || person.enteredNames[0] || "Persona senza nome";
  function save(){
    setError("");
    startTransition(async()=>{
      const result=await saveSharedPersonAction({personId:person.id,version:person.version,values});
      if(result.ok){setOpen(false);setProposal(null);router.refresh();}
      else setError(result.error);
    });
  }
  return <li className="rounded-xl border border-[#211815]/10 bg-white p-3 space-y-2">
    <button type="button" className="w-full text-left" onClick={()=>setOpen(!open)} aria-expanded={open}>
      <span className="block font-semibold">{name}</span>
      <span className="block text-xs text-[#5f524c]">{person.email||"Email mancante"} · {person.courses.length} corsi · {open?"Chiudi":"Apri scheda"}</span>
    </button>
    {open&&<div className="space-y-3 border-t border-[#211815]/10 pt-3">
      <p className="text-xs text-[#5f524c]">Corsi: {person.courses.join(" · ")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {fieldNames.map(([key,label])=><label key={key} className="text-sm font-medium">{label}
          <input className="mt-1 min-h-10 w-full rounded-lg border border-[#211815]/20 bg-white px-3" type={key==="email"?"email":"text"}
            value={values[key]} onChange={e=>setValues({...values,[key]:e.target.value})}/>
        </label>)}
      </div>
      {!values.email&&person.enteredEmails.length>0&&<div className="space-y-1">
        <p className="text-xs font-semibold">Email indicate nelle iscrizioni (da verificare)</p>
        {person.enteredEmails.map(e=><button key={e} type="button" className="mr-2 text-sm underline" onClick={()=>setValues({...values,email:e})}>{e} · Usa</button>)}
      </div>}
      <div className="rounded-lg bg-[#f5f0e8] p-3 space-y-2">
        <label className="block text-sm font-semibold" htmlFor={`paste-${person.id}`}>Incolla informazioni di questa persona</label>
        <textarea id={`paste-${person.id}`} rows={3} className="w-full rounded-lg border border-[#211815]/20 p-2 text-sm"
          value={raw} onChange={e=>{setRaw(e.target.value);setProposal(null);}} placeholder="Nome: ... Cognome: ... Email: ... Tel: ... Nick: ..."/>
        <button type="button" className="rounded-lg border border-[#a8583e] px-3 py-2 text-sm" onClick={()=>setProposal(parseInfo(raw))}>Estrai dati</button>
        {proposal&&<div className="space-y-2">
          {Object.entries(proposal).length===0?<p className="text-sm">Nessun campo riconosciuto: puoi compilare manualmente.</p>:<>
            <p className="text-sm font-semibold">Anteprima: scegli quali valori utilizzare</p>
            {Object.entries(proposal).map(([key,value])=><div key={key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{fieldNames.find(f=>f[0]===key)?.[1]}: {value}</span>
              <button type="button" className="font-semibold underline" onClick={()=>setValues(v=>({...v,[key]:value}))}>Usa questo</button>
            </div>)}
          </>}
        </div>}
      </div>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={save} className="min-h-10 rounded-lg bg-[#a8583e] px-4 text-sm font-semibold text-white">{pending?"Salvataggio…":"Salva in anagrafica condivisa"}</button>
        <button type="button" onClick={()=>{setOpen(false);setValues(draft(person));}} className="px-3 text-sm underline">Annulla</button>
      </div>
    </div>}
  </li>;
}
export function SharedDirectory({people}:{people:Person[]}) {
  const [query,setQuery]=useState("");
  const terms=query.toLocaleLowerCase("it").trim().split(/\s+/).filter(Boolean);
  const filtered=people.filter(p=>terms.every(t=>[p.first_name,p.last_name,p.nickname,p.email,...p.enteredNames,...p.courses].join(" ").toLocaleLowerCase("it").includes(t)));
  return <div className="space-y-3">
    <input aria-label="Cerca una persona" value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Cerca nome, nickname, email o corso" className="min-h-11 w-full rounded-xl border border-[#211815]/20 bg-white px-3"/>
    <p className="text-sm text-[#5f524c]">{filtered.length} persone su {people.length}</p>
    <ul className="space-y-2">{filtered.map(p=><DirectoryPerson key={p.id} person={p}/>)}</ul>
    {!filtered.length&&<p className="text-sm">Nessuna persona trovata.</p>}
  </div>;
}
