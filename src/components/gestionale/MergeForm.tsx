"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { mergePeopleAction } from "@/app/gestione/(app)/p/actions";
import { displayName } from "@/lib/gestionale/format";
import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { personToFormValues } from "@/lib/gestionale/people";
import { PERSON_FIELD_LABELS, type Person, type PersonFields } from "@/lib/gestionale/types";

import { Notice, buttonClass, cardClass } from "./ui";

type Side = "primary" | "secondary";
type Field = keyof PersonFields | "member";

const FIELDS: Field[] = [...(Object.keys(PERSON_FIELD_LABELS) as (keyof PersonFields)[]), "member"];
const LABELS: Record<Field, string> = { ...PERSON_FIELD_LABELS, member: "Collegamento libro soci" };

/** Valore del campo; "member" = chiave del socio collegato (member-key.ts). */
function valueOf(person: Person, field: Field): string | null {
  return field === "member" ? memberKeyOfPerson(person) : person[field];
}

/** Confronto campo per campo: per ogni campo diverso si sceglie il valore da tenere. */
export function MergeForm({
  primary,
  secondary,
  memberLabels,
}: {
  primary: Person;
  secondary: Person;
  memberLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Predefinito: il valore della principale, oppure quello della secondaria se la principale è vuota.
  const [choice, setChoice] = useState<Record<Field, Side>>(
    () =>
      Object.fromEntries(
        FIELDS.map((field) => [field, valueOf(primary, field) ? "primary" : valueOf(secondary, field) ? "secondary" : "primary"]),
      ) as Record<
        Field,
        Side
      >,
  );

  const display = (person: Person, field: Field) => {
    const value = valueOf(person, field);
    if (!value) return "—";
    return field === "member" ? memberLabels[value] ?? "Socio collegato" : value;
  };

  function merge() {
    setError(null);
    const pick = (field: Field) => valueOf(choice[field] === "primary" ? primary : secondary, field);
    const values = personToFormValues(Object.fromEntries(FIELDS.filter((f) => f !== "member").map((field) => [field, pick(field)])));

    startTransition(async () => {
      const result = await mergePeopleAction({
        primary: { id: primary.id, version: primary.version },
        secondary: { id: secondary.id, version: secondary.version },
        values,
        memberKey: pick("member"),
      });
      if (result.ok) router.push(`/gestione/p/${primary.id}`);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className={`${cardClass} divide-y divide-[#211815]/5`}>
        {FIELDS.map((field) => {
          const a = display(primary, field);
          const b = display(secondary, field);
          const same = (valueOf(primary, field) ?? "") === (valueOf(secondary, field) ?? "");
          return (
            <fieldset key={field} className="px-3 py-2">
              <legend className="text-sm font-medium text-[#5f524c]">{LABELS[field]}</legend>
              {same ? (
                <p className="mt-1">{a}</p>
              ) : (
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {(["primary", "secondary"] as const).map((side) => (
                    <label
                      key={side}
                      className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
                        choice[field] === side ? "border-[#a8583e] bg-[#a8583e]/5" : "border-[#211815]/10"
                      }`}
                    >
                      <input
                        type="radio"
                        name={field}
                        checked={choice[field] === side}
                        onChange={() => setChoice({ ...choice, [field]: side })}
                        className="h-5 w-5 accent-[#a8583e]"
                      />
                      <span className="break-words">{side === "primary" ? a : b}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <label className="flex min-h-10 items-center gap-3">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-5 w-5 accent-[#a8583e]" />
        <span>
          Confermo: unisci <strong>{displayName(secondary)}</strong> in <strong>{displayName(primary)}</strong>. Le iscrizioni passano
          alla scheda principale.
        </span>
      </label>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <button type="button" onClick={merge} disabled={!confirmed || pending} className={`${buttonClass.primary} w-full sm:w-auto`}>
        {pending ? "Unione in corso…" : "Unisci"}
      </button>
    </div>
  );
}
