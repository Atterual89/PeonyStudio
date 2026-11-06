"use client";

// Riga iscrizione di Ale (4d, B2): "+ Email" accanto a ogni nome, modificabile.
// Ale vede e scrive SOLO l'email che ha indicato lei (entered_email), mai
// quella della scheda. Un'email scritta nelle note si propone con un tocco.

import { useState, useTransition } from "react";

import { setEnteredEmailAction } from "@/app/gestione/(app)/w/registration-actions";
import { EMAIL_PATTERN, findEmail } from "@/lib/gestionale/parse-roster";
import type { Registration } from "@/lib/gestionale/types";

import { Notice, buttonClass, compactInputClass } from "./ui";

type Entry = Registration["people"][number];

function EmailLine({ entry, onMessage }: { entry: Entry; onMessage: (message: { tone: "success" | "error"; text: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(entry.enteredEmail ?? "");
  const [pending, startTransition] = useTransition();
  const name = entry.enteredAs ?? "Persona";

  function save() {
    const value = email.trim().toLowerCase();
    if (value && !EMAIL_PATTERN.test(value)) {
      onMessage({ tone: "error", text: "Email non valida: controlla l'indirizzo (es. nome@esempio.it)." });
      return;
    }
    startTransition(async () => {
      const result = await setEnteredEmailAction({ participantId: entry.participantId, email: value });
      if (result.ok) {
        setEditing(false);
        onMessage({ tone: "success", text: value ? `Email di ${name} salvata.` : `Email di ${name} tolta.` });
      } else onMessage({ tone: "error", text: result.error });
    });
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{name}</span>
        <input
          className={`${compactInputClass} w-auto flex-[1_1_12rem]`}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@esempio.it"
          autoFocus
        />
        <button type="button" className={buttonClass.secondary} disabled={pending} onClick={save}>
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => setEditing(false)}>
          Chiudi
        </button>
      </div>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm">
      <span className="font-medium">{name}</span>
      {entry.enteredEmail ? <span className="text-[#5f524c]">{entry.enteredEmail}</span> : null}
      <button type="button" className="min-h-10 font-semibold text-[#a8583e] underline" onClick={() => setEditing(true)}>
        {entry.enteredEmail ? "cambia" : "+ Email"}
      </button>
    </p>
  );
}

export function EnteredEmails({ registration }: { registration: Registration }) {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const people = registration.people.filter((entry) => entry.enteredAs);
  const fromNotes = findEmail(registration.notes);
  const target = fromNotes && !people.some((entry) => entry.enteredEmail === fromNotes) ? people.find((entry) => !entry.enteredEmail) : undefined;
  if (people.length === 0) return null;

  return (
    <div className="space-y-1">
      {people.map((entry) => (
        <EmailLine key={`${entry.participantId}-${entry.enteredEmail ?? ""}`} entry={entry} onMessage={setMessage} />
      ))}
      {target && fromNotes ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#fdf3e1] p-2 text-sm text-[#7a5212]">
          <span>
            Nelle note c&apos;è un&apos;email: usare <strong>{fromNotes}</strong> per {target.enteredAs}?
          </span>
          <button
            type="button"
            className={buttonClass.secondary}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setEnteredEmailAction({ participantId: target.participantId, email: fromNotes });
                setMessage(result.ok ? { tone: "success", text: `Email di ${target.enteredAs} salvata.` } : { tone: "error", text: result.error });
              })
            }
          >
            Usa questa email
          </button>
        </div>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}
