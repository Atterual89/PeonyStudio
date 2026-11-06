"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";

import { parseEuroToCents } from "@/lib/gestionale/format";
import { EMAIL_PATTERN } from "@/lib/gestionale/parse-roster";
import { requireOrganizer } from "@/lib/gestionale/server/auth";
import { explainConflict } from "@/lib/gestionale/server/conflicts";
import { getWorkshopView } from "@/lib/gestionale/server/data";
import { paidCents, statusJustified } from "@/lib/gestionale/payments";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import {
  addPayment,
  correctPayment,
  createRegistration,
  importRoster,
  previewEnteredMatches,
  refundBooking,
  setBookingFee,
  setEnteredEmail,
  updateRegistration,
  updateWorkshopSettings,
  type EnteredEntry,
  type ImportRowInput,
} from "@/lib/gestionale/server/mutations";
import { toPayment, type PaymentRecord } from "@/lib/gestionale/server/registrations";
import type { ActionResult, BookingStatus, InvoiceStatus } from "@/lib/gestionale/types";
import {
  asText,
  isBookingStatus,
  isInvoiceStatus,
  isIsoDate,
  isParty,
  isPaymentMethod,
  isPaymentType,
  isUuidLike,
  isVersion,
} from "@/lib/gestionale/validation";

// Tab Iscrizioni (D18–D21): azioni SOLO dell'organizzatrice (requireOrganizer:
// agli admin rispondono 404). Nessuna restituisce dati di persone: solo esito.

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };
const MAX_CENTS = 100_000_000;
/** 4g (#20): il campo da correggere, con un esempio. */
const FEE_ERROR = "Prezzo: scrivi un numero, es. 450 o 450,50.";

/** "200" o "200,50" → centesimi; null se vuoto; undefined se non valido. */
function readCents(value: unknown, { allowEmpty }: { allowEmpty: boolean }): number | null | undefined {
  const text = asText(value, 20).trim();
  if (!text) return allowEmpty ? null : undefined;
  const cents = parseEuroToCents(text);
  return cents === null || cents > MAX_CENTS ? undefined : cents;
}

// ---------------------------------------------------------------------------
// Quota del workshop (D19)
// ---------------------------------------------------------------------------

/**
 * Quota del workshop (e, dal tab Info, le note). Capienza e percentuali
 * restano quelle salvate: l'organizzatrice non le modifica (D18). Le
 * prenotazioni non dedicate seguono subito la nuova quota (D19, 015):
 * `unsettled` = quante non sono più saldate, per l'avviso.
 */
export async function updateWorkshopFeeAction(input: {
  workshopId: string;
  version: number;
  fee: string;
  description?: string;
}): Promise<ActionResult<{ unsettled: number }>> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.workshopId) || !isVersion(input.version)) return INVALID;
  const fee = readCents(input.fee, { allowEmpty: false });
  if (fee === undefined || fee === null) return { ok: false, error: FEE_ERROR };

  const workshop = await getWorkshopView(input.workshopId);
  if (!workshop) return INVALID;

  const saved = await updateWorkshopSettings(operator.id, workshop.id, input.version, {
    description: input.description === undefined ? workshop.description : asText(input.description).trim() || null,
    capacity: workshop.capacity,
    default_fee_cents: fee,
    peony_pct: workshop.peony_pct,
  });
  const result = await explainConflict(saved, workshop.id, operator.id, "il prezzo del workshop");
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { unsettled: result.data.unsettled } };
}

/** Matita: tariffa dedicata; fee null = "Ripristina quota del workshop". */
export async function setBookingFeeAction(input: {
  bookingId: string;
  version: number;
  fee: string | null;
}): Promise<ActionResult> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.bookingId) || !isVersion(input.version)) return INVALID;
  let fee: number | null = null;
  if (input.fee !== null) {
    const cents = readCents(input.fee, { allowEmpty: false });
    if (cents === undefined || cents === null) return { ok: false, error: FEE_ERROR };
    fee = cents;
  }
  const result = await explainConflict(
    await setBookingFee(operator.id, input.bookingId, input.version, fee),
    input.bookingId,
    operator.id,
    "questa iscrizione",
  );
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Iscrizioni (D20)
// ---------------------------------------------------------------------------

/**
 * fee null = quota del workshop; un importo (dalla matita) = tariffa dedicata.
 * Acconto pagato / Saldato: il primo pagamento è obbligatorio e si salva
 * nella stessa transazione (gw_create_registration).
 */
export async function addRegistrationAction(input: {
  workshopId: string;
  person: string;
  partner: string;
  /** 4d (B2): email facoltative scritte da Ale. */
  personEmail?: string;
  partnerEmail?: string;
  status: string;
  fee: string | null;
  notes: string;
  payment?: PaymentFields | null;
}): Promise<ActionResult> {
  const operator = await requireOrganizer();
  const person = asText(input?.person, 200).trim();
  const partner = asText(input?.partner, 200).trim();
  const fee = input?.fee === null ? null : readCents(input?.fee, { allowEmpty: false });
  if (!isUuidLike(input?.workshopId) || !isBookingStatus(input.status) || fee === undefined) return INVALID;
  if (!person) return { ok: false, error: "Nome: scrivi il nome, il nickname o l'email." };
  const personEmail = readEnteredEmail(input.personEmail);
  const partnerEmail = readEnteredEmail(input.partnerEmail);
  if (personEmail === undefined || partnerEmail === undefined) return { ok: false, error: "Email: controlla l'indirizzo (es. nome@esempio.it)." };

  const needsPayment = input.status === "acconto" || input.status === "saldato";
  let payment = null;
  if (input.payment) {
    const parsed = readPayment(input.payment);
    if (!parsed) return INVALID;
    if ("error" in parsed) return { ok: false, error: parsed.error! };
    payment = parsed;
  } else if (needsPayment) {
    return { ok: false, error: "Acconto pagato o Saldato: registra il primo pagamento." };
  }

  const result = await createRegistration(operator.id, {
    workshopId: input.workshopId,
    entries: [entry(person, personEmail), ...(partner ? [entry(partner, partnerEmail)] : [])],
    status: input.status,
    feeCents: fee,
    notes: asText(input.notes).trim() || null,
    payment,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** Riga aperta: stato, fattura e note (ognuno si salva da solo). La quota va con la matita. */
export async function updateRegistrationAction(input: {
  bookingId: string;
  version: number;
  status: string;
  notes: string;
  invoiceStatus: string;
}): Promise<ActionResult> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.bookingId) || !isVersion(input.version) || !isBookingStatus(input.status) || !isInvoiceStatus(input.invoiceStatus)) {
    return INVALID;
  }

  const result = await explainConflict(
    await updateRegistration(operator.id, {
      bookingId: input.bookingId,
      version: input.version,
      status: input.status,
      notes: asText(input.notes).trim() || null,
      invoiceStatus: input.invoiceStatus,
    }),
    input.bookingId,
    operator.id,
    "questa iscrizione",
  );
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pagamenti (D21)
// ---------------------------------------------------------------------------

type PaymentFields = {
  amount: string;
  paymentType: string;
  method: string | null;
  paidOn: string;
  receivedBy: string;
  description: string;
};

/** Data facoltativa (026): null se vuota, undefined se non valida. */
function readPaidOn(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return isIsoDate(value) ? (value as string) : undefined;
}

function readPayment(input: PaymentFields | undefined) {
  const amount = readCents(input?.amount, { allowEmpty: false });
  if (amount === undefined || amount === null || amount <= 0) return { error: "Importo: scrivi un numero, es. 250." };
  if (!input || !isPaymentType(input.paymentType) || !isParty(input.receivedBy)) return null;
  if (input.method !== null && !isPaymentMethod(input.method)) return null;
  // 026: la data è facoltativa (vuota = data non indicata).
  const paidOn = readPaidOn(input.paidOn);
  if (paidOn === undefined) return null;
  return {
    amount_cents: amount,
    payment_type: input.paymentType,
    method: input.method,
    paid_on: paidOn,
    received_by: input.receivedBy,
    description: asText(input.description, 500).trim() || null,
  };
}

/**
 * Dopo un pagamento aperto dal menu dello stato (Acconto pagato / Saldato):
 * di solito lo stato automatico (D21) è già quello; se la prenotazione era in
 * lista d'attesa o cancellata (che non cambiano da sole) e ora il pagato lo
 * giustifica, si salva lo stato scelto.
 */
async function applyTargetStatus(operatorId: string, bookingId: string, target: "acconto" | "saldato") {
  const { data } = await getGestionaleDb()
    .from("gw_bookings")
    .select(
      "version, status, notes, invoice_status, agreed_fee_cents, gw_payments(id, kind, amount_cents, payment_type, paid_on, method, received_by, description, corrects_payment_id, created_at)",
    )
    .eq("id", bookingId)
    .is("deleted_at", null)
    .is("gw_payments.deleted_at", null)
    .maybeSingle();
  if (!data) return;
  const row = data as unknown as {
    version: number;
    status: BookingStatus;
    notes: string | null;
    invoice_status: InvoiceStatus;
    agreed_fee_cents: number | string | null;
    gw_payments: PaymentRecord[];
  };
  if (row.status !== "lista_attesa" && row.status !== "cancellato") return;
  const fee = row.agreed_fee_cents === null ? null : Number(row.agreed_fee_cents);
  if (!statusJustified(target, paidCents(row.gw_payments.map(toPayment)), fee)) return;
  await updateRegistration(operatorId, {
    bookingId,
    version: row.version,
    status: target,
    notes: row.notes,
    invoiceStatus: row.invoice_status,
  });
}

export async function addPaymentAction(input: {
  bookingId: string;
  kind: string;
  payment: PaymentFields;
  /** Stato scelto nel menu che ha aperto il modulo (facoltativo). */
  targetStatus?: string;
}): Promise<ActionResult> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.bookingId) || (input.kind !== "pagamento" && input.kind !== "rimborso")) return INVALID;
  const target = input.targetStatus;
  if (target !== undefined && target !== "acconto" && target !== "saldato") return INVALID;
  const payment = readPayment(input.payment);
  if (!payment) return INVALID;
  if ("error" in payment) return { ok: false, error: payment.error! };

  const result = await addPayment(operator.id, input.bookingId, { kind: input.kind, ...payment });
  if (!result.ok) return result;
  if (target && input.kind === "pagamento") await applyTargetStatus(operator.id, input.bookingId, target);
  refreshGestione();
  return { ok: true };
}

/**
 * 4e (#2): "Registra rimborso di X €" su un'iscrizione cancellata. X è il
 * pagato netto visto da Ale (il database lo ricontrolla); senza `receivedBy`
 * un rimborso per ogni parte che ha incassato.
 */
export async function refundBookingAction(input: {
  bookingId: string;
  expectedCents: number;
  method: string | null;
  paidOn: string;
  receivedBy: string | null;
}): Promise<ActionResult<{ count: number }>> {
  const operator = await requireOrganizer();
  const paidOn = readPaidOn(input?.paidOn);
  if (
    !isUuidLike(input?.bookingId) ||
    !Number.isInteger(input.expectedCents) ||
    input.expectedCents <= 0 ||
    input.expectedCents > MAX_CENTS ||
    paidOn === undefined ||
    (input.method !== null && !isPaymentMethod(input.method)) ||
    (input.receivedBy !== null && !isParty(input.receivedBy))
  ) {
    return INVALID;
  }
  const result = await refundBooking(operator.id, {
    bookingId: input.bookingId,
    expectedCents: input.expectedCents,
    method: input.method,
    paidOn,
    receivedBy: input.receivedBy,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { count: result.data } };
}

/** Movimento com'è ora: importo al netto delle rettifiche collegate. null se non esiste. */
async function currentMovement(paymentId: string) {
  const { data, error } = await getGestionaleDb()
    .from("gw_payments")
    .select("id, kind, amount_cents, payment_type, paid_on, method, received_by, description, corrects_payment_id")
    .or(`id.eq.${paymentId},corrects_payment_id.eq.${paymentId}`)
    .is("deleted_at", null);
  if (error) return null;
  const rows = (data ?? []) as (Omit<PaymentRecord, "created_at"> & { corrects_payment_id: string | null })[];
  const original = rows.find((row) => row.id === paymentId);
  if (!original) return null;
  return { ...original, net: rows.reduce((sum, row) => sum + Number(row.amount_cents), 0) };
}

/**
 * "Modifica": annulla il movimento (rettifica) e registra quello giusto,
 * nella stessa transazione; senza `replacement` lo annulla soltanto. Se
 * niente è cambiato non si salva niente (`changed: false`).
 */
export async function correctPaymentAction(input: {
  paymentId: string;
  replacement: PaymentFields | null;
  description: string;
}): Promise<ActionResult<{ changed: boolean }>> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.paymentId)) return INVALID;

  let replacement = null;
  if (input.replacement) {
    const parsed = readPayment(input.replacement);
    if (!parsed) return INVALID;
    if ("error" in parsed) return { ok: false, error: parsed.error! };
    replacement = parsed;

    const current = await currentMovement(input.paymentId);
    if (!current) return INVALID;
    const unchanged =
      replacement.amount_cents === Math.abs(current.net) &&
      (current.kind === "rimborso" || replacement.payment_type === current.payment_type) &&
      replacement.method === current.method &&
      replacement.paid_on === current.paid_on &&
      replacement.received_by === current.received_by &&
      (replacement.description ?? null) === (current.description?.trim() || null);
    if (unchanged) return { ok: true, data: { changed: false } };
  }

  const result = await correctPayment(
    operator.id,
    input.paymentId,
    replacement,
    asText(input.description, 500).trim() || (replacement ? "Modifica" : "Stornato"),
  );
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { changed: true } };
}

// ---------------------------------------------------------------------------
// Box di testo (sezione 6)
// ---------------------------------------------------------------------------

/** Email facoltativa: null se vuota, undefined se non valida. */
function readEnteredEmail(value: unknown): string | null | undefined {
  const email = asText(value, 200).trim().toLowerCase();
  if (!email) return null;
  return EMAIL_PATTERN.test(email) ? email : undefined;
}

function entry(text: string, email: string | null): EnteredEntry {
  return email ? { text, email } : text;
}

/** Persona di una riga importata: testo, oppure { text, email }. */
function readImportPerson(value: unknown): EnteredEntry | null {
  if (typeof value === "string") return asText(value, 200).trim() || null;
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const text = asText(record.text, 200).trim();
  const email = readEnteredEmail(record.email);
  if (!text || email === undefined) return null;
  return entry(text, email);
}

function readImportRow(value: unknown): ImportRowInput | null {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const existing = row.booking_id === null || row.booking_id === undefined ? null : row.booking_id;
  if (existing !== null && (!isUuidLike(existing) || !isVersion(row.booking_version))) return null;

  const people = Array.isArray(row.people) ? row.people.map(readImportPerson) : [];
  if (people.some((person) => person === null)) return null;
  if (existing === null && (people.length < 1 || people.length > 2)) return null;
  if (!isBookingStatus(row.status) || !isInvoiceStatus(row.invoice_status)) return null;
  if (existing === null && (row.status === "acconto" || row.status === "saldato") && !(Array.isArray(row.payments) && row.payments.length > 0)) {
    return null;
  }

  const forced = row.forced_status ?? null;
  if (forced !== null && (existing !== null || (forced !== "interessato" && forced !== "prenotato"))) return null;

  const fee = row.fee_cents;
  if (fee !== null && (typeof fee !== "number" || !Number.isInteger(fee) || fee < 0 || fee > MAX_CENTS)) return null;

  const payments = Array.isArray(row.payments) ? row.payments : [];
  const parsedPayments: ImportRowInput["payments"] = [];
  for (const payment of payments) {
    const p = (payment ?? {}) as Record<string, unknown>;
    if (typeof p.amount_cents !== "number" || !Number.isInteger(p.amount_cents) || p.amount_cents <= 0 || p.amount_cents > MAX_CENTS) {
      return null;
    }
    if (!isPaymentType(p.payment_type) || (p.method !== null && !isPaymentMethod(p.method))) return null;
    const paidOn = readPaidOn(p.paid_on);
    if (paidOn === undefined) return null;
    // Anteprima a moduli (025): "Incassato da" di ogni pagamento, altrimenti quello comune.
    const receivedBy = p.received_by === undefined || p.received_by === null ? null : p.received_by;
    if (receivedBy !== null && !isParty(receivedBy)) return null;
    parsedPayments.push({
      amount_cents: p.amount_cents,
      method: p.method,
      payment_type: p.payment_type,
      paid_on: paidOn,
      ...(receivedBy ? { received_by: receivedBy } : {}),
      description: asText(p.description, 500).trim() || null,
    });
  }

  // 4e (#9): "Salva l'email" sulle righe già presenti.
  const savedEmail = existing === null ? null : readEnteredEmail(row.entered_email);
  if (savedEmail === undefined) return null;

  return {
    booking_id: existing,
    booking_version: existing ? (row.booking_version as number) : null,
    entered_email: savedEmail,
    people: people as EnteredEntry[],
    status: row.status,
    forced_status: forced,
    fee_cents: fee,
    invoice_status: row.invoice_status,
    notes: asText(row.notes, 2000).trim() || null,
    payments: parsedPayments,
  };
}

export async function importRosterAction(input: {
  workshopId: string;
  /** Data comune facoltativa (026): vuota = i pagamenti senza la loro restano senza data. */
  paidOn: string;
  receivedBy: string;
  rows: unknown[];
}): Promise<ActionResult<{ created: number; updated: number; payments: number }>> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.workshopId) || !isParty(input.receivedBy) || !Array.isArray(input.rows)) return INVALID;
  if (input.rows.length === 0 || input.rows.length > 200) return { ok: false, error: "Nessuna riga da salvare." };

  const rows = input.rows.map(readImportRow);
  if (rows.some((row) => row === null)) return INVALID;
  const paidOn = readPaidOn(input.paidOn);
  if (paidOn === undefined) return INVALID;

  const result = await importRoster(operator.id, {
    workshopId: input.workshopId,
    paidOn,
    receivedBy: input.receivedBy,
    rows: rows as ImportRowInput[],
  });
  if (!result.ok) return result;
  refreshGestione();
  return result;
}

/**
 * 4e (#5/#28): "Sembra già iscritta come «X»" nell'anteprima. Per ogni nome
 * (testo e, se c'è, email) l'iscrizione di questo workshop a cui il server lo
 * abbinerebbe: SOLO l'id e il testo che Ale stessa aveva scritto.
 */
export async function previewMatchesAction(input: {
  workshopId: string;
  entries: unknown[];
}): Promise<ActionResult<({ bookingId: string; enteredAs: string } | null)[]>> {
  await requireOrganizer();
  if (!isUuidLike(input?.workshopId) || !Array.isArray(input.entries) || input.entries.length > 400) return INVALID;
  const entries = input.entries.map(readImportPerson);
  if (entries.some((entry) => entry === null)) return INVALID;
  const result = await previewEnteredMatches(input.workshopId, entries as EnteredEntry[]);
  if (!result.ok) return result;
  return {
    ok: true,
    data: (result.data ?? []).map((match) => (match && match.entered_as ? { bookingId: match.booking_id, enteredAs: match.entered_as } : null)),
  };
}

// ---------------------------------------------------------------------------
// Email scritta da Ale (4d, B2)
// ---------------------------------------------------------------------------

/**
 * "+ Email" accanto al nome (anche "Usare questa email?" dalle note): Ale
 * salva solo l'email che scrive lei. Sul server: se la persona collegata non
 * ha email la prende; se ne ha una diversa non la tocca.
 */
export async function setEnteredEmailAction(input: { participantId: string; email: string }): Promise<ActionResult> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.participantId)) return INVALID;
  const email = readEnteredEmail(input.email);
  if (email === undefined) return { ok: false, error: "Email non valida." };
  const result = await setEnteredEmail(operator.id, input.participantId, email);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}
