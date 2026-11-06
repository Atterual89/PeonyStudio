"use client";

import { Plus, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";

import { addBookingAction } from "@/app/gestione/(app)/w/actions";
import { ADMIN_BOOKING_STATUSES } from "@/lib/gestionale/labels";
import type { PersonChoice } from "@/lib/gestionale/person-choice";
import type { BookingStatus } from "@/lib/gestionale/types";

import { PersonPicker } from "./PersonPicker";
import { StatusPicker } from "./StatusPicker";
import { Field, Notice, buttonClass, cardClass, textareaClass } from "./ui";

/** Primo nome per "partner di <primo nome>". */
function firstName(label: string) {
  return label.trim().split(/\s+/)[0] ?? label;
}

/**
 * Schermata "Aggiungi" degli admin, tutta in una schermata:
 * cerca → persona scelta con badge → stato → + Partner → note → Salva.
 * 3b: solo stati non economici; la quota è quella standard del workshop e
 * non si vede né si modifica; dopo la creazione lo stato lo aggiornano Ale e
 * i pagamenti. L'organizzatrice usa invece AddRegistration (D20).
 */
export function QuickAdd({ workshopId }: { workshopId: string }) {
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState<PersonChoice | null>(null);
  const [withPartner, setWithPartner] = useState(false);
  const [partner, setPartner] = useState<PersonChoice | null>(null);
  const [status, setStatus] = useState<BookingStatus>("prenotato");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPerson(null);
    setPartner(null);
    setWithPartner(false);
    setStatus("prenotato");
    setNotes("");
  }

  function save() {
    if (!person) {
      setMessage({ tone: "error", text: "Cerca e scegli la persona." });
      return;
    }
    if (withPartner && !partner) {
      setMessage({ tone: "error", text: "Scegli il partner oppure toglilo." });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await addBookingAction({
        workshopId,
        person,
        partner: withPartner ? partner : null,
        status,
        notes,
      });
      if (result.ok) {
        const names = [person.label, withPartner ? partner?.label : null].filter(Boolean).join(" + ");
        reset();
        setMessage({ tone: "success", text: `${names}: iscrizione salvata.` });
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  if (!open) {
    return (
      <div className="mt-3 space-y-3">
        {message?.tone === "success" ? <Notice tone="success">{message.text}</Notice> : null}
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className={`${buttonClass.primary} w-full sm:w-auto`}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Aggiungi
        </button>
      </div>
    );
  }

  return (
    <div className={`${cardClass} mt-3 space-y-3 p-3`}>
      <h3 className="text-base font-semibold">Aggiungi</h3>

      <PersonPicker workshopId={workshopId} label="Cerca" value={person} onChange={setPerson} />

      <StatusPicker value={status} onChange={setStatus} options={ADMIN_BOOKING_STATUSES} />

      {withPartner ? (
        <div className="space-y-2">
          <PersonPicker
            workshopId={workshopId}
            label="Partner"
            value={partner}
            onChange={setPartner}
            caption={person ? `partner di ${firstName(person.label)}` : undefined}
            excludePersonIds={person?.kind === "existing" ? [person.id] : []}
          />
          <button
            type="button"
            className={buttonClass.ghost}
            onClick={() => {
              setWithPartner(false);
              setPartner(null);
            }}
          >
            Togli partner
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setWithPartner(true)} className={buttonClass.ghost}>
          <UserPlus className="h-5 w-5" aria-hidden="true" />
          Partner
        </button>
      )}

      <Field label="Note">
        <textarea
          rows={1}
          className={textareaClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="facoltative"
        />
      </Field>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} className={`${buttonClass.primary} flex-1 sm:flex-none`} disabled={pending}>
          {pending ? "Salvataggio…" : "Salva"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
            setMessage(null);
          }}
          className={buttonClass.ghost}
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
