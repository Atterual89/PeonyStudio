"use client";

import Link from "next/link";
import {useMemo,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {matchAleContactAction,type AleMatchRow} from "@/app/gestione/(app)/altro/soci/abbinamenti-ale/actions";

export type AleMatchCandidate={
  key:string;personId:string|null;name:string;nickname:string|null;email:string|null;
  search:string;source:string;association:string;
};
const norm=(v:string)=>v.trim().toLocaleLowerCase("it").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");
const control="min-h-10 rounded-lg border border-[#211815]/20 bg-white px-3 text-sm";
function State({association}:{association:string}){
  const labels:Record<string,string>={
    verificata:"Quota verificata",solo_modulo:"Modulo presente · quota da verificare",
    da_verificare:"Associazione da verificare",non_presente:"Modulo non trovato",
    non_disponibile:"Verifica non disponibile",
  };
  return <span className="text-xs text-[#5f524c]">{labels[association]||association}</span>;
}

export function AdminAleMatchingPanel({rows,candidates}:{rows:AleMatchRow[];candidates:AleMatchCandidate[]}){
  const router=useRouter();
  const [filter,setFilter]=useState<"pending"|"linked"|"all">("pending");
  const [query,setQuery]=useState("");
  const [open,setOpen]=useState<string|null>(null);
  const [candidateQuery,setCandidateQuery]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [confirming,setConfirming]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [matchedLocal,setMatchedLocal]=useState<Record<string,string>>({});
  const [busy,startTransition]=useTransition();
  const filtered=rows.filter(row=>{
    const linked=Boolean(row.personId||matchedLocal[row.id]);
    return (filter==="all"||(filter==="linked"?linked:!linked))&&
      (!query.trim()||norm(row.displayName+" "+row.email).includes(norm(query)));
  });
  const choices=useMemo(()=>{
    const tokens=norm(candidateQuery).split(/\s+/).filter(Boolean);
    if(!tokens.length)return [];
    const matches=candidates.filter(c=>tokens.every(t=>norm(c.search+" "+c.source).includes(t)));
    return matches.sort((a,b)=>
      Number(Boolean(b.personId))-Number(Boolean(a.personId)) ||
      a.name.localeCompare(b.name,"it")).slice(0,15);
  },[candidateQuery,candidates]);
  function openRow(row:AleMatchRow){
    setOpen(open===row.id?null:row.id);
    setCandidateQuery(row.displayName);
    setSelected(null);setConfirming(false);setError("");setMessage("");
  }
  function commit(row:AleMatchRow){
    if(!selected)return;
    const personId=selected;
    setError("");setMessage("");setConfirming(false);
    startTransition(async()=>{
      const result=await matchAleContactAction({contactId:row.id,personId});
      if(!result.ok){setError(result.error);return;}
      setMatchedLocal(prev=>({...prev,[row.id]:personId}));
      setSelected(null);setOpen(null);
      setMessage("Abbinamento confermato. Il contatto fiscale ora converge nella scheda comune.");
      router.refresh();
    });
  }
  const pending=rows.filter(row=>!row.personId&&!matchedLocal[row.id]).length;
  return <div className="space-y-3">
    <p className="text-sm text-[#5f524c]">
      Confronta i contatti importati da Alessandra con Persone, libro soci, moduli Google e quote.
      I risultati sono solo suggerimenti: nessun abbinamento viene eseguito prima della tua conferma.
    </p>
    {message&&<p role="status" className="rounded-lg bg-[#eef6ee] p-3 text-sm text-[#326941]">{message}</p>}
    {error&&<p role="alert" className="rounded-lg bg-[#fff1f0] p-3 text-sm text-[#9b2c2c]">{error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {([
        ["pending","Da abbinare",pending],
        ["linked","Abbinati",rows.length-pending],
        ["all","Tutti",rows.length],
      ] as const).map(([id,label,count])=><button key={id} type="button" aria-pressed={filter===id}
        className={`min-h-10 rounded-lg border px-3 text-sm ${filter===id?"border-[#a8583e] bg-[#a8583e]/10 font-semibold":"border-[#211815]/15 bg-white"}`}
        onClick={()=>setFilter(id)}>{label} ({count})</button>)}
    </div>
    <input type="search" className={control+" w-full"} aria-label="Cerca i contatti di Alessandra"
      placeholder="Cerca contatto importato" value={query} onChange={e=>setQuery(e.target.value)}/>
    <ul className="space-y-2">
      {filtered.slice(0,150).map(row=>{
        const linked=row.personId||matchedLocal[row.id];
        const chosen=selected?candidates.find(c=>c.personId===selected):null;
        return <li key={row.id} className="rounded-xl border border-[#211815]/10 bg-white p-3">
          <button type="button" className="flex w-full items-center justify-between gap-2 text-left"
            disabled={Boolean(linked)} aria-expanded={open===row.id}
            onClick={()=>openRow(row)}>
            <span className="min-w-0">
              <span className="block font-semibold">{row.displayName}</span>
              <span className="block break-all text-xs text-[#5f524c]">{row.email||"Email non presente"}</span>
            </span>
            <span className="shrink-0 text-xs text-[#5f524c]">
              {linked?"Abbinato":open===row.id?"Chiudi":"Abbina"}
            </span>
          </button>
          {linked&&<Link prefetch={false} href={`/gestione/p/${linked}`}
            className="mt-1 inline-block text-xs text-[#a8583e] underline">Apri scheda comune</Link>}
          {open===row.id&&!linked&&<div className="mt-3 space-y-3 border-t border-[#211815]/10 pt-3">
            <label className="block text-sm font-medium">Cerca nella scheda comune e nel libro soci
              <input className={control+" mt-1 w-full"} type="search" value={candidateQuery}
                placeholder="Nome, cognome, nickname o email"
                onChange={e=>{setCandidateQuery(e.target.value);setSelected(null);setConfirming(false);}}/>
            </label>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {choices.map(candidate=><div key={candidate.key} className="rounded-lg border border-[#211815]/10 p-2">
                <div className="flex items-start gap-2">
                  {candidate.personId?<input type="radio" name={`match-${row.id}`}
                    checked={selected===candidate.personId} onChange={()=>{setSelected(candidate.personId);setConfirming(false);}}
                    className="mt-1.5 accent-[#a8583e]"/>:<span className="mt-1 text-xs">—</span>}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">{candidate.name}
                      {candidate.nickname?<span className="ml-2 text-xs font-normal text-[#5f524c]">{candidate.nickname}</span>:null}
                    </p>
                    <p className="break-all text-xs">{candidate.email||"Email non presente"}</p>
                    <p className="mt-1 text-xs text-[#5f524c]">{candidate.source}</p>
                    <State association={candidate.association}/>
                    {!candidate.personId&&<p className="mt-1 text-xs text-[#9b4b1e]">
                      Solo nel registro: crea o collega prima una persona in Persone.
                    </p>}
                  </div>
                </div>
              </div>)}
              {candidateQuery.trim()&&choices.length===0&&<p className="text-sm text-[#5f524c]">Nessuna corrispondenza. Cerca anche per email o nickname.</p>}
            </div>
            <Link href={`/gestione/persone?q=${encodeURIComponent(candidateQuery.slice(0,100))}`}
              prefetch={false} className="inline-block text-xs text-[#a8583e] underline">
              Apri Persone per creare o collegare una scheda
            </Link>
            {chosen&&<div className="rounded-lg border border-[#a8583e]/30 bg-[#f8f3ec] p-3">
              <p className="text-sm">Contatto Alessandra <strong>{row.displayName}</strong> → scheda comune <strong>{chosen.name}</strong></p>
              <p className="mt-1 text-xs text-[#5f524c]">La conferma collega solo i dati fiscali; non valida moduli o quote e non modifica le iscrizioni.</p>
              {!confirming?<button type="button" className="mt-2 min-h-10 rounded-lg bg-[#a8583e] px-3 text-sm font-semibold text-white"
                onClick={()=>setConfirming(true)}>Rivedi e conferma</button>:
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" disabled={busy} onClick={()=>commit(row)} className="min-h-10 rounded-lg bg-[#a8583e] px-3 text-sm font-semibold text-white">Conferma abbinamento</button>
                  <button type="button" className="text-sm underline" onClick={()=>setConfirming(false)}>Annulla</button>
                </div>}
            </div>}
          </div>}
        </li>;
      })}
    </ul>
    {filtered.length>150&&<p className="text-xs">Mostrati 150 di {filtered.length}. Restringi la ricerca.</p>}
    {!filtered.length&&<p className="text-sm text-[#5f524c]">Nessun contatto da mostrare.</p>}
  </div>;
}
