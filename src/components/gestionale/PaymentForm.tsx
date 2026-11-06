"use client";

import { useState, useTransition } from "react";

import { addPaymentAction, correctPaymentAction } from "@/app/gestione/(app)/w/registration-actions";
import { centsToInput, formatCents, parseEuroToCents } from "@/lib/gestionale/format";
import { PARTY_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/gestionale/labels";
import type { Party, Payment, PaymentMethod, PaymentType } from "@/lib/gestionale/types";

import { ChoiceSelect, DateField, Field, MissingHint, Notice, buttonClass, compactInputClass, missingInputClass } from "./ui";

export const TYPE_OPTIONS = (Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[]).map((value) => ({ value, label: PAYMENT_TYPE_LABELS[value] }));
export const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));
export const PARTY_OPTIONS = (Object.keys(PARTY_LABELS) as Party[]).map((value) => ({ value, label: PARTY_LABELS[value] }));

/**
 * "pagamento": importo eventualmente preselezionato (dal menu dello stato:
 * Saldato → residuo; "+ Nuovo pagamento" dopo un acconto → residuo).
 * "rimborso": `from` = movimento da cui si apre (importo precompilato).
 * "correzione" ("Modifica"): `original` = il movimento com'è ora (importo netto).
 */
export type PaymentFormMode =
  | { kind: "pagamento"; paymentType?: PaymentType; amountCents?: number; targetStatus?: "acconto" | "saldato" }
  | { kind: "rimborso"; from?: Payment }
  | { kind: "correzione"; original: Payment };

/**
 * Campi del modulo di pagamento, come li riceve il server (readPayment).
 * paidOn vuota = data non indicata (026). `typeChosen`: il tipo è stato scelto
 * a mano in "altro…" (o viene da un pagamento esistente); altrimenti si
 * deduce dall'importo (4g, ipotesi 1).
 */
export type PaymentDraft = {
  amount: string;
  paymentType: PaymentType;
  typeChosen: boolean;
  method: PaymentMethod | null;
  paidOn: string;
  receivedBy: Party;
  description: string;
};

/** Tipo dedotto dall'importo (centesimi, null se non valido). */
export type AutoType = (amountCents: number | null) => PaymentType;

export function emptyPaymentDraft(
  today: string,
  preset: { paymentType?: PaymentType; amountCents?: number; method?: PaymentMethod | null } = {},
  autoType?: AutoType,
): PaymentDraft {
  return {
    amount: preset.amountCents ? centsToInput(preset.amountCents) : "",
    paymentType: autoType ? autoType(preset.amountCents ?? null) : (preset.paymentType ?? "acconto"),
    typeChosen: false,
    // 4g (#10): metodo dell'ultimo pagamento registrato da chi scrive.
    method: preset.method ?? null,
    paidOn: today,
    receivedBy: "redsabbath",
    description: "",
  };
}

export function draftFromPayment(payment: Payment): PaymentDraft {
  return {
    amount: centsToInput(Math.abs(payment.amountCents)),
    paymentType: payment.paymentType,
    typeChosen: true,
    method: payment.method,
    paidOn: payment.paidOn ?? "",
    receivedBy: payment.receivedBy,
    description: payment.description ?? "",
  };
}

/** "Modifica" senza cambiamenti: non si salva niente. */
export function draftUnchanged(draft: PaymentDraft, payment: Payment): boolean {
  const before = draftFromPayment(payment);
  return (
    parseEuroToCents(draft.amount) === Math.abs(payment.amountCents) &&
    (payment.kind === "rimborso" || draft.paymentType === before.paymentType) &&
    draft.method === before.method &&
    draft.paidOn === before.paidOn &&
    draft.receivedBy === before.receivedBy &&
    draft.description.trim() === before.description.trim()
  );
}

/** 4g (#20): importo scritto ma non valido (o vuoto al salvataggio). */
export function amountInvalid(amount: string): boolean {
  const cents = parseEuroToCents(amount);
  return cents === null || cents <= 0;
}

/** 4g (#20): errore indicato sul campo. */
export const AMOUNT_ERROR = "Importo: scrivi un numero, es. 250.";

/** 4f: basi flex dei campi affiancati (larghe quanto il testo più lungo dei menu: "Contanti", "Bonifico"). */
export const PAYMENT_FIELD_WIDTH = {
  amount: "flex-[1_1_4rem]",
  method: "flex-[1_1_6.25rem]",
  date: "flex-[1_1_5.25rem]",
  type: "flex-[1_1_6.5rem]",
  party: "flex-[1_1_6.5rem]",
  notes: "flex-[100_1_12rem]",
} as const;

/**
 * Campi del pagamento (4g, ipotesi 1 e 2): in vista Importo · Metodo · Data
 * (con `dateInMore` la data va in "altro…"); sotto una riga piccola
 * "Incassato da Ale · cambia" e "altro…", che apre Tipo (dedotto
 * dall'importo, si può cambiare) e Note. Usati dal modulo della riga e da
 * "Aggiungi".
 */
export function PaymentFields({
  value,
  onChange,
  today,
  refund = false,
  autoFocus = true,
  autoType,
  dateInMore = false,
  amountMissing = false,
}: {
  value: PaymentDraft;
  onChange: (value: PaymentDraft) => void;
  today: string;
  refund?: boolean;
  autoFocus?: boolean;
  autoType?: AutoType;
  dateInMore?: boolean;
  /** 4g (#20): importo da completare (evidenziato). */
  amountMissing?: boolean;
}) {
  const [more, setMore] = useState(() => Boolean(value.description.trim()));
  const [partyOpen, setPartyOpen] = useState(false);
  const set = (patch: Partial<PaymentDraft>) => onChange({ ...value, ...patch });

  function setAmount(amount: string) {
    // Finché il tipo non è stato scelto a mano, segue l'importo.
    const paymentType = !value.typeChosen && autoType ? autoType(parseEuroToCents(amount)) : value.paymentType;
    set({ amount, paymentType });
  }

  const date = <DateField className={PAYMENT_FIELD_WIDTH.date} value={value.paidOn} today={today} onChange={(paidOn) => set({ paidOn })} />;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-x-1.5 gap-y-2">
        <Field label={refund ? "Restituiti" : "Importo"} className={PAYMENT_FIELD_WIDTH.amount}>
          <input
            inputMode="decimal"
            className={amountMissing ? missingInputClass : compactInputClass}
            data-missing={amountMissing || undefined}
            aria-invalid={amountMissing || undefined}
            value={value.amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="es. 200"
            autoFocus={autoFocus}
          />
          {amountMissing ? <MissingHint /> : null}
        </Field>
        <ChoiceSelect
          label="Metodo"
          className={PAYMENT_FIELD_WIDTH.method}
          options={METHOD_OPTIONS}
          value={value.method}
          onChange={(method) => set({ method })}
          placeholder="—"
        />
        {dateInMore ? null : date}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 text-xs text-[#5f524c]">
        {partyOpen ? (
          <ChoiceSelect
            label={refund ? "Restituiti da" : "Incassato da"}
            className={PAYMENT_FIELD_WIDTH.party}
            options={PARTY_OPTIONS}
            value={value.receivedBy}
            onChange={(receivedBy) => set({ receivedBy })}
          />
        ) : (
          <span>
            {refund ? "Restituiti da" : "Incassato da"} <strong className="text-[#211815]">{PARTY_LABELS[value.receivedBy]}</strong> ·{" "}
            <button type="button" className="min-h-10 underline" onClick={() => setPartyOpen(true)}>
              cambia
            </button>
          </span>
        )}
        <button type="button" className="min-h-10 underline" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? "meno" : "altro…"}
        </button>
      </div>

      {more ? (
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">
          {!refund ? (
            <ChoiceSelect
              label="Tipo"
              className={PAYMENT_FIELD_WIDTH.type}
              options={TYPE_OPTIONS}
              value={value.paymentType}
              onChange={(paymentType) => set({ paymentType, typeChosen: true })}
            />
          ) : null}
          {dateInMore ? date : null}
          <Field label="Note" className={PAYMENT_FIELD_WIDTH.notes}>
            <input className={compactInputClass} value={value.description} onChange={(e) => set({ description: e.target.value })} placeholder="facoltative" />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

/**
 * D21: modulo della riga. "Modifica" apre gli stessi campi precompilati; al
 * salvataggio il movimento si annulla con una rettifica e si registra quello
 * giusto (stessa transazione). Se niente è cambiato non si salva niente.
 * 4g (#12): nella Modifica solo "Salva modifica" ed "Elimina pagamento"
 * (inserito per errore), nessun terzo modo di annullare.
 */
export function PaymentForm({
  bookingId,
  mode,
  today,
  onDone,
  autoType,
  lastMethod = null,
  onDelete,
  hint,
}: {
  bookingId: string;
  mode: PaymentFormMode;
  today: string;
  onDone: (message: string) => void;
  autoType?: AutoType;
  /** 4g (#10): metodo proposto per un pagamento nuovo. */
  lastMethod?: PaymentMethod | null;
  /** "Elimina pagamento" dalla Modifica. */
  onDelete?: () => void;
  /** Riga di aiuto sotto il titolo (4g, #14). */
  hint?: string;
}) {
  const original = mode.kind === "correzione" ? mode.original : null;
  const preset = mode.kind === "pagamento" ? mode : null;
  const [draft, setDraft] = useState<PaymentDraft>(() =>
    original
      ? draftFromPayment(original)
      : mode.kind === "rimborso" && mode.from
        ? { ...draftFromPayment(mode.from), paidOn: today, description: "" }
        : emptyPaymentDraft(today, { ...(preset ?? {}), method: mode.kind === "pagamento" ? lastMethod : null }, mode.kind === "pagamento" ? autoType : undefined),
  );
  const [error, setError] = useState<string | null>(null);
  const [amountMissing, setAmountMissing] = useState(false);
  const [pending, startTransition] = useTransition();
  const refund = mode.kind === "rimborso" || original?.kind === "rimborso";

  function submit() {
    setError(null);
    if (amountInvalid(draft.amount)) {
      setAmountMissing(true);
      setError(AMOUNT_ERROR);
      return;
    }
    setAmountMissing(false);
    if (original && draftUnchanged(draft, original)) {
      onDone("Nessuna modifica.");
      return;
    }
    startTransition(async () => {
      if (original) {
        const result = await correctPaymentAction({ paymentId: original.id, replacement: draft, description: "" });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onDone(result.data.changed ? "Fatto: pagamento modificato." : "Nessuna modifica.");
        return;
      }
      const kind = mode.kind === "rimborso" ? "rimborso" : "pagamento";
      const result = await addPaymentAction({ bookingId, kind, payment: draft, targetStatus: preset?.targetStatus });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(kind === "rimborso" ? "Fatto: soldi restituiti registrati." : "Fatto: pagamento registrato.");
    });
  }

  const cents = parseEuroToCents(draft.amount);
  const title = original
    ? `Modifica ${formatCents(original.amountCents)}`
    : mode.kind === "rimborso"
      ? "Ho restituito dei soldi"
      : "Nuovo pagamento";
  const submitLabel = original
    ? "Salva modifica"
    : mode.kind === "rimborso"
      ? cents && cents > 0
        ? `Ho restituito ${formatCents(cents)}`
        : "Ho restituito"
      : "Registra pagamento";

  return (
    <div className="space-y-2 rounded-lg bg-[#f2ede3] p-2">
      <p className="text-[15px] font-semibold">{title}</p>
      {hint ? <p className="text-sm text-[#5f524c]">{hint}</p> : null}
      <PaymentFields
        value={draft}
        onChange={(next) => {
          setDraft(next);
          if (amountMissing && !amountInvalid(next.amount)) setAmountMissing(false);
        }}
        today={today}
        refund={refund}
        autoType={original ? undefined : autoType}
        amountMissing={amountMissing}
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass.primary} onClick={submit} disabled={pending}>
          {pending ? "Salvataggio…" : submitLabel}
        </button>
        {original && onDelete ? (
          <button type="button" className={buttonClass.danger} onClick={onDelete} disabled={pending}>
            {original.kind === "pagamento" ? "Elimina pagamento" : "Elimina"}
          </button>
        ) : null}
        <button type="button" className={buttonClass.ghost} onClick={() => onDone("")} disabled={pending}>
          Chiudi
        </button>
      </div>
    </div>
  );
}
