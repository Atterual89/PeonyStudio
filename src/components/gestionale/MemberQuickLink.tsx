"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { linkMemberAction, memberSearchAction } from "@/app/gestione/(app)/w/actions";
import type { MemberSummary } from "@/lib/gestionale/types";
import { buttonClass, inputClass } from "./ui";

type Notice = { kind: "error" | "success"; text: string };

const memberName = (member: MemberSummary) =>
  [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email || "Socio";

/** One inline flow: find the profile by nickname, search the member independently,
 * explicitly choose and save the link. Does not validate or modify membership dues.
 */
export function MemberQuickLink({
  personId, version, personName, onSaved,
}: {
  personId: string;
  version: number;
  personName: string;
  onSaved?: (message: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [selected, setSelected] = useState<MemberSummary | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const sequence = useRef(0);

  function editQuery(value: string) {
    sequence.current += 1;
    setQuery(value);
    setMembers(null);
    setSelected(null);
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
      }
    } catch {
      if (sequence.current === request)
        setNotice({ kind: "error", text: "Ricerca nel libro soci non riuscita. Riprova." });
    } finally {
      if (sequence.current === request) setSearching(false);
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
      Collega al libro soci
    </button>
    {open && <div className="space-y-2 rounded-xl border border-[#a8583e]/30 bg-[#f8f3ea] p-3">
      <p className="text-sm font-semibold">Collega {personName} a una socia o un socio</p>
      <p className="text-xs text-[#5f524c]">Cerca con il nome anagrafico o l'email del libro soci, anche se il nickname è diverso.</p>
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`find-member-${personId}`}>Nome o email nel libro soci</label>
        <input id={`find-member-${personId}`} className={`${inputClass} min-w-0 flex-1`}
          type="search" value={query} onChange={event => editQuery(event.target.value)}
          placeholder="Nome, cognome o email della socia" autoComplete="off" />
        <button type="submit" disabled={pending || searching || query.trim().length < 2}
          className={buttonClass.secondary}>{searching ? "Ricerca…" : "Cerca"}</button>
      </form>
      {members && (members.length ? <div className="space-y-1">
        <label htmlFor={`choose-member-${personId}`} className="block text-xs font-semibold text-[#5f524c]">Seleziona la socia dal libro soci</label>
        <select id={`choose-member-${personId}`} className={inputClass} value={selected?.id??""}
          disabled={pending} onChange={event=>{
            setSelected(members.find(member=>member.id===event.target.value)??null);
            setNotice(null);
          }}>
          <option value="">Seleziona…</option>
          {members.map(member=><option key={member.id} value={member.id} disabled={member.alreadyLinked}>
            {memberName(member)} · {member.email||"email assente"}{member.alreadyLinked?" · già collegata":""}
          </option>)}
        </select>
        <p className="text-xs text-[#5f524c]">Le persone già collegate ad altre schede non sono selezionabili.</p>
      </div> : <p className="text-sm text-[#5f524c]">Nessuna socia trovata: prova il cognome o una parte dell'email.</p>)}
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
