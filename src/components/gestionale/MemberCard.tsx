"use client";

import { useTransition } from "react";

import { completeFromMemberAction, applyMemberValueAction } from "@/app/gestione/(app)/p/actions";
import { formatDate } from "@/lib/gestionale/format";
import { memberFill, memberFullName, unsplitMemberName } from "@/lib/gestionale/member-name";
import { memberDifferences } from "@/lib/gestionale/people";
import { PERSON_FIELD_LABELS, type MemberSummary, type MembershipBadge as Badge, type Person } from "@/lib/gestionale/types";

import { useFlash } from "./Flash";
import { MembershipBadge } from "./MembershipBadge";
import { buttonClass } from "./ui";

/**
 * Socio collegato (D11): "Collegata a <Nome> <Cognome>", Nome, Cognome,
 * Email, stato tessera. "Completa con i dati del libro soci" riempie solo i
 * campi vuoti (con storico); per i campi pieni e diversi "Nel libro soci: X —
 * usa questo" (`showDifferences`: dove non c'è già il modulo con i suggerimenti).
 * Nessuna scrittura senza un tocco.
 */
export function MemberCard({
  person,
  member,
  badge,
  showDifferences = true,
  compact = false,
}: {
  person: Pick<Person, "id" | "version" | "first_name" | "last_name" | "email">;
  member: MemberSummary;
  badge: Badge | null;
  showDifferences?: boolean;
  /** Blocco persona del tab Partecipanti (4d): solo le differenze "Nel libro soci: X — usa questo". */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const flash = useFlash(person.id);
  const fill = memberFill(person, member);
  const unsplit = unsplitMemberName(person, member);
  const differences = showDifferences
    ? memberDifferences(person, member).filter(({ field }) => field === "email" || member.name_split)
    : [];

  function complete() {
    flash.clear();
    startTransition(async () => {
      const result = await completeFromMemberAction({ personId: person.id });
      flash.result(result, result.ok && result.data.filled ? "Dati completati dal libro soci." : "Niente da completare.");
    });
  }

  function applyValue(field: "first_name" | "last_name" | "email") {
    flash.clear();
    startTransition(async () => {
      flash.result(await applyMemberValueAction({ personId: person.id, version: person.version, field }), "Salvato.");
    });
  }

  const differenceList =
    differences.length > 0 ? (
      <ul className="space-y-1 text-sm text-[#7a5212]">
        {differences.map(({ field, value }) => (
          <li key={field} className="flex flex-wrap items-center gap-x-2">
            <span>
              {PERSON_FIELD_LABELS[field]} — nel libro soci: <strong>{value}</strong>
            </span>
            <button type="button" className="min-h-10 font-semibold underline" disabled={pending} onClick={() => applyValue(field)}>
              usa questo
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  if (compact) {
    return differenceList || unsplit ? (
      <div className="space-y-1">
        {differenceList}
        {unsplit ? <p className="text-sm text-[#7a5212]">Nel libro soci nome e cognome sono in un solo campo («{unsplit}»): completali a mano.</p> : null}
      </div>
    ) : null;
  }

  return (
    <div className="space-y-2 rounded-xl bg-[#f2ede3] p-3 text-sm">
      <p>
        Collegata a <strong>{memberFullName(member)}</strong>
        {member.expires_at ? <span className="text-[#5f524c]"> · ultima scadenza {formatDate(member.expires_at)}</span> : null}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {member.name_split ? (
          <>
            <dt className="text-[#5f524c]">Nome</dt>
            <dd>{member.first_name ?? "—"}</dd>
            <dt className="text-[#5f524c]">Cognome</dt>
            <dd>{member.last_name ?? "—"}</dd>
          </>
        ) : (
          <>
            <dt className="text-[#5f524c]">Nome e cognome</dt>
            <dd>{member.first_name ?? "—"}</dd>
          </>
        )}
        <dt className="text-[#5f524c]">Email</dt>
        <dd className="break-all">{member.email ?? "—"}</dd>
        {badge ? (
          <>
            <dt className="text-[#5f524c]">Tessera</dt>
            <dd>
              <MembershipBadge badge={badge} />
            </dd>
          </>
        ) : null}
      </dl>

      {differenceList}

      {unsplit ? (
        <p className="text-[#7a5212]">Nel libro soci nome e cognome sono in un solo campo («{unsplit}»): completali a mano.</p>
      ) : null}

      {Object.keys(fill).length > 0 ? (
        <button type="button" className={buttonClass.secondary} disabled={pending} onClick={complete}>
          {pending ? "Salvataggio…" : "Completa con i dati del libro soci"}
        </button>
      ) : null}
    </div>
  );
}
