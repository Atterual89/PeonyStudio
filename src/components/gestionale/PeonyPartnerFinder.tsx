"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePeonyPartnerAction, searchPeonyPartnerAction, type PeonyPartnerCandidate } from "@/app/gestione/(app)/peony/actions";

const LABELS: Record<NonNullable<PeonyPartnerCandidate["membership"]>,string> = {
  valid:"Verificata", payment_missing:"Quota da verificare", missing_form:"Modulo assente",
};

export function PeonyPartnerFinder({
  eventId,ticketId,hasPartner,
}: {eventId:string;ticketId:string;hasPartner:boolean}) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<PeonyPartnerCandidate[]>([]);
  const [selected,setSelected]=useState<PeonyPartnerCandidate|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [searched,setSearched]=useState(false);
  const [confirmRemove,setConfirmRemove]=useState(false);
  const [busy,startTransition]=useTransition();

  function search() {
    setSelected(null);setError(null);setSearched(false);
    startTransition(async()=>{
      try{
        const result=await searchPeonyPartnerAction(eventId,query);
        if(!result.ok){setResults([]);setError(result.error);return;}
        setResults(result.candidates);
        setSearched(true);
      }catch{setError("Ricerca non riuscita. Riprova.");}
    });
  }
  function save(choice:{kind:"member"|"person";id:string}|null){
    setError(null);
    startTransition(async()=>{
      try{
        const result=await savePeonyPartnerAction(eventId,ticketId,choice);
        if(!result.ok){setError(result.error);return;}
        setOpen(false);setConfirmRemove(false);setResults([]);setSelected(null);setQuery("");
        router.refresh();
      }catch{setError("Non riesco a salvare il partner.");}
    });
  }
  return (
    <div className="border-t border-[#211815]/10 pt-2">
      {!open ? (
        <button type="button" className="min-h-10 text-sm font-semibold text-[#a8583e] underline"
          onClick={()=>setOpen(true)}>{hasPartner?"Cambia partner":"Cerca e collega partner"}</button>
      ) : (
        <div className="space-y-2 rounded-xl bg-[#f2ede3] p-3">
          <p className="text-sm font-semibold">Cerca partner nell'anagrafica soci</p>
          <form className="flex flex-wrap gap-2" onSubmit={(event)=>{event.preventDefault();search();}}>
            <input type="search" aria-label="Cerca partner per nome cognome o email"
              placeholder="Nome, cognome o email" value={query} autoComplete="off"
              onChange={(event)=>{setQuery(event.target.value);setResults([]);setSelected(null);setSearched(false);}}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#211815]/15 bg-white px-3 text-sm"/>
            <button type="submit" disabled={busy||query.trim().length<2}
              className="min-h-10 rounded-lg border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e] disabled:opacity-50">
              {busy?"Ricerca…":"Cerca"}
            </button>
          </form>
          {searched&&!results.length?<p className="text-xs text-[#5f524c]">Nessuna corrispondenza. Controlla il nome o l'email.</p>:null}
          {results.length>0?(
            <fieldset className="space-y-1">
              <legend className="mb-1 text-xs text-[#5f524c]">Seleziona il risultato corretto (controlla l'email in caso di omonimia)</legend>
              {results.map((row)=>(
                <label key={`${row.kind}:${row.id}`}
                  className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${selected?.id===row.id&&selected.kind===row.kind?"border-[#a8583e] bg-white":"border-[#211815]/10 bg-white/60"}`}>
                  <input type="radio" name={`partner-${ticketId}`} checked={selected?.id===row.id&&selected.kind===row.kind}
                    onChange={()=>setSelected(row)} className="accent-[#a8583e]"/>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{row.name}</span>
                    <span className="block break-all text-xs text-[#5f524c]">{row.email??"Email non disponibile"} · {row.origin}</span>
                  </span>
                  <span className={`text-right text-xs ${row.membership==="valid"?"text-[#326941]":"text-[#9b4b1e]"}`}>
                    {row.membership?LABELS[row.membership]:"Da verificare"}
                  </span>
                </label>
              ))}
            </fieldset>
          ):null}
          {error?<p role="alert" className="text-xs font-semibold text-[#9b2c2c]">{error}</p>:null}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!selected||busy}
              onClick={()=>selected&&save({kind:selected.kind,id:selected.id})}
              className="min-h-10 rounded-lg bg-[#a8583e] px-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy?"Salvataggio…":"Conferma partner"}
            </button>
            <button type="button" className="min-h-10 px-2 text-sm text-[#5f524c]" disabled={busy}
              onClick={()=>{setOpen(false);setConfirmRemove(false);setError(null);}}>Chiudi</button>
            {hasPartner && !confirmRemove ? (
              <button type="button" onClick={()=>setConfirmRemove(true)} disabled={busy}
                className="min-h-10 px-2 text-xs text-[#9b2c2c] underline">Rimuovi partner</button>
            ) : null}
          </div>
          {confirmRemove ? (
            <div className="rounded-lg border border-[#9b2c2c]/20 bg-white p-2 text-xs">
              <p>Rimuovere il partner da questa iscrizione? La persona resta nell'anagrafica.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={()=>save(null)}
                  className="min-h-10 rounded-lg bg-[#9b2c2c] px-3 font-semibold text-white">Conferma rimozione</button>
                <button type="button" className="min-h-10 px-2" onClick={()=>setConfirmRemove(false)}>Annulla</button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
