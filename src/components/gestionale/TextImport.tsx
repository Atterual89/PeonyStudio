"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { importRosterAction, previewMatchesAction } from "@/app/gestione/(app)/w/registration-actions";
import { draftKey, draftPrompt, draftStorage, readDraft, serializeDraft } from "@/lib/gestionale/draft";
import { centsToInput, formatCents, formatPaymentDate, normalizeText, parseEuroToCents } from "@/lib/gestionale/format";
import {
  INVOICE_STATUS_LABELS,
  PARTY_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
} from "@/lib/gestionale/labels";
import {
  existingFromRegistration,
  findExisting,
  parseRoster,
  statusConflict,
  EMAIL_PATTERN,
  type ParsedRow,
} from "@/lib/gestionale/parse-roster";
import {
  DEFAULT_RECEIVED_BY,
  cancelledWithoutPayments,
  cardMissingCount,
  cardSummaryLine,
  emailToSave,
  importDoneMessage,
  formPaymentIndexes,
  missingFields,
  previewPayment,
  previewPaymentTypes,
  previewSummary,
  registeredMatches,
  saveLabel,
  statusConflictText,
  type PreviewPayment,
} from "@/lib/gestionale/import-preview";
import { autoStatus, paidCents } from "@/lib/gestionale/payments";
import { alreadyEnrolledText } from "@/lib/gestionale/registrations";
import type { BookingStatus, InvoiceStatus, PaymentType, Registration } from "@/lib/gestionale/types";

import { METHOD_OPTIONS, PARTY_OPTIONS, PAYMENT_FIELD_WIDTH, TYPE_OPTIONS } from "./PaymentForm";
import { StatusPicker } from "./StatusPicker";
import {
  ChoiceSelect,
  DateField,
  Field,
  MissingHint,
  Notice,
  RowMenu,
  UI,
  buttonClass,
  cardClass,
  compactInputClass,
  inputClass,
  missingInputClass,
  textareaClass,
} from "./ui";

type PreviewRow = Omit<ParsedRow, "payments"> & {
  key: number;
  include: boolean;
  feeText: string;
  payments: PreviewPayment[];
  /** Righe già presenti: pagamenti uguali a uno registrato aggiunti comunque (indice → sì). */
  addedAnyway: Record<number, boolean>;
  /** Stato scritto nel testo (dal parser), per l'avviso del conflitto. */
  textStatus: BookingStatus;
  /** Stato tenuto contro i pagamenti (solo Interessato / Prenotato a parola). */
  forcedStatus: BookingStatus | null;
  /** Il conflitto testo / pagamenti è stato chiarito. */
  statusResolved: boolean;
  /** 4e (#5): risposta a "Sembra già iscritta come «X»". */
  sameAs: "update" | "other" | null;
  /** 4e (#9): righe già presenti, "Salva l'email" (proposto se Ale non ne aveva una). */
  saveEmail: boolean;
  /** Cancellata senza pagamenti: non si importa, salvo "Importa comunque". */
  importCancelled: boolean;
  /** 4g (#26): card aperta ("Correggi") anche se è tutto giusto; null = automatico. */
  expanded?: boolean | null;
};

/** 4e (#5): iscrizione a cui il server abbinerebbe il principale (solo id e testo di Ale), per il nome cercato. */
type ServerMatch = { text: string; bookingId: string; enteredAs: string };

/** Riga già presente: l'iscrizione, i suoi pagamenti e quelli del testo già registrati. */
type Existing = { bookingId: string; version: number; registration: Registration | undefined; matches: Map<number, number> };

const INVOICE_OPTIONS = (Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((value) => ({
  value,
  label: INVOICE_STATUS_LABELS[value],
}));
const NO_MATCHES = new Map<number, number>();

function toPreview(rows: ParsedRow[]): PreviewRow[] {
  return rows.map((row, key) => ({
    ...row,
    key,
    include: true,
    feeText: centsToInput(row.feeCents),
    payments: row.payments.map(previewPayment),
    addedAnyway: {},
    textStatus: row.baseStatus,
    forcedStatus: null,
    statusResolved: false,
    sameAs: null,
    saveEmail: true,
    importCancelled: false,
    expanded: null,
  }));
}

/** Stato calcolato dai pagamenti della riga (importi validi, non tolti). */
function paymentsStatus(row: PreviewRow, baseStatus = row.baseStatus): BookingStatus {
  const fee = row.feeText.trim() ? parseEuroToCents(row.feeText) : null;
  const payments = row.payments.flatMap((payment) => {
    const cents = payment.removed ? null : parseEuroToCents(payment.amountText);
    return cents && cents > 0 ? [{ amountCents: cents }] : [];
  });
  return autoStatus(baseStatus, fee, paidCents(payments));
}

/** Stato mostrato (uno solo per riga): quello scelto contro i pagamenti, altrimenti quello calcolato dai pagamenti. */
function shownStatus(row: PreviewRow): BookingStatus {
  return row.forcedStatus ?? paymentsStatus(row);
}

/** Conflitto testo / pagamenti ancora da chiarire (righe nuove). */
function openStatusConflict(row: PreviewRow) {
  if (row.statusResolved || row.forcedStatus) return null;
  return statusConflict(row.textStatus, paymentsStatus(row));
}

/** Acconto pagato / Saldato su una riga nuova senza pagamenti: compare il mini-modulo del primo pagamento. */
function withStatus(row: PreviewRow, status: BookingStatus, today: string, standardFeeCents: number): PreviewRow {
  const economic = status === "acconto" || status === "saldato";
  // I pagamenti aggiunti qui (non letti dal testo) spariscono se lo stato non è più economico.
  const payments = economic ? row.payments : row.payments.filter((p) => p.parsed);
  if (!economic || payments.some((p) => !p.removed)) {
    return { ...row, baseStatus: status, payments };
  }
  const fee = row.feeText.trim() ? parseEuroToCents(row.feeText) : standardFeeCents;
  const added: PreviewPayment = {
    amountText: status === "saldato" && fee ? centsToInput(fee) : "",
    // 4g (#28): tipo dedotto dall'importo.
    paymentType: null,
    typeAuto: true,
    method: null,
    paidOn: today,
    receivedBy: DEFAULT_RECEIVED_BY,
    removed: false,
    parsed: null,
  };
  return { ...row, baseStatus: status, payments: [...payments, added] };
}

/** Pagato netto dei pagamenti validi della riga (non tolti). */
function rowPaidCents(row: PreviewRow): number {
  return row.payments.reduce((sum, payment) => {
    const cents = payment.removed ? null : parseEuroToCents(payment.amountText);
    return sum + (cents && cents > 0 ? cents : 0);
  }, 0);
}

/**
 * 4g (#28): tipo di ogni pagamento della riga (dedotto se non scritto né
 * scelto). Righe già presenti: col prezzo e il pagato dell'iscrizione.
 */
function rowPaymentTypes(row: PreviewRow, existing: Existing | null): PaymentType[] {
  if (existing?.registration) {
    return previewPaymentTypes(row.payments, existing.registration.agreedFeeCents, paidCents(existing.registration.payments));
  }
  return previewPaymentTypes(row.payments, row.feeText.trim() ? parseEuroToCents(row.feeText) : null);
}

/** Avviso dentro la card, vicino al campo interessato: il testo e, sulla stessa riga se c'è posto, le risposte come pulsanti piccoli affiancati (4f). */
function Doubt<T extends string>({
  text,
  options = [],
  onChange,
}: {
  text: string;
  options?: readonly { value: T; label: string }[];
  onChange?: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-[#fdf3e1] px-2 py-1.5">
      <p className="text-[13px] font-medium text-[#7a5212]">{text}</p>
      {options.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <button key={option.value} type="button" className={buttonClass.small} onClick={() => onChange?.(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Mini-modulo di un pagamento, come il modulo della riga (4g, ipotesi 1 e 2):
 * Importo · Metodo · Data; sotto una riga piccola col tipo dedotto,
 * "Incassato da Ale · cambia" e "altro…" (per cambiare il tipo). I campi
 * obbligatori vuoti sono evidenziati ("da completare"); la data è
 * facoltativa (026).
 */
function PaymentMiniForm({
  number,
  payment,
  type,
  today,
  onChange,
  onRemove,
  children,
}: {
  number: number;
  payment: PreviewPayment;
  /** Tipo mostrato: scritto nel testo, scelto, o dedotto (previewPaymentTypes). */
  type: PaymentType;
  today: string;
  onChange: (payment: PreviewPayment) => void;
  onRemove: () => void;
  /** Avvisi del pagamento (sotto i campi). */
  children?: React.ReactNode;
}) {
  const missing = new Set(missingFields(payment));
  const [more, setMore] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const set = (patch: Partial<PreviewPayment>) => onChange({ ...payment, ...patch });

  return (
    <div className={`-mx-1.5 space-y-1 rounded-lg border bg-white p-1.5 ${missing.size > 0 ? "border-[#c27a12]/50" : "border-[#211815]/10"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Pagamento {number}</p>
        <RowMenu label="Altre azioni sul pagamento" items={[{ label: "Togli questo pagamento", danger: true, onClick: onRemove }]} />
      </div>
      <div className="flex flex-wrap items-start gap-x-1.5 gap-y-2">
        <Field label="Importo" className={PAYMENT_FIELD_WIDTH.amount}>
          <input
            inputMode="decimal"
            className={missing.has("amount") ? missingInputClass : compactInputClass}
            data-missing={missing.has("amount") || undefined}
            aria-invalid={missing.has("amount") || undefined}
            value={payment.amountText}
            onChange={(e) => set({ amountText: e.target.value })}
            placeholder="es. 200"
          />
          {missing.has("amount") ? <MissingHint /> : null}
        </Field>
        <ChoiceSelect
          label="Metodo"
          className={PAYMENT_FIELD_WIDTH.method}
          options={METHOD_OPTIONS}
          value={payment.method}
          onChange={(method) => set({ method })}
          missing={missing.has("method")}
        />
        <DateField className={PAYMENT_FIELD_WIDTH.date} value={payment.paidOn} today={today} onChange={(paidOn) => set({ paidOn })} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-[#5f524c]">
        <span>{PAYMENT_TYPE_LABELS[type]}</span>
        {partyOpen ? (
          <ChoiceSelect
            label="Incassato da"
            className={PAYMENT_FIELD_WIDTH.party}
            options={PARTY_OPTIONS}
            value={payment.receivedBy}
            onChange={(receivedBy) => set({ receivedBy })}
          />
        ) : (
          <span>
            Incassato da <strong className="text-[#211815]">{PARTY_LABELS[payment.receivedBy]}</strong> ·{" "}
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
        <ChoiceSelect
          label="Tipo"
          className={`${PAYMENT_FIELD_WIDTH.type} max-w-48`}
          options={TYPE_OPTIONS}
          value={type}
          onChange={(paymentType) => set({ paymentType, typeAuto: false })}
        />
      ) : null}
      {children}
    </div>
  );
}

function PreviewCard({
  row,
  existing,
  emailToKeep,
  skipped,
  missing,
  sameAs,
  standardFeeCents,
  today,
  onChange,
}: {
  row: PreviewRow;
  existing: Existing | null;
  /** 4e (#9): email della riga da salvare sull'iscrizione già presente, o null. */
  emailToKeep: string | null;
  /** Cancellata senza pagamenti, non importata. */
  skipped: boolean;
  /** Campi da completare della card. */
  missing: number;
  /** 4e (#5): testo di Ale dell'iscrizione a cui sembra già iscritta, o null. */
  sameAs: string | null;
  standardFeeCents: number;
  today: string;
  onChange: (row: PreviewRow) => void;
}) {
  const status = shownStatus(row);
  const conflict = existing ? null : openStatusConflict(row);
  const cancelledEmpty = !existing && cancelledWithoutPayments(status, row.payments);
  const matches = existing?.matches ?? NO_MATCHES;
  const formIndexes = formPaymentIndexes(row.payments, matches, row.addedAnyway);
  const matchedBy = new Map([...matches].map(([index, at]) => [at, index]));
  const types = rowPaymentTypes(row, existing);
  // 4g (#26): chiusa su una riga quando è tutto giusto; aperte solo quelle da completare o da chiarire.
  const attention =
    missing > 0 ||
    Boolean(sameAs) ||
    Boolean(conflict) ||
    cancelledEmpty ||
    skipped ||
    (row.ambiguousSlash && !existing) ||
    (row.invoiceUncertain && !existing) ||
    formIndexes.some((index) => matches.has(index)) ||
    [...matches.keys()].some((index) => !row.addedAnyway[index]);
  const open = row.expanded ?? attention;

  /** Scelta a mano: come prima (Acconto / Saldato senza pagamenti aprono il primo pagamento), e vale contro i pagamenti. */
  function chooseStatus(value: BookingStatus) {
    const next = withStatus(row, value, today, standardFeeCents);
    const keep = paymentsStatus(next) !== value && (value === "interessato" || value === "prenotato");
    onChange({ ...next, forcedStatus: keep ? value : null, statusResolved: true });
  }
  const setPayment = (index: number, payment: PreviewPayment) =>
    onChange({ ...row, payments: row.payments.map((p, i) => (i === index ? payment : p)) });

  if (!open && row.include) {
    return (
      <li className={`${cardClass} flex items-center justify-between gap-2 px-3 py-1.5`}>
        <p className="min-w-0 text-sm">
          {existing ? <span className="text-[#5f524c]">Aggiorna: </span> : null}
          {cardSummaryLine(row.people, status, formIndexes.map((index) => row.payments[index]))}
        </p>
        <button type="button" className={buttonClass.small} onClick={() => onChange({ ...row, expanded: true })}>
          Correggi
        </button>
      </li>
    );
  }

  return (
    <li className={`${cardClass} space-y-2 ${UI.pad} ${row.include && !skipped ? "" : "opacity-60"}`}>
      {row.include && !skipped && missing > 0 ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-[#fdf3e1] px-2.5 py-0.5 text-xs font-semibold text-[#7a5212]">
          <span className="h-2 w-2 rounded-full bg-[#c27a12]" aria-hidden="true" />
          {missing === 1 ? "1 campo da completare" : `${missing} campi da completare`}
        </p>
      ) : null}
      {/* 4f: la riga incollata e "Includi" sulla stessa riga, testo originale in 12 px. */}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 break-words font-mono text-xs text-[#5f524c]">{row.original}</p>
        <label className="flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5 accent-[#a8583e]" checked={row.include} onChange={(e) => onChange({ ...row, include: e.target.checked })} />
          Includi
        </label>
      </div>

      {row.include && skipped ? (
        <Doubt
          text="Cancellata senza pagamenti: non si importa."
          options={[{ value: "importa", label: "Importa comunque" }]}
          onChange={() => onChange({ ...row, importCancelled: true })}
        />
      ) : null}

      {row.include && !skipped ? (
        <>
          {existing ? <Notice tone="warning">Aggiorna l&apos;iscrizione esistente: si aggiungono solo i pagamenti nuovi.</Notice> : null}
          {existing && emailToKeep ? (
            <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#a8583e]"
                checked={row.saveEmail}
                onChange={(e) => onChange({ ...row, saveEmail: e.target.checked })}
              />
              Salva l&apos;email {emailToKeep}
            </label>
          ) : null}

          <div className="space-y-2">
            {row.people.map((name, index) => {
              const empty = !name.trim();
              return (
                // 4f: Nome ed Email affiancati (l'email va a capo se non entra).
                <div key={index} className="flex flex-wrap items-start gap-2">
                  <Field label={index === 0 ? "Nome" : "Partner"} className="flex-[1_1_6rem]">
                    <input
                      className={empty ? missingInputClass : inputClass}
                      data-missing={empty || undefined}
                      aria-invalid={empty || undefined}
                      value={name}
                      disabled={Boolean(existing)}
                      onChange={(e) => onChange({ ...row, people: row.people.map((p, i) => (i === index ? e.target.value : p)) })}
                    />
                    {empty ? <MissingHint /> : null}
                  </Field>
                  {/* 4d (B2): email trovata nella riga (o scritta qui), facoltativa. */}
                  {!existing ? (
                    <Field label="Email (facoltativa)" className="flex-[1_1_8rem]">
                      <input
                        className={compactInputClass}
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        value={row.emails[index] ?? ""}
                        onChange={(e) =>
                          onChange({ ...row, emails: row.people.map((_, i) => (i === index ? e.target.value || null : (row.emails[i] ?? null))) })
                        }
                      />
                    </Field>
                  ) : null}
                </div>
              );
            })}
          </div>
          {sameAs ? (
            <Doubt
              text={`${alreadyEnrolledText(sameAs)}.`}
              options={[
                // 4f: risposte brevi, affiancate anche a 360 px.
                { value: "update", label: "Sì, è lei (aggiungo i pagamenti)" },
                { value: "other", label: "No, è un'altra persona" },
              ]}
              onChange={(choice) => onChange({ ...row, sameAs: choice })}
            />
          ) : null}

          {!existing ? (
            <>
              <div className="flex flex-wrap items-start gap-2">
                <StatusPicker label="Stato" className="flex-[1_1_auto]" value={status} onChange={chooseStatus} />
                <Field
                  className="flex-[1_1_4rem]"
                  label="Prezzo"
                  hint={row.feeText.trim() && row.feeText.trim() !== centsToInput(standardFeeCents) ? "Prezzo speciale" : undefined}
                >
                  <input inputMode="decimal" className={inputClass} value={row.feeText} onChange={(e) => onChange({ ...row, feeText: e.target.value })} />
                </Field>
              </div>
              {conflict ? (
                // 4g (#27): una frase semplice con due risposte piccole.
                <Doubt
                  text={statusConflictText(conflict.text, conflict.payments, rowPaidCents(row)).question}
                  options={[
                    { value: "pagamenti", label: "Sì" },
                    ...(conflict.canKeepText ? [{ value: "testo", label: statusConflictText(conflict.text, conflict.payments, 0).keepLabel }] : []),
                  ]}
                  onChange={(choice) => onChange({ ...row, statusResolved: true, forcedStatus: choice === "testo" ? conflict.text : null })}
                />
              ) : null}
              {cancelledEmpty ? (
                <Doubt
                  text="Cancellata senza pagamenti: la importi comunque."
                  options={[{ value: "salta", label: "Non importare" }]}
                  onChange={() => onChange({ ...row, importCancelled: false })}
                />
              ) : null}

              <div className="flex flex-wrap items-start gap-2">
                <Field label="Note" className="flex-[100_1_12rem]">
                  <input className={inputClass} value={row.notes ?? ""} onChange={(e) => onChange({ ...row, notes: e.target.value || null })} />
                </Field>
                <ChoiceSelect label="Fattura" className="flex-[1_1_11.5rem]" options={INVOICE_OPTIONS} value={row.invoiceStatus} onChange={(value) => onChange({ ...row, invoiceStatus: value, invoiceUncertain: false })} />
              </div>
              {row.invoiceUncertain ? (
                <Doubt
                  text={`Il testo dice "fattura" senza "ok": ${INVOICE_STATUS_LABELS[row.invoiceStatus]}?`}
                  options={INVOICE_OPTIONS}
                  onChange={(value) => onChange({ ...row, invoiceStatus: value, invoiceUncertain: false })}
                />
              ) : null}
            </>
          ) : null}

          {row.warnings.length > 0 ? <p className="text-sm text-[#7a5212]">{row.warnings.join(" · ")}</p> : null}

          {existing?.registration && existing.registration.payments.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#5f524c]">Già registrati</p>
              <ul className="space-y-1 text-sm text-[#5f524c]">
                {existing.registration.payments.map((payment, at) => {
                  const index = matchedBy.get(at);
                  return (
                    <li key={payment.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        {formatCents(payment.amountCents)} · {PAYMENT_TYPE_LABELS[payment.paymentType]}
                        {payment.method ? ` · ${PAYMENT_METHOD_LABELS[payment.method]}` : ""} · {formatPaymentDate(payment.paidOn)} · {PARTY_LABELS[payment.receivedBy]}
                      </span>
                      {index !== undefined && !row.addedAnyway[index] ? (
                        <>
                          <span className="font-medium text-[#7a5212]">anche nel testo</span>
                          <button
                            type="button"
                            className={buttonClass.ghost}
                            onClick={() => onChange({ ...row, addedAnyway: { ...row.addedAnyway, [index]: true } })}
                          >
                            Aggiungilo comunque
                          </button>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {formIndexes.length > 0 ? (
            <div className="space-y-2">
              {formIndexes.map((index, position) => (
                <PaymentMiniForm
                  key={index}
                  number={position + 1}
                  payment={row.payments[index]}
                  type={types[index]}
                  today={today}
                  onChange={(payment) => setPayment(index, payment)}
                  onRemove={() => setPayment(index, { ...row.payments[index], removed: true })}
                >
                  {index === 0 && row.ambiguousSlash && !existing ? (
                    <Doubt
                      text={`${row.payments[index].amountText} € seguito da "/": cos'è?`}
                      options={[
                        { value: "pagamento", label: "È un pagamento" },
                        { value: "quota", label: "È la quota" },
                      ]}
                      onChange={(value) =>
                        onChange(
                          value === "quota"
                            ? {
                                ...row,
                                ambiguousSlash: false,
                                feeText: row.payments[index].amountText,
                                feeCustom: true,
                                payments: row.payments.map((p, i) => (i === index ? { ...p, removed: true } : p)),
                              }
                            : { ...row, ambiguousSlash: false },
                        )
                      }
                    />
                  ) : null}
                  {matches.has(index) ? (
                    <Doubt
                      text="Uguale a un pagamento già registrato."
                      options={[{ value: "togli", label: "Non aggiungerlo" }]}
                      onChange={() => onChange({ ...row, addedAnyway: { ...row.addedAnyway, [index]: false } })}
                    />
                  ) : null}
                </PaymentMiniForm>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

/** Il localStorage cambia da un'altra scheda: si rilegge la bozza. */
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Box "Scrivi o incolla dagli appunti" (sezione 6): Leggi il testo → anteprima
 * a moduli per persona → Salva in un'unica funzione Postgres. L'anteprima non
 * mostra abbinamenti né dati anagrafici (D18, D20). 4g (#23): testo e
 * anteprima non salvati restano come bozza solo su questo telefono
 * (localStorage, per workshop e operatore) fino al salvataggio, a "Svuota" o
 * per 7 giorni. Aperto da solo se l'elenco è vuoto o c'è una bozza.
 */
export function TextImport({
  workshopId,
  operatorId,
  standardFeeCents,
  registrations,
  today,
}: {
  workshopId: string;
  operatorId: string;
  standardFeeCents: number;
  registrations: Registration[];
  today: string;
}) {
  // null = automatico: aperto se l'elenco è vuoto o c'è una bozza da riprendere.
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [matches, setMatches] = useState<Map<number, ServerMatch>>(new Map());
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);

  // 4g (#23): bozza su questo telefono. `touched`: Ale ha scritto qualcosa in
  // questa visita (solo allora la bozza si aggiorna); `draftHandled`: ha già
  // scelto Riprendi o Svuota (o ha salvato).
  const storageKey = draftKey(workshopId, operatorId);
  const storedRaw = useSyncExternalStore(subscribeStorage, () => draftStorage.get(storageKey), () => null);
  const stored = readDraft<PreviewRow>(storedRaw, today);
  const [touched, setTouched] = useState(false);
  const [draftHandled, setDraftHandled] = useState(false);
  const showDraftPrompt = stored !== null && !touched && !draftHandled;
  const storedExpired = storedRaw !== null && stored === null;
  const open = openChoice ?? (registrations.length === 0 || showDraftPrompt);

  useEffect(() => {
    if (!touched) return;
    draftStorage.set(storageKey, serializeDraft(text, rows, new Date().toISOString()));
  }, [touched, storageKey, text, rows]);

  // Bozza scaduta (più di 7 giorni) o non valida: si cancella.
  useEffect(() => {
    if (storedExpired) draftStorage.set(storageKey, null);
  }, [storedExpired, storageKey]);

  function editText(value: string) {
    setTouched(true);
    setText(value);
  }

  function editRows(update: (current: PreviewRow[] | null) => PreviewRow[] | null) {
    setTouched(true);
    setRows(update);
  }

  // 4g (#24): "Torna al testo" dopo delle correzioni chiede prima conferma.
  const [previewEdited, setPreviewEdited] = useState(false);
  const [askBack, setAskBack] = useState(false);
  function backToText() {
    setAskBack(false);
    setPreviewEdited(false);
    editRows(() => null);
  }

  /** "Riprendi": testo e anteprima come li aveva lasciati. */
  function resumeDraft() {
    if (!stored) return;
    setDraftHandled(true);
    setTouched(true);
    setOpenChoice(true);
    setText(stored.text);
    setRows(stored.rows);
    setPreviewEdited(stored.rows !== null);
    setMatches(new Map());
    if (stored.rows) fetchMatches(stored.rows);
  }

  /** "Svuota": via testo, anteprima e bozza. */
  function clearDraft() {
    draftStorage.set(storageKey, null);
    setDraftHandled(true);
    setTouched(false);
    setText("");
    setRows(null);
    setMatches(new Map());
    setMessage(null);
  }

  function interpret() {
    setMessage(null);
    const parsed = parseRoster(text, { standardFeeCents });
    if (parsed.length === 0) {
      setMessage({ tone: "error", text: "Nessuna riga riconosciuta: scrivi un nome per riga." });
      return;
    }
    const preview = toPreview(parsed);
    setPreviewEdited(false);
    editRows(() => preview);
    setMatches(new Map());
    fetchMatches(preview);
  }

  function fetchMatches(preview: PreviewRow[]) {
    // 4e (#5): il server dice se un nome corrisponde già a un'iscrizione (solo id e testo di Ale).
    const entries = preview.map((row) => (row.emails[0] ? { text: row.people[0], email: row.emails[0] } : row.people[0]));
    void previewMatchesAction({ workshopId, entries }).then((result) => {
      if (!result.ok) return;
      const found = new Map<number, ServerMatch>();
      result.data.forEach((match, index) => {
        if (match) found.set(preview[index].key, { text: preview[index].people[0], ...match });
      });
      setMatches(found);
    });
  }

  /** Abbinamento del server ancora valido (il nome non è stato cambiato) verso un'iscrizione che Ale vede. */
  function serverMatch(row: PreviewRow): ServerMatch | null {
    const match = matches.get(row.key);
    if (!match || normalizeText(row.people[0] ?? "") !== normalizeText(match.text)) return null;
    return registrations.some((registration) => registration.bookingId === match.bookingId) ? match : null;
  }

  /** "Già presente" dal testo, oppure l'iscrizione scelta con "Sì, è lei". */
  function existingOf(row: PreviewRow): Existing | null {
    const match = serverMatch(row);
    // Solo il nome: i pagamenti già registrati si abbinano qui sotto (registeredMatches).
    const byName = { people: row.people, payments: [] };
    const found =
      findExisting(byName, registrations, "") ??
      (() => {
        const registration = match && row.sameAs === "update" ? registrations.find((r) => r.bookingId === match.bookingId) : undefined;
        return registration ? existingFromRegistration(byName, registration, "") : null;
      })();
    if (!found) return null;
    const registration = registrations.find((r) => r.bookingId === found.bookingId);
    return { bookingId: found.bookingId, version: found.version, registration, matches: registeredMatches(row.payments, registration?.payments ?? []) };
  }

  /** "Sembra già iscritta come «X»" ancora da chiarire. */
  function sameAsQuestion(row: PreviewRow): string | null {
    if (row.sameAs || findExisting({ people: row.people, payments: [] }, registrations, "")) return null;
    return serverMatch(row)?.enteredAs ?? null;
  }

  /** Riga nuova cancellata senza pagamenti: non si importa, salvo "Importa comunque". */
  function skipped(row: PreviewRow): boolean {
    return !row.importCancelled && !existingOf(row) && cancelledWithoutPayments(shownStatus(row), row.payments);
  }

  /** 4e (#9): email da salvare sull'iscrizione già presente. */
  function emailToKeep(row: PreviewRow, existing: Existing | null): string | null {
    return existing ? emailToSave(row.emails[0], existing.registration) : null;
  }

  const cards = (rows ?? []).map((row) => {
    const existing = existingOf(row);
    const formIndexes = formPaymentIndexes(row.payments, existing?.matches ?? NO_MATCHES, row.addedAnyway);
    const counted = row.include && !skipped(row);
    return { row, existing, formIndexes, counted, missing: counted ? cardMissingCount(row.people, row.payments, formIndexes) : 0 };
  });
  const missingTotal = cards.reduce((sum, card) => sum + card.missing, 0);
  const foundPayments = (rows ?? []).reduce((sum, row) => sum + row.payments.filter((payment) => payment.parsed).length, 0);

  /** "Completa N campi": porta al primo campo mancante. */
  function goToFirstMissing() {
    const field = listRef.current?.querySelector<HTMLElement>("[data-missing]");
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    field?.focus({ preventScroll: true });
  }

  function save() {
    if (!rows) return;
    if (missingTotal > 0) {
      goToFirstMissing();
      return;
    }
    const payload: Parameters<typeof importRosterAction>[0]["rows"] = [];
    for (const { row, existing, formIndexes, counted } of cards) {
      if (!counted) continue;
      const fee = row.feeText.trim() ? parseEuroToCents(row.feeText) : null;
      if (row.feeText.trim() && fee === null) {
        setMessage({ tone: "error", text: `Riga ${row.line}: Prezzo, scrivi un numero (es. 450).` });
        return;
      }
      const emails = row.people.map((_, i) => row.emails[i]?.trim().toLowerCase() || null);
      if (emails.some((email) => email && !EMAIL_PATTERN.test(email))) {
        setMessage({ tone: "error", text: `Riga ${row.line}: email non valida.` });
        return;
      }
      if (!existing && (row.baseStatus === "acconto" || row.baseStatus === "saldato") && formIndexes.length === 0) {
        setMessage({ tone: "error", text: `Riga ${row.line}: Acconto pagato o Saldato, registra il primo pagamento.` });
        return;
      }
      // Campi completi (missingTotal = 0): importo e metodo ci sono; il tipo si deduce (4g). La data è facoltativa (026).
      const types = rowPaymentTypes(row, existing);
      const payments = formIndexes.map((index) => {
        const payment = row.payments[index];
        return {
          amount_cents: parseEuroToCents(payment.amountText)!,
          method: payment.method,
          payment_type: types[index],
          paid_on: payment.paidOn || null,
          received_by: payment.receivedBy,
        };
      });
      const keepEmail = row.saveEmail ? emailToKeep(row, existing) : null;
      payload.push({
        booking_id: existing?.bookingId ?? null,
        booking_version: existing?.version ?? null,
        ...(keepEmail ? { entered_email: keepEmail } : {}),
        people: row.people.map((name, i) => (emails[i] && !existing ? { text: name.trim(), email: emails[i]! } : name.trim())),
        status: row.baseStatus,
        // Stato tenuto contro i pagamenti (solo righe nuove; il database lo applica dopo la regola automatica).
        forced_status: existing ? null : row.forcedStatus,
        // D19: uguale alla quota del workshop (o vuota) = la segue; diversa = tariffa dedicata.
        fee_cents: fee === standardFeeCents ? null : fee,
        invoice_status: row.invoiceStatus,
        notes: row.notes,
        payments,
      });
    }
    if (payload.length === 0) {
      setMessage({ tone: "error", text: "Nessuna riga inclusa." });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      // Ogni pagamento ha la sua data e il suo "Incassato da" (025).
      const result = await importRosterAction({ workshopId, paidOn: "", receivedBy: DEFAULT_RECEIVED_BY, rows: payload });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      const { created, updated, payments } = result.data;
      draftStorage.set(storageKey, null);
      setDraftHandled(true);
      setTouched(false);
      setRows(null);
      setText("");
      setOpenChoice(false);
      setMessage({
        tone: "success",
        text: importDoneMessage(created, updated, payments),
      });
    });
  }

  return (
    <div className={cardClass}>
      <button
        type="button"
        onClick={() => setOpenChoice(!open)}
        aria-expanded={open}
        className={`flex ${UI.row} w-full items-center justify-between gap-3 px-3 text-left text-[15px] font-semibold`}
      >
        Scrivi o incolla dagli appunti
        <ChevronDown className={`h-5 w-5 text-[#5f524c] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {!open && message?.tone === "success" ? (
        <div className="px-3 pb-3">
          <Notice tone="success">{message.text}</Notice>
        </div>
      ) : null}

      {open ? (
        <div className={`${UI.blocks} border-t border-[#211815]/10 ${UI.pad}`}>
          {showDraftPrompt && stored ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg bg-[#fdf3e1] px-2 py-1.5">
              <p className="text-[13px] font-medium text-[#7a5212]">{draftPrompt(stored.savedAt)}</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={buttonClass.small} onClick={resumeDraft}>
                  Riprendi
                </button>
                <button type="button" className={buttonClass.small} onClick={clearDraft}>
                  Svuota
                </button>
              </div>
            </div>
          ) : null}
          {rows === null ? (
            <>
              {/* 4g (ipotesi 7): una riga di aiuto con un esempio. */}
              <p className="text-sm text-[#5f524c]">Un nome per riga, con quanto ha pagato e come, es. «Claudia 250 paypal».</p>
              <textarea
                rows={6}
                className={`${textareaClass} min-h-32 font-mono text-sm`}
                value={text}
                onChange={(e) => editText(e.target.value)}
                placeholder={"1. Nome (250€ paypal) +250€ cash\n2. Nome + Partner 450€ bonifico"}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass.primary} onClick={interpret} disabled={!text.trim()}>
                  Leggi il testo
                </button>
                {text.trim() ? (
                  <button type="button" className={buttonClass.ghost} onClick={clearDraft}>
                    Svuota
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className={`text-sm font-semibold ${missingTotal > 0 ? "text-[#7a5212]" : "text-[#2f5d3b]"}`}>
                {previewSummary(rows.length, foundPayments, missingTotal)}
              </p>

              <ul ref={listRef} className="space-y-2">
                {cards.map(({ row, existing, missing }) => (
                  <PreviewCard
                    key={row.key}
                    row={row}
                    existing={existing}
                    emailToKeep={emailToKeep(row, existing)}
                    skipped={skipped(row)}
                    missing={missing}
                    sameAs={sameAsQuestion(row)}
                    standardFeeCents={standardFeeCents}
                    today={today}
                    onChange={(next) => {
                      setPreviewEdited(true);
                      editRows((current) => current?.map((r) => (r.key === next.key ? next : r)) ?? null);
                    }}
                  />
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass.primary} onClick={save} disabled={pending}>
                  {pending ? "Salvataggio…" : saveLabel(missingTotal)}
                </button>
                <button
                  type="button"
                  className={buttonClass.ghost}
                  onClick={() => (previewEdited ? setAskBack(true) : backToText())}
                  disabled={pending}
                >
                  Torna al testo
                </button>
              </div>
              {askBack ? (
                <Doubt
                  text="Le correzioni dell'anteprima si perdono."
                  options={[
                    { value: "back", label: "Torna al testo" },
                    { value: "stay", label: "Resta" },
                  ]}
                  onChange={(choice) => (choice === "back" ? backToText() : setAskBack(false))}
                />
              ) : null}
            </>
          )}
          {message && (open || message.tone === "error") ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        </div>
      ) : null}
    </div>
  );
}
