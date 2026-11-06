"use client";

import { memberDifferences, type MemberField } from "@/lib/gestionale/people";
import { PERSON_FIELD_LABELS, type MemberSummary } from "@/lib/gestionale/types";

/**
 * 3b: per i campi pieni ma diversi dal libro soci, "Nel libro soci: <valore>
 * — usa questo". Segnala anche se il socio non ha email nel libro soci.
 */
export function MemberHints({
  member,
  values,
  onUse,
}: {
  member: MemberSummary | null;
  values: Partial<Record<MemberField, string | null>>;
  onUse: (field: MemberField, value: string) => void;
}) {
  if (!member) return null;
  const differences = memberDifferences(values, member);
  if (differences.length === 0 && member.email) return null;

  return (
    <ul className="space-y-1 text-sm text-[#7a5212]">
      {differences.map(({ field, value }) => (
        <li key={field} className="flex flex-wrap items-center gap-x-2">
          <span>
            {PERSON_FIELD_LABELS[field]} — nel libro soci: <strong>{value}</strong>
          </span>
          <button type="button" className="min-h-10 font-semibold underline" onClick={() => onUse(field, value)}>
            usa questo
          </button>
        </li>
      ))}
      {!member.email ? <li>Nel libro soci questo socio non ha un&apos;email.</li> : null}
    </ul>
  );
}
