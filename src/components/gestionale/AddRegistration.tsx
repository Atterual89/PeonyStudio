"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { addRegistrationAction } from "@/app/gestione/(app)/w/registration-actions";
import { parseEuroToCents } from "@/lib/gestionale/format";
import { EMAIL_PATTERN } from "@/lib/gestionale/parse-roster";
import { deducedPaymentType } from "@/lib/gestionale/payments";
import type { BookingStatus, PaymentMethod } from "@/lib/gestionale/types";

import { FeeEditor } from "./FeeEditor";
import { AMOUNT_ERROR, PaymentFields, amountInvalid, emptyPaymentDraft, type PaymentDraft } from "./PaymentForm";
import { StatusPicker } from "./StatusPicker";
import { Field, Notice, UI, buttonClass, cardClass, inputClass, textareaClass } from "./ui";

/** Primo nome per "partner di <primo nome>". */
function firstWord(text: string) {
  return text.trim().split(/\s+/)[0] ?? "";
}

/**
 * Schermata "Aggiungi" di Ale (D20), una schermata. 4g (#21): in vista solo
 * Nome · Partner · Stato · "+ Pagamento"; email, note e prezzo speciale in
 * "altro…". Testo libero, nessuna ricerca né suggerimento: l'abbinamento alle
 * persone avviene sul server ed è invisibile qui. #22: il primo pagamento
 * compare come "Quanto ha già pagato?" (importo e metodo; il resto in
 * "altro…"); scegliendo Acconto pagato o Saldato compare da solo.
 */
export function AddRegistration({
  workshopId,
  standardFeeCents,
  today,
  lastMethod = null,
}: {
  workshopId: string;
  standardFeeCents: number;
  today: string;
  lastMethod?: PaymentMethod | null;
}) {
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [person, setPerson] = useState("");
  const [partner, setPartner] = useState("");
  // 4d (B2): email facoltative (Ale vede solo quelle che scrive lei).
  const [personEmail, setPersonEmail] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [status, setStatus] = useState<BookingStatus>("prenotato");
  // null = segue il prezzo del workshop; testo = prezzo speciale dalla matita.
  const [customFee, setCustomFee] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  // Primo pagamento, salvato insieme all'iscrizione (obbligatorio con Acconto pagato / Saldato).
  const [payment, setPayment] = useState<PaymentDraft | null>(null);
  const [amountMissing, setAmountMissing] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPerson("");
    setPartner("");
    setPersonEmail("");
    setPartnerEmail("");
    setStatus("prenotato");
    setCustomFee(null);
    setNotes("");
    setPayment(null);
    setAmountMissing(false);
    setMore(false);
  }

  const feeCents = customFee === null ? standardFeeCents : parseEuroToCents(customFee);
  const autoType = (cents: number | null) => deducedPaymentType(0, cents, feeCents);
  const newPayment = (amountCents?: number) => emptyPaymentDraft(today, { amountCents, method: lastMethod }, autoType);

  function changeStatus(next: BookingStatus) {
    setStatus(next);
    if (next === "acconto" || next === "saldato") {
      // Saldato: importo = prezzo intero (se non è già stato scritto).
      setPayment((current) => current ?? newPayment(next === "saldato" ? (feeCents ?? undefined) : undefined));
    }
  }

  function save() {
    if (!person.trim()) {
      setMessage({ tone: "error", text: "Nome: scrivi il nome, il nickname o l'email." });
      return;
    }
    const badEmail = [personEmail, partner.trim() ? partnerEmail : ""].some((email) => email.trim() && !EMAIL_PATTERN.test(email.trim()));
    if (badEmail) {
      setMore(true);
      setMessage({ tone: "error", text: "Email: controlla l'indirizzo (es. nome@esempio.it)." });
      return;
    }
    const needsPayment = status === "acconto" || status === "saldato";
    const withPayment = payment !== null && (needsPayment || payment.amount.trim() !== "");
    if ((needsPayment && !payment) || (withPayment && amountInvalid(payment!.amount))) {
      setPayment((current) => current ?? newPayment());
      setAmountMissing(true);
      setMessage({ tone: "error", text: AMOUNT_ERROR });
      return;
    }
    setAmountMissing(false);
    setMessage(null);
    startTransition(async () => {
      const result = await addRegistrationAction({
        workshopId,
        person,
        partner,
        personEmail,
        partnerEmail: partner.trim() ? partnerEmail : "",
        status,
        fee: customFee,
        notes,
        payment: withPayment ? payment : null,
      });
      if (result.ok) {
        const names = [person.trim(), partner.trim()].filter(Boolean).join(" + ");
        reset();
        setMessage({ tone: "success", text: `Fatto: ${names} iscritto/a.` });
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  if (!open) {
    return (
      <div className="space-y-3">
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
          Nuova iscrizione
        </button>
      </div>
    );
  }

  return (
    <div className={`${cardClass} ${UI.pad} ${UI.blocks}`}>
      <h3 className={UI.sectionTitle}>Aggiungi</h3>

      <div className="flex flex-wrap gap-2">
        <Field label="Nome, nickname o email" className="flex-[1_1_9rem]">
          <input
            className={inputClass}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            autoComplete="off"
            autoCapitalize="words"
            autoFocus
          />
        </Field>
        <Field label={person.trim() ? `Partner di ${firstWord(person)} (facoltativo)` : "Partner (facoltativo)"} className="flex-[1_1_9rem]">
          <input className={inputClass} value={partner} onChange={(e) => setPartner(e.target.value)} autoComplete="off" autoCapitalize="words" />
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <StatusPicker value={status} onChange={changeStatus} className="flex-[0_1_auto]" />
        {payment ? null : (
          <button type="button" className={buttonClass.secondary} onClick={() => setPayment(newPayment())}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Pagamento
          </button>
        )}
      </div>

      {payment ? (
        <div className="space-y-2 rounded-lg bg-[#f2ede3] p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-semibold">Quanto ha già pagato?</p>
            {status === "acconto" || status === "saldato" ? null : (
              <button
                type="button"
                className={buttonClass.ghost}
                onClick={() => {
                  setPayment(null);
                  setAmountMissing(false);
                }}
              >
                Togli
              </button>
            )}
          </div>
          <PaymentFields
            value={payment}
            onChange={(next) => {
              setPayment(next);
              if (amountMissing && !amountInvalid(next.amount)) setAmountMissing(false);
            }}
            today={today}
            autoType={autoType}
            dateInMore
            amountMissing={amountMissing}
          />
        </div>
      ) : null}

      <button type="button" className="min-h-10 text-sm text-[#5f524c] underline" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? "meno" : "altro… (email, note, prezzo speciale)"}
      </button>

      {more ? (
        <div className={UI.blocks}>
          <div className="flex flex-wrap gap-2">
            <Field label={person.trim() ? `Email di ${firstWord(person)} (facoltativa)` : "Email (facoltativa)"} className="flex-[1_1_9rem]">
              <input className={inputClass} type="email" inputMode="email" autoComplete="off" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} />
            </Field>
            {partner.trim() ? (
              <Field label={`Email di ${firstWord(partner)} (facoltativa)`} className="flex-[1_1_9rem]">
                <input className={inputClass} type="email" inputMode="email" autoComplete="off" value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} />
              </Field>
            ) : null}
          </div>

          <FeeEditor
            feeCents={feeCents}
            custom={customFee !== null}
            onSave={(text) => {
              if (parseEuroToCents(text) === null) {
                setMessage({ tone: "error", text: "Prezzo: scrivi un numero, es. 450." });
                return false;
              }
              setMessage(null);
              setCustomFee(text);
              return true;
            }}
            onRestore={() => setCustomFee(null)}
          />

          <Field label="Note">
            <textarea rows={1} className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="facoltative" />
          </Field>
        </div>
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <div className="flex flex-wrap gap-2">
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
