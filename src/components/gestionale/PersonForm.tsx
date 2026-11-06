"use client";

import { useState, useTransition } from "react";

import { pendingEntriesAction } from "@/app/gestione/(app)/p/alias-actions";
import { updatePersonAction } from "@/app/gestione/(app)/p/actions";
import { personToFormValues, validatePersonForm, type PersonFormValues } from "@/lib/gestionale/people";
import type { PersonAlias } from "@/lib/gestionale/aliases";
import { PERSON_FIELD_LABELS, type MemberSummary, type Person, type PersonFields } from "@/lib/gestionale/types";

import { MemberHints } from "./MemberHints";
import { LinkPendingPrompt, PersonAliases } from "./PersonAliases";
import { Field, Notice, buttonClass, inputClass } from "./ui";

const INPUT_PROPS: Partial<Record<keyof PersonFields, React.InputHTMLAttributes<HTMLInputElement>>> = {
  email: { type: "email", inputMode: "email", autoComplete: "off" },
  phone: { type: "tel", inputMode: "tel" },
  instagram: { placeholder: "@nome" },
};

export function PersonForm({ person, member, aliases }: { person: Person; member: MemberSummary | null; aliases: PersonAlias[] }) {
  const [values, setValues] = useState<PersonFormValues>(personToFormValues(person));
  const [errors, setErrors] = useState<Partial<Record<keyof PersonFields, string>>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState<{ text: string; count: number } | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const validation = validatePersonForm(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updatePersonAction({ id: person.id, version: person.version, values });
      setMessage(result.ok ? { tone: "success", text: "Scheda salvata." } : { tone: "error", text: result.error });
      // 4d (B2): nuovo nickname → iscrizioni "da abbinare" scritte così.
      const nickname = values.nickname.trim();
      if (result.ok && nickname && nickname !== (person.nickname ?? "")) {
        const found = await pendingEntriesAction({ personId: person.id, text: nickname });
        setPrompt(found.ok && found.data.pending > 0 ? { text: nickname, count: found.data.pending } : null);
      }
    });
  }

  const fields = Object.keys(PERSON_FIELD_LABELS) as (keyof PersonFields)[];

  const input = (field: keyof PersonFields) => (
    <Field key={field} label={PERSON_FIELD_LABELS[field]} error={errors[field]}>
      <input
        className={inputClass}
        value={values[field]}
        onChange={(event) => setValues({ ...values, [field]: event.target.value })}
        {...INPUT_PROPS[field]}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {/* 4e: "Altri nomi" subito sotto il campo Nickname; si salvano da soli. */}
      <div className="space-y-2 sm:max-w-[calc(50%-0.5rem)]">
        {input("nickname")}
        <PersonAliases personId={person.id} aliases={aliases} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{fields.filter((field) => field !== "notes" && field !== "nickname").map(input)}</div>
      <MemberHints member={member} values={values} onUse={(field, value) => setValues({ ...values, [field]: value })} />
      <Field label={PERSON_FIELD_LABELS.notes}>
        <textarea
          className={`${inputClass} min-h-24 py-2`}
          value={values.notes}
          onChange={(event) => setValues({ ...values, notes: event.target.value })}
        />
      </Field>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {prompt ? (
        <LinkPendingPrompt
          personId={person.id}
          text={prompt.text}
          count={prompt.count}
          onDone={(done, ok) => {
            setPrompt(null);
            if (done) setMessage({ tone: ok ? "success" : "error", text: done });
          }}
        />
      ) : null}

      <button type="submit" className={`${buttonClass.primary} w-full sm:w-auto`} disabled={pending}>
        {pending ? "Salvataggio…" : "Salva"}
      </button>
    </form>
  );
}
