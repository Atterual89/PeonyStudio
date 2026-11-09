"use client";

import { Plus } from "lucide-react";
import { BillingNameAutocomplete } from "./BillingNameAutocomplete";
import { useState, useTransition } from "react";

import { addRegistrationAction } from "@/app/gestione/(app)/w/registration-actions";
import { centsToInput, parseEuroToCents } from "@/lib/gestionale/format";
import { EMAIL_PATTERN } from "@/lib/gestionale/parse-roster";
import { suggestCoupleSplit } from "@/lib/gestionale/couple-input";
import { deducedPaymentType } from "@/lib/gestionale/payments";
import type { BookingStatus, PaymentMethod } from "@/lib/gestionale/types";

import { AMOUNT_ERROR, PaymentFields, amountInvalid, emptyPaymentDraft, type PaymentDraft } from "./PaymentForm";
import { StatusPicker } from "./StatusPicker";
import { Field, Notice, UI, buttonClass, cardClass, inputClass, textareaClass } from "./ui";

/**
 * Schermata "Aggiungi" di Ale (D20), una schermata. 4g (#21): in vista solo
 * Intestatario + email, partner + email, quota standard editabile, poi stato
 * e pagamento. Solo le note sono secondarie. L'abbinamento all'anagrafica
 * avviene sul server e non espone i dati soci ad Ale. Il primo pagamento
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
  const [personId,setPersonId]=useState<string|null>(null);
  const [partnerId,setPartnerId]=useState<string|null>(null);
  // 4d (B2): email facoltative (Ale vede solo quelle che scrive lei).
  const [personEmail, setPersonEmail] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [status, setStatus] = useState<BookingStatus>("prenotato");
  // null = quota standard, testo = importo modificato solo per questa iscrizione.
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
    setPersonId(null);
    setPartnerId(null);
    setPersonEmail("");
    setPartnerEmail("");
    setStatus("prenotato");
    setCustomFee(null);
    setNotes("");
    setPayment(null);
    setAmountMissing(false);
    setMore(false);
  }

  const suggestedPair=!personId&&!partner.trim()?suggestCoupleSplit(person):null;
  const feeText = customFee === null ? centsToInput(standardFeeCents) : customFee;
  const feeCents = parseEuroToCents(feeText);
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
    const badEmail = [personEmail, partnerEmail].some((email) => email.trim() && !EMAIL_PATTERN.test(email.trim()));
    if (badEmail) {
      setMessage({ tone: "error", text: "Email: controlla l'indirizzo (es. nome@esempio.it)." });
      return;
    }
    if (feeCents === null || feeCents < 0) {
      setMessage({ tone: "error", text: "Quota: inserisci l'importo della coppia, ad esempio 450." });
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
        partnerEmail,
        personId,
        partnerId,
        status,
        fee: customFee === null || feeCents === standardFeeCents ? null : feeText,
        notes,
        payment: withPayment ? payment : null,
      });
      if (result.ok) {
        const names = [suggestedPair?.first??person.trim(),
          suggestedPair?.second ?? (partner.trim() || partnerEmail.trim())].filter(Boolean).join(" + ");
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

      <div className="space-y-2">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
          <Field label="Intestatario *" hint="Nome, cognome o nickname">
            <BillingNameAutocomplete value={person} selectedId={personId}
              onText={text=>{setPerson(text);if(personId){setPersonId(null);setPersonEmail("");}}}
              onPick={entry=>{setPerson(entry.name);setPersonId(entry.id);setPersonEmail(entry.email);}}
              placeholder="Nome, cognome o nickname" />
          </Field>
          <Field label="Email intestatario">
            <input className={inputClass} type="email" inputMode="email" autoComplete="off"
              value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} placeholder="Email" />
          </Field>
        </div>
        {suggestedPair&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#a8583e]/25 bg-[#f8f3ea] p-3 text-sm">
          <span>Coppia riconosciuta: <strong>{suggestedPair.first}</strong> + <strong>{suggestedPair.second}</strong>. Verranno registrate due persone in un'unica iscrizione.</span>
          <button type="button" onClick={()=>{
            setPerson(suggestedPair.first);setPersonId(null);
            setPartner(suggestedPair.second);setPartnerId(null);
          }} className="min-h-10 rounded-lg bg-[#a8583e] px-3 font-semibold text-white">Dividi coppia</button>
        </div>}
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
          <Field label="Partner">
            <BillingNameAutocomplete value={partner} selectedId={partnerId}
              onText={text=>{setPartner(text);if(partnerId){setPartnerId(null);setPartnerEmail("");}}}
              onPick={entry=>{setPartner(entry.name);setPartnerId(entry.id);setPartnerEmail(entry.email);}}
              placeholder="Nome o nickname" />
          </Field>
          <Field label="Email partner">
            <input className={inputClass} type="email" inputMode="email" autoComplete="off"
              value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} placeholder="Email" />
          </Field>
        </div>
        <Field label="Quota totale dell'iscrizione (€)">
          <div className="flex items-center gap-2">
            <input inputMode="decimal" className={`${inputClass} max-w-40`} value={feeText}
              onChange={(e) => setCustomFee(e.target.value)} aria-label="Quota totale iscrizione in euro" />
            {customFee !== null ? (
              <button type="button" className="min-h-10 text-sm font-medium text-[#a8583e] underline"
                onClick={() => setCustomFee(null)}>Ripristina standard</button>
            ) : null}
          </div>
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

      <button type="button" className="min-h-10 text-sm text-[#5f524c] underline"
        aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? "Nascondi note" : "Aggiungi note (facoltative)"}
      </button>
      {more ? (
        <Field label="Note">
          <textarea rows={2} className={textareaClass} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Eventuali indicazioni" />
        </Field>
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
