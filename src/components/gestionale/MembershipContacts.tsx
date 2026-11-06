"use client";

// Richieste di associazione (4d, parte B, solo admin): per chi non è in regola
// nel periodo del workshop si registra che è stata mandata (da Gmail) la
// richiesta di iscrizione, poi i solleciti. Il numero lo decide il database.

import { useState, useTransition } from "react";

import { addContactAction, deleteContactAction } from "@/app/gestione/(app)/w/contact-actions";
import { contactLabel, lastContact, nextContactLabel } from "@/lib/gestionale/contacts";
import type { MembershipContact } from "@/lib/gestionale/types";

import { DeleteConfirm } from "./Deletion";
import { useFlash } from "./Flash";
import { Field, RowMenu, buttonClass, inputClass } from "./ui";

/** Riga di un contatto, con "Elimina" nel menu "…" e conferma sul posto. */
function ContactRow({ contact, name }: { contact: MembershipContact; name: string }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <li className="py-1">
      <div className="flex items-center justify-between gap-2">
        <span>
          {contactLabel(contact)}
          {contact.note ? <span className="text-[#5f524c]"> · {contact.note}</span> : null}
        </span>
        <RowMenu label="Altre azioni sul contatto" items={[{ label: "Elimina", danger: true, onClick: () => setDeleting(true) }]} />
      </div>
      {deleting ? (
        <DeleteConfirm
          question={`Eliminare "${contactLabel(contact)}" di ${name}?`}
          hint="Serve solo a correggere un errore di inserimento: se l'email è stata mandata davvero, lasciala."
          entity="membership_contact"
          id={contact.id}
          remove={() => deleteContactAction({ id: contact.id })}
          onClose={() => setDeleting(false)}
        />
      ) : null}
    </li>
  );
}

export function MembershipContacts({
  personId,
  name,
  contacts,
  workshopId,
  today,
}: {
  personId: string;
  name: string;
  contacts: MembershipContact[];
  workshopId: string;
  today: string;
}) {
  const [adding, setAdding] = useState(false);
  const [sentOn, setSentOn] = useState(today);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const flash = useFlash(personId);
  const last = lastContact(contacts);
  const next = nextContactLabel(contacts);

  function confirm() {
    flash.clear();
    startTransition(async () => {
      const result = await addContactAction({ personId, workshopId, sentOn, note });
      flash.result(result, result.ok ? (result.data.number === 0 ? "Richiesta registrata." : `Sollecito ${result.data.number} registrato.`) : "");
      if (result.ok) {
        setAdding(false);
        setNote("");
        setSentOn(today);
      }
    });
  }

  return (
    <div className="space-y-2 rounded-xl bg-[#f2ede3] p-3 text-sm">
      <p className="font-medium">
        Richiesta di associazione{last ? <span className="font-normal text-[#5f524c]"> · {contactLabel(last)}</span> : null}
      </p>

      {adding ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Data">
            <input type="date" className={`${inputClass} w-44`} value={sentOn} max={today} onChange={(e) => setSentOn(e.target.value)} />
          </Field>
          <Field label="Nota">
            <input className={`${inputClass} min-w-48`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="facoltativa" />
          </Field>
          <button type="button" className={buttonClass.primary} disabled={pending || !sentOn} onClick={confirm}>
            {pending ? "Salvataggio…" : "Registra"}
          </button>
          <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => setAdding(false)}>
            Chiudi
          </button>
        </div>
      ) : (
        <button type="button" className={buttonClass.secondary} onClick={() => setAdding(true)}>
          {next}
        </button>
      )}

      {contacts.length > 0 ? (
        <details>
          <summary className="flex min-h-10 cursor-pointer items-center text-[#5f524c]">Tutti i contatti ({contacts.length})</summary>
          <ul className="divide-y divide-[#211815]/5">
            {contacts.map((contact) => (
              <ContactRow key={contact.id} contact={contact} name={name} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
