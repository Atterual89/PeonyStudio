"use client";

import { useEffect, useState } from "react";
import { searchBillingDirectoryAction, type BillingEntry } from "@/app/gestione/(app)/anagrafica/billing-actions";
import { inputClass } from "./ui";

export function BillingNameAutocomplete({
  value, selectedId, onText, onPick, placeholder,
}: {
  value:string;selectedId:string|null;onText:(text:string)=>void;
  onPick:(entry:BillingEntry)=>void;placeholder:string;
}) {
  const [results,setResults]=useState<BillingEntry[]>([]);
  const [focused,setFocused]=useState(false);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!focused||selectedId||value.trim().length<2){return;}
    let cancelled=false;
    const timer=setTimeout(async()=>{
      setLoading(true);
      const r=await searchBillingDirectoryAction({query:value});
      if(cancelled)return;
      setLoading(false);
      setResults(r.ok?r.data:[]);
    },260);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[value,focused,selectedId]);
  function change(text:string){
    onText(text);
    setResults([]);
  }
  return <div className="relative">
    <input className={inputClass} value={value} onChange={e=>change(e.target.value)}
      onFocus={()=>setFocused(true)} onBlur={()=>setTimeout(()=>setFocused(false),180)}
      autoComplete="off" autoCapitalize="words" placeholder={placeholder}/>
    {selectedId&&<div className="mt-1 flex items-center gap-2 text-xs text-[#326941]">
      <span>Scheda anagrafica selezionata</span>
      <button type="button" className="underline" onClick={()=>{onText(value);setFocused(true);}}>Cambia</button>
    </div>}
    {focused&&!selectedId&&value.trim().length>=2&&results.length>0&&
      <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#211815]/20 bg-white shadow-lg">
        {results.map(p=><li key={p.id}>
          <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{
            onPick(p);setResults([]);setFocused(false);
          }} className="block w-full px-3 py-2 text-left hover:bg-[#f2ede3]">
            <span className="block font-semibold">{p.name}</span>
            <span className="block truncate text-xs text-[#5f524c]">
              {[p.nickname?"Nickname: "+p.nickname:null,p.email||"Anagrafica fatture"].filter(Boolean).join(" · ")}
            </span>
          </button>
        </li>)}
      </ul>}
    {focused&&!selectedId&&value.trim().length>=2&&loading&&
      <p className="text-xs text-[#5f524c]">Ricerca nell'anagrafica…</p>}
  </div>;
}
