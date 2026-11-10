"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  refundBookingAction,
  setBookingFeeAction,
  updateRegistrationAction,
  updateWorkshopFeeAction,
} from "@/app/gestione/(app)/w/registration-actions";
import { centsToInput, formatCents } from "@/lib/gestionale/format";
import { BOOKING_STATUS_LABELS, INVOICE_STATUS_LABELS, PARTY_LABELS, UI_LABELS, insertedByLabel, isConfirmed } from "@/lib/gestionale/labels";
import {
  currentPayments,
  deducedPaymentType,
  feeSummary,
  newPaymentPreset,
  owesMoney,
  paidCents,
  paymentCount,
  refundPlan,
  statusJustified,
  unsettledWarning,
  type CurrentPayment,
  type FeeRow,
} from "@/lib/gestionale/payments";
import { canMarkPresent } from "@/lib/gestionale/presence";
import { alreadyEnrolledHint, matchesSearch, registrationPersonLabel, registrationTitle } from "@/lib/gestionale/registrations";
import type { BookingStatus, InvoiceStatus, Party, PaymentMethod, Registration } from "@/lib/gestionale/types";

import { AddRegistration } from "./AddRegistration";
import { DeleteBookingConfirm, DeletePaymentConfirm, UndoSlot } from "./Deletion";
import { EnteredEmails } from "./EnteredEmails";
import { useFeeChangeConfirm } from "./FeeChangeConfirm";
import { FeeEditor } from "./FeeEditor";
import { CurrentPaymentList, PaymentTotalsBox } from "./PaymentBits";
import { PresentToggle } from "./PresentToggle";
import { METHOD_OPTIONS, PARTY_OPTIONS, PAYMENT_FIELD_WIDTH, PaymentForm, type PaymentFormMode } from "./PaymentForm";
import { StatusDot, StatusPicker } from "./StatusPicker";
import { TextImport } from "./TextImport";
import { ChoiceSelect, Chip, DateField, Field, InlineConfirm, Notice, RowMenu, UI, buttonClass, cardClass, compactInputClass, inputClass, textareaClass } from "./ui";

type WorkshopFee = { id: string; version: number; defaultFeeCents: number | null };
type Message = { tone: "success" | "error" | "warning"; text: string } | null;
type SavedField = "fee" | "status" | "invoice" | "notes";

const INVOICE_STATUSES = Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[];

/**
 * 4g (#14): Acconto pagato e Saldato restano sceglibili a mano (ipotesi 3 non
 * approvata); il modulo che si apre lo spiega, e chiudendolo senza registrare
 * lo si dice.
 */
export const CONFIRM_STATUS_HINT = "Registra il pagamento per confermare lo stato.";
export const STATUS_NOT_CHANGED = "Stato non cambiato: nessun pagamento registrato.";

/** Riquadro "Imposta il prezzo del workshop" (primo passo, D19) e cambio del prezzo (4g, #40: prima la conferma). */
function FeeForm({
  workshop,
  feeRows = [],
  onDone,
  onSaved,
}: {
  workshop: WorkshopFee;
  feeRows?: readonly FeeRow[];
  onDone?: () => void;
  onSaved?: (message: Message) => void;
}) {
  const [fee, setFee] = useState(centsToInput(workshop.defaultFeeCents));
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useFeeChangeConfirm(feeRows);

  function save(confirmed = false) {
    setMessage(null);
    if (!confirmed && !confirm.check(fee)) return;
    confirm.clear();
    startTransition(async () => {
      const result = await updateWorkshopFeeAction({ workshopId: workshop.id, version: workshop.version, fee });
      if (result.ok) {
        const warning = unsettledWarning(result.data.unsettled);
        const saved: Message = warning ? { tone: "warning", text: `Prezzo salvato. ${warning}` } : { tone: "success", text: "Prezzo salvato." };
        setMessage(saved);
        onSaved?.(saved);
        onDone?.();
      } else {
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  return (
    <div className={UI.blocks}>
      <Field
        label="Prezzo per iscrizione (singolo o coppia)"
        hint="es. 450 o 450,50 · Cambia per tutti, tranne i prezzi speciali."
      >
        <input inputMode="decimal" className={inputClass} value={fee} onChange={(e) => setFee(e.target.value)} />
      </Field>
      {confirm.question ? (
        <InlineConfirm question={confirm.question} confirmLabel="Sì, cambia" pending={pending} onConfirm={() => save(true)} onCancel={confirm.clear} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass.primary} onClick={() => save()} disabled={pending}>
            {pending ? "Salvataggio…" : "Salva"}
          </button>
          {onDone ? (
            <button type="button" className={buttonClass.ghost} onClick={onDone}>
              Chiudi
            </button>
          ) : null}
        </div>
      )}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    </div>
  );
}

function StatusTag({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isConfirmed(status) ? "bg-[#a8583e]/10 text-[#a8583e]" : "bg-[#211815]/5 text-[#5f524c]"
      }`}
    >
      <StatusDot status={status} />
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}

/** Breve "Salvato." accanto al campo appena salvato. */
function Saved({ show }: { show: boolean }) {
  return show ? (
    <span role="status" className="text-sm font-semibold text-[#2f5d3b]">
      {UI_LABELS.saved}
    </span>
  ) : null;
}

/**
 * Azioni di un movimento valido. 4g (#11, ipotesi 4): "Modifica" (valore
 * attuale precompilato) è sempre visibile; nel menu "…" restano le azioni
 * rare, Rimborso ed Elimina (D22, sempre con conferma). Una rettifica libera
 * si può solo eliminare.
 */
function PaymentActions({
  entry,
  onPick,
  onDelete,
}: {
  entry: CurrentPayment;
  onPick: (mode: PaymentFormMode) => void;
  onDelete: () => void;
}) {
  // Si modifica il valore attuale (al netto di eventuali rettifiche parziali).
  const payment = { ...entry.payment, amountCents: entry.amountCents };
  return (
    <span className="flex items-center">
      {payment.kind === "rettifica" ? null : (
        <button type="button" className={buttonClass.small} onClick={() => onPick({ kind: "correzione", original: payment })}>
          Modifica
        </button>
      )}
      <RowMenu
        label="Altre azioni sul movimento"
        items={[
          ...(payment.kind === "pagamento" ? [{ label: "Ho restituito dei soldi", onClick: () => onPick({ kind: "rimborso", from: payment }) }] : []),
          { label: "Elimina", onClick: onDelete, danger: true },
        ]}
      />
    </span>
  );
}

/**
 * 4e (#2), 4g (#16): iscrizione cancellata con soldi pagati. "Ho restituito
 * X € a questa persona" (il gestionale non muove soldi, registra che sono
 * stati restituiti), con conferma: un rimborso per ogni parte che ha
 * incassato (gw_refund_booking); se non si può ripartire, si chiede chi li ha
 * restituiti.
 */
function RefundPaid({ registration, today, onDone }: { registration: Registration; today: string; onDone: (text: string) => void }) {
  const plan = refundPlan(registration.payments);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [party, setParty] = useState<Party | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = formatCents(plan.totalCents);

  function submit() {
    if (plan.askParty && !party) {
      setError("Indica chi ha restituito i soldi.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await refundBookingAction({
        bookingId: registration.bookingId,
        expectedCents: plan.totalCents,
        method,
        paidOn,
        receivedBy: plan.askParty ? party : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDone("Fatto: soldi restituiti registrati.");
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#b7791f]/30 bg-[#fdf3e1] p-2 text-sm text-[#7a5212]">
      <p className="font-medium">Cancellato con {total} pagati.</p>
      {open ? (
        <div className="space-y-2 text-[#211815]">
          <p className="font-semibold">Hai restituito {total} a {registrationTitle(registration)}? Lo segno come fatto.</p>
          {!plan.askParty && plan.parts.length > 1 ? (
            <p className="text-[#5f524c]">
              Restituiti da: {plan.parts.map((part) => `${PARTY_LABELS[part.party]} ${formatCents(part.cents)}`).join(" · ")}.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 sm:max-w-md">
            <ChoiceSelect label="Metodo" className={PAYMENT_FIELD_WIDTH.method} options={METHOD_OPTIONS} value={method} onChange={setMethod} placeholder="—" />
            <DateField className={PAYMENT_FIELD_WIDTH.date} value={paidOn} today={today} onChange={setPaidOn} />
            {plan.askParty ? (
              <ChoiceSelect label="Restituiti da" className={PAYMENT_FIELD_WIDTH.party} options={PARTY_OPTIONS} value={party} onChange={setParty} />
            ) : null}
          </div>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.primary} disabled={pending} onClick={submit}>
              {pending ? "Salvataggio…" : "Sì, li ho restituiti"}
            </button>
            <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => setOpen(false)} autoFocus>
              Chiudi
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={buttonClass.secondary} onClick={() => setOpen(true)}>
          Ho restituito {total} a questa persona
        </button>
      )}
    </div>
  );
}

/**
 * Riga aperta, ogni campo si salva da solo (4e, #4): quota (matita), stato,
 * pagamenti (4g, #8: aperti di default), poi "Altri dati" richiudibile
 * (email, fattura, note). `startPayment`: aperta da "+ Pagamento" sulla riga
 * chiusa, il modulo del pagamento è già aperto.
 */
function RegistrationDetails({
  registration,
  today,
  lastMethod,
  startPayment = false,
  onSaved,
}: {
  registration: Registration;
  today: string;
  lastMethod: PaymentMethod | null;
  startPayment?: boolean;
  /** Richiude la scheda solo dopo un salvataggio confermato dal server. */
  onSaved?: (message: string) => void;
}) {
  const [status, setStatus] = useState<BookingStatus>(registration.status);
  const [invoice, setInvoice] = useState<InvoiceStatus>(registration.invoiceStatus);
  const [notes, setNotes] = useState(registration.notes ?? "");
  const [paymentsOpen, setPaymentsOpen] = useState(true);
  const [otherOpen, setOtherOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormMode | null>(() =>
    startPayment ? { kind: "pagamento", ...newPaymentPreset(registration.payments, registration.agreedFeeCents) } : null,
  );
  const [deletingPayment, setDeletingPayment] = useState<CurrentPayment | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [saved, setSaved] = useState<SavedField | null>(null);
  const [pending, startTransition] = useTransition();

  // Nuova versione dal server (salvataggi, pagamenti, quota del workshop):
  // i campi la seguono; le note solo se non si stanno modificando.
  const [synced, setSynced] = useState({ version: registration.version, notes: registration.notes ?? "" });
  if (registration.version !== synced.version) {
    setSynced({ version: registration.version, notes: registration.notes ?? "" });
    setStatus(registration.status);
    setInvoice(registration.invoiceStatus);
    if (notes === synced.notes) setNotes(registration.notes ?? "");
  }

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const paid = paidCents(registration.payments);
  const fee = registration.agreedFeeCents;
  // 4g (ipotesi 1): tipo dedotto dall'importo e da quanto è già stato pagato.
  const autoType = (cents: number | null) => deducedPaymentType(paid, cents, fee);

  function run(field: SavedField, action: () => Promise<{ ok: true } | { ok: false; error: string }>, onError?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setSaved(field);
        // Le note hanno autosalvataggio al blur: non richiudere la scheda
        // mentre si passa a un altro controllo con il dito.
        if (field !== "notes") onSaved?.("Modifica salvata.");
      } else {
        onError?.();
        setMessage({ tone: "error", text: result.error });
      }
    });
  }

  function saveRegistration(field: SavedField, values: { status: BookingStatus; invoiceStatus: InvoiceStatus; notes: string }, onError?: () => void) {
    run(
      field,
      () =>
        updateRegistrationAction({
          bookingId: registration.bookingId,
          version: registration.version,
          status: values.status,
          invoiceStatus: values.invoiceStatus,
          notes: values.notes,
        }),
      onError,
    );
  }

  function saveFee(text: string | null): Promise<boolean> {
    setMessage(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await setBookingFeeAction({ bookingId: registration.bookingId, version: registration.version, fee: text });
        if (result.ok) {
          setSaved("fee");
          onSaved?.("Prezzo salvato.");
        } else {
          setMessage({ tone: "error", text: result.error });
        }
        resolve(result.ok);
      });
    });
  }

  function changeStatus(next: BookingStatus) {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    if (next === "acconto" || next === "saldato") {
      // Sempre: sezione Pagamenti aperta con "Nuovo pagamento" e tipo
      // preselezionato (Saldato → importo = residuo).
      const justified = statusJustified(next, paid, fee);
      setPaymentsOpen(true);
      setForm({
        kind: "pagamento",
        paymentType: next === "saldato" ? "saldo" : "acconto",
        amountCents: next === "saldato" && fee !== null && fee > paid ? fee - paid : undefined,
        // Non giustificato: lo stato si salva solo registrando il pagamento.
        targetStatus: justified ? undefined : next,
      });
      if (!justified) return;
      // Stato già giustificato dai pagamenti: nessun nuovo modulo necessario.
      // Il salvataggio automatico richiuderà la scheda.
      setForm(null);
    } else if (form?.kind === "pagamento" && form.targetStatus) {
      setForm(null);
    }
    saveRegistration("status", { status: next, invoiceStatus: invoice, notes }, () => setStatus(previous));
  }

  function closeForm(text: string) {
    const fromStatus = form?.kind === "pagamento" && form.targetStatus;
    setForm(null);
    if (text) {
      setMessage({ tone: "success", text });
      onSaved?.(text);
    } else if (fromStatus) {
      // Chiuso senza registrare: il menu torna allo stato salvato (4g, #14: e lo dice).
      setStatus(registration.status);
      setMessage({ tone: "warning", text: STATUS_NOT_CHANGED });
    }
  }

  const count = paymentCount(registration.payments);

  return (
    <div className={`${UI.blocks} border-t-2 border-[#a8583e]/20 bg-[#f7f3ec] px-3 py-4`}>
      <EnteredEmails registration={registration} />
      <div className="border-t border-[#211815]/15 pt-3">
        <h3 className="mb-2 text-sm font-semibold text-[#5f524c]">
          Iscrizione · quota e pagamenti {registration.people.length>1?"della coppia":""}
        </h3>
      </div>
      {/* 4f: Quota · Stato affiancati (lo stato va a capo se non entra). */}
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
        <div className="flex-[1_1_6rem]">
          <FeeEditor
            feeCents={fee}
            custom={registration.feeCustom}
            disabled={pending}
            onSave={(text) => saveFee(text)}
            onRestore={() => void saveFee(null)}
          />
          <Saved show={saved === "fee"} />
        </div>
        <div className="flex-[1_1_auto]">
          <StatusPicker value={status} onChange={changeStatus} />
          <Saved show={saved === "status"} />
        </div>
      </div>

      <div className="space-y-2">
        {status === "cancellato" && registration.status === "cancellato" && paid > 0 ? (
          <RefundPaid
            key={`${registration.version}-${paid}`}
            registration={registration}
            today={today}
            onDone={(text) => {
              setPaymentsOpen(true);
              setMessage({ tone: "success", text });
              onSaved?.(text);
            }}
          />
        ) : null}
      </div>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <div className="rounded-lg border border-[#211815]/10">
        <button
          type="button"
          aria-expanded={paymentsOpen}
          onClick={() => setPaymentsOpen(!paymentsOpen)}
          className={`flex ${UI.row} w-full items-center justify-between gap-3 px-2 text-left text-[15px] font-semibold`}
        >
          <span>
            Pagamenti · {count} · {formatCents(paid)}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-[#5f524c] transition ${paymentsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {paymentsOpen ? (
          <div className="space-y-2 px-2 pb-2">
            <CurrentPaymentList
              payments={registration.payments}
              actions={(entry) => <PaymentActions entry={entry} onPick={setForm} onDelete={() => setDeletingPayment(entry)} />}
            />
            {/* 4g (#18): "Eliminato · Annulla" qui, vicino ai pagamenti. */}
            <UndoSlot scope={`payments:${registration.bookingId}`} />
            {deletingPayment ? (
              <DeletePaymentConfirm
                key={deletingPayment.payment.id}
                entry={deletingPayment}
                name={registrationTitle(registration)}
                onClose={() => setDeletingPayment(null)}
                undoScope={`payments:${registration.bookingId}`}
              />
            ) : null}
            {form ? (
              // 4f: il modulo usa tutta la larghezza del riquadro (Importo · Metodo · Data su una riga a 360 px).
              <div className="-mx-2">
                <PaymentForm
                  key={
                    form.kind === "correzione"
                      ? form.original.id
                      : form.kind === "rimborso"
                        ? `r-${form.from?.id ?? ""}`
                        : `p-${form.paymentType ?? ""}-${form.amountCents ?? ""}-${form.targetStatus ?? ""}`
                  }
                  bookingId={registration.bookingId}
                  mode={form}
                  today={today}
                  onDone={closeForm}
                  autoType={autoType}
                  lastMethod={lastMethod}
                  autoFocus={false}
                  hint={form.kind === "pagamento" && form.targetStatus ? CONFIRM_STATUS_HINT : undefined}
                  onDelete={
                    form.kind === "correzione"
                      ? () => {
                          const entry = currentPayments(registration.payments).find((e) => e.payment.id === form.original.id);
                          setForm(null);
                          if (entry) setDeletingPayment(entry);
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              <button
                type="button"
                className={buttonClass.secondary}
                // 4e (#1): con un pagamento già valido si propone il Saldo col residuo.
                onClick={() => setForm({ kind: "pagamento", ...newPaymentPreset(registration.payments, fee) })}
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                Nuovo pagamento
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-[#211815]/10">
        <button
          type="button"
          aria-expanded={otherOpen}
          onClick={() => setOtherOpen(!otherOpen)}
          className={`flex ${UI.row} w-full items-center justify-between gap-3 px-2 text-left text-[15px] font-semibold`}
        >
          <span>Altri dati</span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-[#5f524c] transition ${otherOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {otherOpen ? (
          <div className="space-y-2 px-2 pb-2">
            {/* Le persone sono modificabili in alto; qui restano solo fattura e note. */}
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <label className="block min-w-0 flex-[0_1_11.5rem]">
              <span className={UI.label}>
                Fattura <Saved show={saved === "invoice"} />
              </span>
              <select
                className={compactInputClass}
                value={invoice}
                disabled={pending}
                onChange={(e) => {
                  const value = e.target.value as InvoiceStatus;
                  if (value === invoice) return;
                  const previous = invoice;
                  setInvoice(value);
                  saveRegistration("invoice", { status: registration.status, invoiceStatus: value, notes }, () => setInvoice(previous));
                }}
              >
                {INVOICE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {INVOICE_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              </label>
            </div>

            <label className="block">
              <span className={UI.label}>
                Note <Saved show={saved === "notes"} />
              </span>
              <textarea
                rows={1}
                className={textareaClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes.trim() === (registration.notes ?? "").trim()) return;
                  saveRegistration("notes", { status: registration.status, invoiceStatus: invoice, notes });
                }}
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tab Iscrizioni (D18–D21), solo organizzatrice. Mostra solo il testo scritto
 * da Ale e i dati economici: niente anagrafica, niente stato socio.
 */
export function RegistrationsTab({
  workshop,
  operatorId,
  registrations,
  today,
  lastMethod = null,
  initialFilter = null,
  showPresence = false,
}: {
  workshop: WorkshopFee;
  /** Chiave della bozza del box di testo su questo telefono (4g, #23). */
  operatorId: string;
  registrations: Registration[];
  today: string;
  /** 4g (#10): metodo dell'ultimo pagamento registrato da Ale. */
  lastMethod?: PaymentMethod | null;
  /** 4g (ipotesi 6): "chi deve pagare" dal tab Conti. */
  initialFilter?: "da-pagare" | null;
  /** D27: spunta "Presente" sulla riga, dal giorno di inizio. */
  showPresence?: boolean;
}) {
  const [editingFee, setEditingFee] = useState(false);
  const [feeMessage, setFeeMessage] = useState<Message>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const expandedCardRef = useRef<HTMLLIElement | null>(null);
  const [lastSaved, setLastSaved] = useState<{id:string; message:string} | null>(null);
  // 4g (#8): "+ Pagamento" sulla riga chiusa apre la riga col modulo già aperto (il numero la rimonta).
  const [paymentStart, setPaymentStart] = useState<{ id: string; n: number } | null>(null);
  const [query, setQuery] = useState("");
  const [onlyOwing, setOnlyOwing] = useState(initialFilter === "da-pagare");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 4g (#18): iscrizione eliminata e quella prima, per mostrare lì "Eliminato · Annulla".
  const [deleted, setDeleted] = useState<{ id: string; afterId: string | null } | null>(null);

  // Quando si apre una scheda, il punto di riferimento è il suo nominativo,
  // non il primo campo di pagamento a metà pagina. Vale anche per "+ Pagamento".
  useEffect(() => {
    if (!openId) return;
    const frame = window.requestAnimationFrame(() => {
      const node = expandedCardRef.current;
      if (!node) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openId, paymentStart?.n]);

  useEffect(() => {
    if (!lastSaved) return;
    const timer = window.setTimeout(() => setLastSaved(null), 3000);
    return () => window.clearTimeout(timer);
  }, [lastSaved]);

  function closeAfterSave(id: string, message: string) {
    const card = expandedCardRef.current;
    setOpenId(null);
    setPaymentStart(null);
    setLastSaved({id, message});
    // Conserva in vista la riga appena salvata anche quando si riduce
    // da molte centinaia di pixel a una sola intestazione.
    window.requestAnimationFrame(() => {
      if (card?.isConnected) {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    });
  }

  if (workshop.defaultFeeCents === null) {
    return (
      <div className={`${cardClass} max-w-xl ${UI.blocks} ${UI.pad}`}>
        <h2 className={UI.sectionTitle}>Imposta il prezzo del workshop</h2>
        <p className="text-sm text-[#5f524c]">
          È il prezzo di un&apos;iscrizione: singolo o coppia pagano lo stesso. Vale per tutte le iscrizioni, tranne i prezzi speciali.
        </p>
        <FeeForm workshop={workshop} />
      </div>
    );
  }

  const standardFee = workshop.defaultFeeCents;
  const owing = registrations.filter(owesMoney).length;
  const visible = registrations.filter((registration) => matchesSearch(registration, query) && (!onlyOwing || owesMoney(registration)));

  return (
    <div className={UI.blocks}>
      <div className="space-y-2">
        {editingFee ? (
          <div className={`${cardClass} max-w-xl ${UI.pad}`}>
            <FeeForm
              workshop={workshop}
              feeRows={registrations.map((r) => ({ status: r.status, agreedFeeCents: r.agreedFeeCents, feeCustom: r.feeCustom, paidCents: paidCents(r.payments) }))}
              onDone={() => setEditingFee(false)}
              onSaved={setFeeMessage}
            />
          </div>
        ) : (
          <p className="text-sm text-[#5f524c]">
            Prezzo del workshop: <strong className="text-[#211815]">{formatCents(standardFee)}</strong> ·{" "}
            <button
              type="button"
              className="min-h-10 underline"
              onClick={() => {
                setFeeMessage(null);
                setEditingFee(true);
              }}
            >
              cambia
            </button>
          </p>
        )}
        {!editingFee && feeMessage ? <Notice tone={feeMessage.tone}>{feeMessage.text}</Notice> : null}
      </div>

      {/* La funzione più frequente compare prima dell'importazione massiva. */}
      <AddRegistration workshopId={workshop.id} standardFeeCents={standardFee} today={today} lastMethod={lastMethod} />

      <TextImport workshopId={workshop.id} operatorId={operatorId} standardFeeCents={standardFee} registrations={registrations} today={today} />

      {registrations.length > 0 ? (
        <div className="space-y-2">
          <Field label="Cerca un nome">
            <input
              type="search"
              className={inputClass}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="es. cla"
              autoComplete="off"
            />
          </Field>
          {owing > 0 || onlyOwing ? (
            <Chip active={onlyOwing} onClick={() => setOnlyOwing(!onlyOwing)}>
              Devono ancora pagare · {owing}
            </Chip>
          ) : null}
        </div>
      ) : null}

      {registrations.length === 0 ? (
        <p className="text-sm text-[#5f524c]">Ancora nessuna iscrizione.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[#5f524c]">{query.trim() ? `Nessun nome trovato con «${query.trim()}».` : "Nessuno deve ancora pagare."}</p>
      ) : (
        <ul className="space-y-4">
          {visible.flatMap((registration, index) => {
            const open = openId === registration.bookingId;
            const row = (
              <li
                key={registration.bookingId}
                ref={open ? expandedCardRef : undefined}
                className={`scroll-mt-24 rounded-2xl border-2 bg-white shadow-[0_3px_14px_rgba(33,24,21,0.08)] ${open
                  ? "border-[#a8583e]/55 shadow-[0_5px_18px_rgba(168,88,62,0.14)]"
                  : "border-[#211815]/15"}`}
              >
                <div className={`flex items-start rounded-t-2xl ${open ? "bg-[#fcf5ee]" : "bg-white"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(open ? null : registration.bookingId);
                      setPaymentStart(null);
                    }}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-start justify-between gap-3 p-3 pr-1 text-left"
                  >
                    <span className="min-w-0 space-y-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="block w-full break-words font-serif text-[22px] font-semibold leading-tight text-[#211815]">
                          {registration.people.map((person, index) => {
                            const label = registrationPersonLabel(person);
                            return <span key={person.participantId}>
                              {index > 0 ? " + " : null}{label.name}
                              {label.alias ? <span className="ml-1 font-sans text-xs font-normal text-[#5f524c]">({label.alias})</span> : null}
                            </span>;
                          })}
                        </span>
                        <span className="block w-full text-xs font-medium">
                          {registration.people.map(person => {
                            const label = registrationPersonLabel(person);
                            return <span key={person.participantId} className={label.linked ? "mr-2 text-[#326941]" : "mr-2 text-[#9b5928]"}>
                              {label.linked ? "Anagrafica abbinata" : person.matchStatus==="automatico" ? "Abbinamento da confermare" : "Da abbinare"}
                            </span>;
                          })}
                          {registration.people.some(person => !registrationPersonLabel(person).email) ?
                            <span className="text-[#9b2c2c]">· Email mancante</span> : null}
                        </span>
                        <StatusTag status={registration.status} />
                        {lastSaved?.id === registration.bookingId ? (
                          <span role="status" className="text-xs font-semibold text-[#2f5d3b]">
                            {lastSaved.message === "Nessuna modifica." ? "Nessuna modifica" : "Salvato"}
                          </span>
                        ) : null}
                        {registration.feeCustom ? <span className="text-xs font-semibold text-[#a8583e]">prezzo speciale</span> : null}
                      </span>
                      <span className="block text-sm text-[#5f524c]">{feeSummary(paidCents(registration.payments), registration.agreedFeeCents)}</span>
                      {/* 4g (#6): solo quando non l'ha inserita lei. */}
                      {registration.createdByRole === "organizzatrice" ? null : (
                        <span className="block text-xs text-[#5f524c]">{insertedByLabel(registration.createdByRole)}</span>
                      )}
                      {alreadyEnrolledHint(registration) ? (
                        <span className="block text-xs font-semibold text-[#7a5212]">{alreadyEnrolledHint(registration)}</span>
                      ) : null}
                    </span>
                    <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-[#5f524c] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <div className="flex items-center gap-1 py-2 pl-1">
                    <button
                      type="button"
                      className={buttonClass.small}
                      onClick={() => {
                        setOpenId(registration.bookingId);
                        setPaymentStart((current) => ({ id: registration.bookingId, n: (current?.n ?? 0) + 1 }));
                      }}
                    >
                      + Pagamento
                    </button>
                    <RowMenu
                      label="Altre azioni sull'iscrizione"
                      items={[
                        {
                          label: "Elimina iscrizione",
                          danger: true,
                          onClick: () => {
                            setDeletingId(registration.bookingId);
                            setDeleted({ id: registration.bookingId, afterId: index > 0 ? visible[index - 1].bookingId : null });
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
                {showPresence && canMarkPresent(registration.status) ? (
                  <div className="border-t border-[#211815]/5 px-3">
                    <PresentToggle booking={registration} name={registrationTitle(registration)} />
                  </div>
                ) : null}
                {deletingId === registration.bookingId ? (
                  <div className="px-3 pb-3">
                    <DeleteBookingConfirm
                      booking={registration}
                      name={registrationTitle(registration)}
                      onClose={() => setDeletingId(null)}
                      undoScope={`booking:${registration.bookingId}`}
                    />
                  </div>
                ) : null}
                {open ? (
                  <RegistrationDetails
                    key={paymentStart?.id === registration.bookingId ? `p${paymentStart.n}` : "row"}
                    registration={registration}
                    today={today}
                    lastMethod={lastMethod}
                    startPayment={paymentStart?.id === registration.bookingId}
                    onSaved={(message) => closeAfterSave(registration.bookingId, message)}
                  />
                ) : null}
                {open ? (
                  <div className="flex justify-end rounded-b-[14px] border-t border-[#a8583e]/20 bg-[#f7f3ec] px-3 pb-3 pt-1.5">
                    <button type="button" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#a8583e] underline-offset-2 hover:underline"
                      onClick={() => { setOpenId(null); setPaymentStart(null); }}>
                      Chiudi scheda <ChevronDown className="h-4 w-4 rotate-180" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
            // 4g (#18): "Eliminato · Annulla" al posto della riga eliminata.
            const slot = (key: string) =>
              deleted ? (
                <li key={key} className="list-none">
                  <UndoSlot scope={`booking:${deleted.id}`} />
                </li>
              ) : null;
            const gone = deleted !== null && !registrations.some((r) => r.bookingId === deleted.id);
            return [
              ...(gone && deleted.afterId === null && index === 0 ? [slot("undo-top")] : []),
              row,
              ...(deleted && (deleted.id === registration.bookingId || (gone && deleted.afterId === registration.bookingId)) ? [slot("undo")] : []),
            ];
          })}
        </ul>
      )}

      <PaymentTotalsBox bookings={registrations} />
    </div>
  );
}
