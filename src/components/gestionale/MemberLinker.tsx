"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useState,useTransition} from "react";

import {
  attachMemberFormEmailAction,linkMemberAction,memberSearchAction,
  type RegistryPersonHit,
} from "@/app/gestione/(app)/w/actions";
import {memberOutcomeLabel} from "@/lib/gestionale/membership-rule";
import type {MemberSummary} from "@/lib/gestionale/types";
import {useFlash} from "./Flash";
import {InlineConfirm,Notice,buttonClass,inputClass} from "./ui";

/** Ricerca amministrativa: libro, moduli e anagrafica. Un nickname da solo
 * serve a TROVARE una scheda, mai a dichiarare pagata una quota.
 */
export function MemberLinker({
  person,initialQuery,referenceDate,
}:{
  person:{
    id:string;version:number;
    currentMemberId:string|null;
    hasNameLink:boolean;
    email:string|null;
  };
  initialQuery:string;
  referenceDate:string;
}) {
  const router=useRouter();
  const [query,setQuery]=useState(initialQuery);
  const [members,setMembers]=useState<MemberSummary[]|null>(null);
  const [people,setPeople]=useState<RegistryPersonHit[]>([]);
  const [selected,setSelected]=useState<MemberSummary|null>(null);
  const [searchError,setSearchError]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const flash=useFlash(person.id);
  const trimmed=query.trim();
  const canUseFormEmail=(member:MemberSummary)=>
    Boolean(person.hasNameLink&&!person.email&&member.source==="modulo"&&member.email);
  const blocked=(member:MemberSummary)=>
    member.id===person.currentMemberId ||
    Boolean(member.alreadyLinked) ||
    Boolean(person.currentMemberId && !canUseFormEmail(member));
  const name=(member:MemberSummary)=>
    [member.first_name,member.last_name].filter(Boolean).join(" ")||member.email||"Socio";

  useEffect(()=>{
    setSelected(null);
    if(trimmed.length<2){setMembers(null);setPeople([]);setSearchError(null);return;}
    let cancelled=false;
    const timer=setTimeout(async()=>{
      let result:Awaited<ReturnType<typeof memberSearchAction>>;
      try{ result=await memberSearchAction(trimmed,referenceDate); }
      catch { if(!cancelled)setSearchError("Ricerca temporaneamente non disponibile. Riprova.");return; }
      if(cancelled)return;
      setSearchError(result.ok?null:result.error);
      if(result.ok){
        setMembers(result.data.members);
        setPeople(result.data.people.filter(item=>item.id!==person.id));
      }
    },250);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[trimmed,referenceDate,person.id]);

  function confirm(){
    if(!selected||blocked(selected))return;
    flash.clear();
    startTransition(async()=>{
      try{
      if(canUseFormEmail(selected)){
        const result=await attachMemberFormEmailAction({
          personId:person.id,version:person.version,memberId:selected.id,
        });
        flash.result(result,"Email del modulo collegata. Il libro soci resta invariato; la quota 2027 va verificata separatamente.");
        if(result.ok){setSelected(null);setMembers(null);router.refresh();}
      }else{
        const result=await linkMemberAction({
          personId:person.id,version:person.version,memberId:selected.id,referenceDate,
        });
        if(result.ok&&result.data.warning){
          flash.show("warning",`Collegamento salvato, ma lo stato va verificato: ${result.data.warning}`);
        }else flash.result(result,`Collegata a ${name(selected)}.`);
        if(result.ok){setSelected(null);setMembers(null);router.refresh();}
      }
      }catch {flash.show("error","Collegamento non riuscito. Ricarica la scheda e riprova.");}
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#211815]/10 bg-[#f8f3ea] p-3">
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Cerca nei registri soci e nell'anagrafica</span>
        <input className={inputClass} value={query} onChange={event=>setQuery(event.target.value)}
          placeholder="Anche solo parte di nome, cognome, nickname o email" autoComplete="off"
          enterKeyHint="search" />
      </label>
      {searchError?<Notice tone="error">{searchError}</Notice>:null}
      {members&&trimmed.length>=2?(
        <>
          <p className="text-xs text-[#5f524c]">Risultati del libro soci Team Artist e dei moduli Google. Controlla l'identità prima di collegare.</p>
          {members.length===0?<p className="text-sm text-[#5f524c]">Nessun socio trovato nei registri con questi termini.</p>:(
            <ul className="overflow-hidden rounded-xl border border-[#211815]/15 bg-white">
              {members.map(member=>(
                <li key={member.id} className="border-b border-[#211815]/10 last:border-b-0">
                  <button type="button" disabled={blocked(member)} onClick={()=>setSelected(member)}
                    aria-pressed={selected?.id===member.id}
                    className={`flex min-h-10 w-full flex-col items-start justify-center gap-1 px-3 py-2 text-left
                      ${selected?.id===member.id?"bg-[#a8583e]/10":""} disabled:cursor-default disabled:opacity-70`}>
                    <span className="font-semibold">{name(member)}</span>
                    <span className="break-all text-xs text-[#5f524c]">
                      {[
                        member.source==="modulo"?"Modulo Google":member.source==="libro"?"Libro soci Team Artist":"Conferma manuale",
                        member.email??"Email non presente",
                        member.outcome?memberOutcomeLabel(member.outcome,Boolean(member.in_book)):null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                    {member.matchedAlias?<span className="text-xs text-[#5f524c]">Trovata anche come: {member.matchedAlias}</span>:null}
                    {member.id===person.currentMemberId?(
                      <span className="text-xs font-semibold text-[#326941]">Già collegata a questa scheda</span>
                    ):member.alreadyLinked&&!canUseFormEmail(member)?(
                      <span className="text-xs text-[#7a5212]">Già collegata in anagrafica: controlla la scheda esistente</span>
                    ):null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {people.length>0?(
            <div className="space-y-1">
              <p className="text-sm font-semibold">Persone già nell'anagrafica</p>
              <ul className="rounded-xl border border-[#211815]/10 bg-white">
                {people.map(item=>(
                  <li key={item.id} className="border-b border-[#211815]/10 last:border-0">
                    <Link prefetch={false} href={`/gestione/p/${item.id}`}
                      className="block px-3 py-2 text-sm hover:bg-[#f8f3ea]">
                      <span className="block font-semibold">{item.displayName}</span>
                      <span className="block text-xs text-[#5f524c]">{item.detail||"Nickname o nome già presente"} · Apri scheda</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ):null}
          {members.length===0&&people.length===0?(
            <p className="text-xs text-[#5f524c]">Prova una parte del cognome, del nickname o l'indirizzo email.</p>
          ):null}
        </>
      ):null}
      {selected&&!blocked(selected)?(
        <div className="space-y-2">
          {canUseFormEmail(selected)?(
            <p className="text-xs text-[#5f524c]">La selezione aggiunge solo l'email del modulo Google a questa scheda.
              Il collegamento al libro soci Team Artist resta invariato. Non conferma il pagamento della quota 2027.</p>
          ):null}
          <button type="button" onClick={confirm} disabled={pending} className={`${buttonClass.primary} w-full`}>
            {pending?"Salvataggio…":canUseFormEmail(selected)?`Conferma email di ${name(selected)}`:`Conferma: collega a ${name(selected)}`}
          </button>
        </div>
      ):null}
    </div>
  );
}

/**
 * Fase 5: "Scollega dal libro soci" nella scheda persona, con conferma sul
 * posto. Toglie solo il collegamento della persona (con storico): il libro
 * soci e le validazioni manuali non cambiano.
 */
export function MemberUnlink({ person, memberName }: { person: { id: string; version: number }; memberName: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const flash = useFlash(person.id);

  function confirm() {
    flash.clear();
    startTransition(async () => {
      const result = await linkMemberAction({ personId: person.id, version: person.version, memberId: null });
      flash.result(result, "Scollegata dal libro soci.");
      setAsking(false);
    });
  }

  return asking ? (
    <InlineConfirm
      question={`Scollegare da ${memberName}?`}
      note="Il libro soci non cambia: si toglie solo il collegamento di questa scheda."
      confirmLabel="Scollega"
      danger
      pending={pending}
      onConfirm={confirm}
      onCancel={() => setAsking(false)}
    />
  ) : (
    <button type="button" className={buttonClass.ghost} onClick={() => setAsking(true)}>
      Scollega dal libro soci
    </button>
  );
}
