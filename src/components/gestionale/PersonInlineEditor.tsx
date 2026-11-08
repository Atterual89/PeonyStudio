"use client";

import { useEffect, useState, useTransition } from "react";

import { suggestPersonEmailsAction, updatePersonAction } from "@/app/gestione/(app)/p/actions";
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
  const [suggestions, setSuggestions] = useState<{email:string;source:string;identity:string;exactName:boolean}[]>([]);
  const [suggestionError, setSuggestionError] = useState("");
  useEffect(() => {
    if (person.email) return;
    let alive = true;
    void suggestPersonEmailsAction(person.id).then(result => {
      if (!alive) return;
      if (result.ok) setSuggestions(result.suggestions);
      else setSuggestionError(result.error);
    }).catch(() => { if (alive) setSuggestionError("Impossibile caricare i suggerimenti."); });
    return () => { alive = false; };
  }, [person.id, person.email]);

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
      {!person.email && suggestions.length > 0 ? (
        <div className="rounded-xl border border-[#211815]/15 bg-white p-3">
          <p className="text-sm font-semibold">Possibili email da verificare</p>
          <p className="mt-1 text-xs text-[#5f524c]">La proposta non è una conferma di identità. Controlla prima di utilizzarla.</p>
          <ul className="mt-2 space-y-2">
            {suggestions.map(item => <li key={item.email} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#211815]/10 pt-2 text-sm">
              <span className="min-w-0">
                <strong className="block break-all">{item.email}</strong>
                <span className="block text-xs text-[#5f524c]">{item.source} · {item.identity}{item.exactName ? " · Nome corrispondente" : " · Nome da controllare"}</span>
              </span>
              <button type="button" className={buttonClass.secondary} onClick={() => setValues(v => ({...v,email:item.email}))}>Usa questo</button>
            </li>)}
          </ul>
        </div>
      ) : null}
      {suggestionError ? <p className="text-xs text-[#7a5212]">{suggestionError}</p> : null}
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
