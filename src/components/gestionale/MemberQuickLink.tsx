"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { findLinkedMemberProfileAction, linkMemberAction, memberSearchAction } from "@/app/gestione/(app)/w/actions";
import type { MemberSummary } from "@/lib/gestionale/types";
import { buttonClass, inputClass } from "./ui";

type Notice = { kind: "error" | "success"; text: string };

const memberName = (member: MemberSummary) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email || "Socio";

/** One inline flow: find the profile by nickname, search the member independently,
 * explicitly choose and save the link. Does not validate or modify membership dues.
 */
export function MemberQuickLink({
  personId, version, personName, onSaved, mode = "link",
}: {
  personId: string;
  version: number;
  personName: string;
  onSaved?: (message: string) => void;
  mode?: "link" | "change";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [selected, setSelected] = useState<MemberSummary | null>(null);
  const [linkedProfile,setLinkedProfile]=useState<{id:string;name:string;sameProfile:boolean}|null>(null);
  const [resolving,setResolving]=useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const sequence = useRef(0);

  function editQuery(value: string) {
    sequence.current += 1;
    setQuery(value);
    setMembers(null);
    setSelected(null);
    setLinkedProfile(null);
    setNotice(null);
    setSearching(false);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 2 || pending || searching) return;
    const request = ++sequence.current;
    setSearching(true);
    setNotice(null);
    try {
      const result = await memberSearchAction(query.trim());
      if (sequence.current !== request) return;
      if (!result.ok) {
        setMembers(null);
        setNotice({ kind: "error", text: result.error });
      } else {
        setMembers(result.data.members);
        setSelected(null);
        setLinkedProfile(null);
      }
    } catch {
      if (sequence.current === request)
        setNotice({ kind: "error", text: "Ricerca nel libro soci non riuscita. Riprova." });
    } finally {
      if (sequence.current === request) setSearching(false);
    }
  }

  async function choose(memberId:string){
    const member=members?.find(item=>item.id===memberId)??null;
    setSelected(member);
    setLinkedProfile(null);
    setNotice(null);
    const request=++sequence.current;
    if(!member?.alreadyLinked)return;
    setResolving(true);
    try {
      const result=await findLinkedMemberProfileAction({memberId:member.id,currentPersonId:personId});
      if(request!==sequence.current)return;
      if(result.ok)setLinkedProfile(result.data);
      else setNotice({kind:"error",text:result.error});
    }catch{
      if(request===sequence.current)setNotice({kind:"error",text:"Impossibile individuare la scheda già collegata."});
    }finally{
      if(request===sequence.current)setResolving(false);
    }
  }

  function confirm() {
    if (!selected || selected.alreadyLinked || pending) return;
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await linkMemberAction({
          personId, version, memberId: selected.id,
        });
        if (!result.ok) {
          setNotice({ kind: "error", text: result.error });
          return;
        }
        const message = `Collegamento salvato: ${personName} → ${memberName(selected)}. La quota associativa non è stata modificata.`;
        setNotice({ kind: "success", text: message });
        onSaved?.(message);
        setMembers(null);
        setSelected(null);
        router.refresh();
      } catch {
        setNotice({ kind: "error", text: "Collegamento non riuscito. Ricarica la pagina e riprova." });
      }
    });
  }

  return <div className="space-y-2">
    <button type="button" className="min-h-10 text-sm font-semibold text-[#a8583e] underline"
      aria-expanded={open} onClick={() => { setOpen(!open); setNotice(null); }}>
      {mode === "change" ? "Cambia abbinamento" : "Cerca nel libro soci"}
    </button>
    {open && <div className="space-y-2 rounded-xl border border-[#a8583e]/30 bg-[#f8f3ea] p-3">
      <p className="text-sm font-semibold">Collega {personName} a una socia o un socio</p>
      <p className="text-xs text-[#5f524c]">Cerca per nome, nickname o email, anche se il nickname è diverso.</p>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`find-member-${personId}`}>Nome o email nel libro soci</label>
        <input id={`find-member-${personId}`} className={`${inputClass} min-w-0 flex-1`}
          type="search" value={query} onChange={event => editQuery(event.target.value)}
          placeholder="Nome, cognome o email della socia" autoComplete="off" />
        <button type="submit" disabled={pending || searching || query.trim().length < 2}
          className={buttonClass.secondary}>{searching ? "Ricerca…" : "Cerca"}</button>
      </form>
      {members && (members.length ? <div className="space-y-1">
        <label htmlFor={`choose-member-${personId}`} className="block text-xs font-semibold text-[#5f524c]">Seleziona la registrazione</label>
        <select id={`choose-member-${personId}`} className={inputClass} value={selected?.id??""}
          disabled={pending||resolving} onChange={event=>{void choose(event.target.value);}}> 
          <option value="">Seleziona…</option>
          {members.map(member=><option key={member.id} value={member.id}>
            {memberName(member)} · {member.email||"email assente"}{member.alreadyLinked?" · scheda esistente":""}
          </option>)}
        </select>
        <p className="text-xs text-[#5f524c]">Se è già collegata, apri la scheda esistente.</p>
      </div> : <p className="text-sm text-[#5f524c]">Nessuna socia trovata: prova il cognome o una parte dell'email.</p>)}
      {selected?.alreadyLinked&&<div className="space-y-2 rounded-lg border border-[#a8583e]/30 bg-white p-3 text-sm">
        <p><strong>{memberName(selected)}</strong> risulta già collegata a un'anagrafica.</p>
        {resolving&&<p role="status">Controllo la scheda esistente…</p>}
        {linkedProfile&&(linkedProfile.sameProfile
          ? <p role="status" className="text-[#326941]">È già la stessa anagrafica: non serve un secondo collegamento.</p>
          : <>
            <p>Scheda esistente: <strong>{linkedProfile.name}</strong>.</p>
            <p>Se <strong>{personName}</strong> è soltanto un altro nome usato per <strong>{linkedProfile.name}</strong>, confronta i dati e unisci le due schede. Le iscrizioni resteranno collegate alla persona esistente.</p>
            <p className="font-semibold text-[#9b4b1e]">Se il nome inserito da Ale indica due persone (ad esempio «Pavel/Maru»), verifica prima chi era effettivamente iscritto: non unire schede di persone diverse.</p>
            <Link prefetch={false} href={`/gestione/p/${linkedProfile.id}/unisci/${personId}`}
              className="inline-flex min-h-10 items-center rounded-lg bg-[#a8583e] px-3 py-2 font-semibold text-white">
              Confronta le schede e unisci
            </Link>
          </>)}
      </div>}
      {selected && !selected.alreadyLinked && <div className="space-y-2 rounded-lg border border-[#a8583e]/30 bg-white p-3">
        <p className="text-sm">Confermi che <strong>{personName}</strong> e <strong>{memberName(selected)}</strong> sono la stessa persona?</p>
        <button type="button" disabled={pending} onClick={confirm} className={buttonClass.primary}>
          {pending ? "Salvataggio…" : "Conferma collegamento"}
        </button>
      </div>}
      {notice && <p role={notice.kind === "error" ? "alert" : "status"}
        className={`rounded-lg p-2 text-sm ${notice.kind === "error" ? "bg-[#fdf3e9] text-[#9b4b1e]" : "bg-[#eef6ee] text-[#326941]"}`}>
        {notice.text}
      </p>}
      <button type="button" className="min-h-10 text-xs text-[#5f524c] underline"
        onClick={() => setOpen(false)}>Chiudi</button>
    </div>}
  </div>;
}
