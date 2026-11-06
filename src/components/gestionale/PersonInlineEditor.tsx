"use client";

import { useState, useTransition } from "react";

import { updatePersonAction } from "@/app/gestione/(app)/p/actions";
import { personToFormValues, validatePersonForm, type MemberField, type PersonFormValues } from "@/lib/gestionale/people";
import { PERSON_FIELD_LABELS, type MemberSummary, type Person, type PersonFields } from "@/lib/gestionale/types";

import { useFlash } from "./Flash";
import { MemberHints } from "./MemberHints";
import { Field, Notice, buttonClass, inputClass } from "./ui";

const FIELDS: { key: keyof PersonFields; props?: React.InputHTMLAttributes<HTMLInputElement> }[] = [
  { key: "first_name" },
  { key: "last_name" },
  { key: "nickname" },
  { key: "email", props: { type: "email", inputMode: "email", autoComplete: "off" } },
  { key: "instagram", props: { placeholder: "@nome" } },
  { key: "phone", props: { type: "tel", inputMode: "tel" } },
];

/** "Modifica dati" sul posto, nella riga aperta del tab Partecipanti. */
export function PersonInlineEditor({
  person,
  member,
  initial,
  onDone,
}: {
  person: Person;
  member: MemberSummary | null;
  /** Valori già scelti con "usa questo" (libro soci). */
  initial?: Partial<Record<MemberField, string>>;
  onDone: () => void;
}) {
  // Tutti i campi (anche note e TeamArtist, non mostrati qui) vanno salvati invariati.
  const [values, setValues] = useState<PersonFormValues>(() => ({ ...personToFormValues(person), ...initial }));
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFields, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const flash = useFlash(person.id);

  function save() {
    setError(null);
    const validation = validatePersonForm(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updatePersonAction({ id: person.id, version: person.version, values });
      if (result.ok) {
        flash.show("success", "Dati salvati.");
        onDone();
      } else setError(result.error);
    });
  }

  return (
    <div className="space-y-3 rounded-xl bg-[#f2ede3] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, props }) => (
          <Field key={key} label={PERSON_FIELD_LABELS[key]} error={errors[key]}>
            <input className={inputClass} value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} {...props} />
          </Field>
        ))}
      </div>
      <MemberHints member={member} values={values} onUse={(field, value) => setValues({ ...values, [field]: value })} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={pending} className={buttonClass.primary}>
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        <button type="button" onClick={onDone} className={buttonClass.ghost}>
          Chiudi
        </button>
      </div>
    </div>
  );
}
