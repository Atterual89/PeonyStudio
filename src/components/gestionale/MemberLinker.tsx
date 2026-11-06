"use client";

import { useEffect, useState, useTransition } from "react";

import { linkMemberAction, memberSearchAction } from "@/app/gestione/(app)/w/actions";
import { memberOutcomeLabel } from "@/lib/gestionale/membership-rule";
import type { MemberSummary } from "@/lib/gestionale/types";

import { useFlash } from "./Flash";
import { InlineConfirm, Notice, buttonClass, inputClass } from "./ui";

/**
 * "Cerca nel libro soci": una voce per socio (non per fonte) con nome e
 * cognome, email e lo stato tessera che risulterebbe; collega con una
 * conferma. Collegare completa subito nome, cognome ed email vuoti (4d).
 */
export function MemberLinker({
  person,
  initialQuery,
  referenceDate,
}: {
  person: { id: string; version: number };
  initialQuery: string;
  /** Inizio del workshop (o oggi nella scheda): periodo dello stato mostrato. */
  referenceDate: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [selected, setSelected] = useState<MemberSummary | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const flash = useFlash(person.id);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await memberSearchAction(trimmed, referenceDate);
      if (cancelled) return;
      setSearchError(result.ok ? null : result.error);
      if (result.ok) setMembers(result.data);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, referenceDate]);

  function confirm() {
    if (!selected) return;
    flash.clear();
    startTransition(async () => {
      const result = await linkMemberAction({ personId: person.id, version: person.version, memberId: selected.id, referenceDate });
      // 4e (#11): collegata ma ancora "Non collegata" (omonimi senza email): lo si dice.
      if (result.ok && result.data.warning) flash.show("warning", `Collegata a ${name(selected)}, ma lo stato resta "Non collegata". ${result.data.warning}`);
      else flash.result(result, `Collegata a ${name(selected)}.`);
      if (result.ok) setSelected(null);
    });
  }

  const name = (member: MemberSummary) => [member.first_name, member.last_name].filter(Boolean).join(" ") || "Socio";

  return (
    <div className="space-y-3">
      <input
        className={inputClass}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nome, cognome o email nel libro soci"
        autoComplete="off"
      />

      {searchError ? <Notice tone="error">{searchError}</Notice> : null}

      {members && trimmed.length >= 2 ? (
        members.length === 0 ? (
          <p className="text-sm text-[#5f524c]">Nessun socio non collegato trovato.</p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-[#211815]/10 bg-white">
            {members.map((member) => (
              <li key={member.id} className="border-b border-[#211815]/5 last:border-0">
                <button
                  type="button"
                  onClick={() => setSelected(member)}
                  aria-pressed={selected?.id === member.id}
                  className={`flex min-h-10 w-full flex-col items-start justify-center px-3 py-2 text-left ${
                    selected?.id === member.id ? "bg-[#a8583e]/10" : ""
                  }`}
                >
                  <span className="font-semibold">{name(member)}</span>
                  <span className="break-all text-sm text-[#5f524c]">
                    {[member.email ?? "senza email", member.outcome ? memberOutcomeLabel(member.outcome, Boolean(member.in_book)) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {selected ? (
        <button type="button" onClick={confirm} disabled={pending} className={`${buttonClass.primary} w-full`}>
          {pending ? "Collegamento…" : `Conferma: collega a ${name(selected)}`}
        </button>
      ) : null}
      {selected?.id.startsWith("n:") ? (
        <p className="text-sm text-[#5f524c]">Socio senza email: la persona prenderà il suo nome e cognome, come nella pagina admin.</p>
      ) : null}
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
