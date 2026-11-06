"use client";

// "+ Nuova persona" (4d, B2, solo admin): nickname e/o nome e cognome, altri
// nomi, email, Instagram, note. Nessuna iscrizione: la persona è pronta per
// l'abbinamento quando Ale scriverà il suo nome. Prima di salvare, avviso se
// esiste già una persona con lo stesso nickname, altro nome, nome + cognome o
// email ("Esiste già: X — apri").

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createPersonAction, findExistingPeopleAction } from "@/app/gestione/(app)/p/alias-actions";
import type { ExistingPerson } from "@/lib/gestionale/aliases";
import { personToFormValues, validatePersonForm, type PersonFormValues } from "@/lib/gestionale/people";
import { PERSON_FIELD_LABELS, type PersonFields } from "@/lib/gestionale/types";

import { Field, Notice, buttonClass, inputClass } from "./ui";

const FIELDS: { key: keyof PersonFields; props?: React.InputHTMLAttributes<HTMLInputElement> }[] = [
  { key: "nickname" },
  { key: "first_name" },
  { key: "last_name" },
  { key: "email", props: { type: "email", inputMode: "email", autoComplete: "off" } },
  { key: "instagram", props: { placeholder: "@nome" } },
];

const REASONS: Record<ExistingPerson["reason"], string> = {
  nickname: "stesso nickname",
  "altro nome": "stesso altro nome",
  "nome e cognome": "stesso nome e cognome",
  email: "stessa email",
};

export function NewPersonForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PersonFormValues>(personToFormValues({}));
  const [aliases, setAliases] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFields, string>>>({});
  const [existing, setExisting] = useState<ExistingPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const aliasList = () => aliases.split(/[,\n]/).map((alias) => alias.trim()).filter(Boolean);

  function save(force: boolean) {
    setError(null);
    const validation = validatePersonForm(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      if (!force) {
        const found = await findExistingPeopleAction({ values, aliases: aliasList() });
        if (!found.ok) {
          setError(found.error);
          return;
        }
        if (found.data.length > 0) {
          setExisting(found.data);
          return;
        }
      }
      const result = await createPersonAction({ values, aliases: aliasList() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/gestione/p/${result.data.id}`);
    });
  }

  if (!open) {
    return (
      <button type="button" className={buttonClass.secondary} onClick={() => setOpen(true)}>
        + Nuova persona
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-[#f2ede3] p-3">
      <p className="font-semibold">Nuova persona</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, props }) => (
          <Field key={key} label={PERSON_FIELD_LABELS[key]} error={errors[key]}>
            <input
              className={inputClass}
              value={values[key]}
              onChange={(e) => {
                setExisting(null);
                setValues({ ...values, [key]: e.target.value });
              }}
              {...props}
            />
          </Field>
        ))}
        <Field label="Altri nomi" hint="separati da virgola (nome d'arte, @handle, soprannome)">
          <input
            className={inputClass}
            value={aliases}
            onChange={(e) => {
              setExisting(null);
              setAliases(e.target.value);
            }}
          />
        </Field>
      </div>
      <Field label={PERSON_FIELD_LABELS.notes}>
        <textarea className={`${inputClass} min-h-20 py-2`} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
      </Field>

      {existing ? (
        <div className="space-y-2 rounded-xl border border-[#b7791f]/30 bg-[#fdf3e1] p-3 text-sm text-[#7a5212]">
          {existing.map((person) => (
            <p key={person.id}>
              Esiste già: <strong>{person.name}</strong> ({REASONS[person.reason]}) —{" "}
              <Link prefetch={false} href={`/gestione/p/${person.id}`} className="font-semibold underline">
                apri
              </Link>
            </p>
          ))}
        </div>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.primary} disabled={pending} onClick={() => save(Boolean(existing))}>
          {pending ? "Salvataggio…" : existing ? "Salva comunque" : "Salva"}
        </button>
        <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => setOpen(false)}>
          Chiudi
        </button>
      </div>
    </div>
  );
}
