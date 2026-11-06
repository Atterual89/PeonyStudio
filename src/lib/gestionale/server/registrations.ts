import "server-only";

import { requireOperator } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { comparePayments, lastUsedMethod, type FeeRow } from "@/lib/gestionale/payments";
import type { BookingStatus, InvoiceStatus, OperatorRole, Payment, PaymentMethod, Registration } from "@/lib/gestionale/types";
import { isUuidLike } from "@/lib/gestionale/validation";

// Letture per l'organizzatrice (D18, tab Iscrizioni). Si selezionano SOLO il
// testo scritto da Ale (entered_as) e i dati economici: MAI colonne di
// gw_people né del libro soci. Un test controlla le chiavi restituite. Le
// righe eliminate (D22) non si leggono.

const PAYMENT_COLUMNS = "id, kind, amount_cents, payment_type, paid_on, method, received_by, description, corrects_payment_id, created_at";

const REGISTRATION_COLUMNS = [
  "id, version, status, present, notes, invoice_status, agreed_fee_cents, fee_custom, created_at",
  // Solo il ruolo di chi l'ha creata ("Inserito da Peony/Ale"), mai il nome.
  "gw_operators!gw_bookings_created_by_fkey(role)",
  "gw_booking_participants(id, is_primary, entered_as, entered_email, removed_at)",
  `gw_payments(${PAYMENT_COLUMNS})`,
].join(", ");

export type PaymentRecord = {
  id: string;
  kind: Payment["kind"];
  amount_cents: number | string;
  payment_type: Payment["paymentType"];
  paid_on: string | null;
  method: Payment["method"];
  received_by: Payment["receivedBy"];
  description: string | null;
  corrects_payment_id: string | null;
  created_at: string;
};

export function toPayment(row: PaymentRecord): Payment {
  return {
    id: row.id,
    kind: row.kind,
    amountCents: Number(row.amount_cents),
    paymentType: row.payment_type,
    paidOn: row.paid_on,
    method: row.method,
    receivedBy: row.received_by,
    description: row.description,
    correctsPaymentId: row.corrects_payment_id,
    createdAt: row.created_at,
  };
}

export function sortPayments(payments: Payment[]): Payment[] {
  return payments.sort(comparePayments);
}

type RegistrationRecord = {
  id: string;
  version: number;
  status: BookingStatus;
  present: boolean;
  notes: string | null;
  invoice_status: InvoiceStatus;
  agreed_fee_cents: number | string | null;
  fee_custom: boolean;
  created_at: string;
  gw_operators?: { role: OperatorRole } | { role: OperatorRole }[] | null;
  gw_booking_participants: { id: string; is_primary: boolean; entered_as: string | null; entered_email: string | null; removed_at: string | null }[];
  gw_payments: PaymentRecord[];
};

type DuplicateRecord = {
  id: string;
  booking_id: string;
  person_id: string;
  possible_duplicate_person_id: string | null;
  entered_as: string | null;
};

/**
 * 4e (#28): "Sembra già iscritta come «X»". Per ogni persona che il server ha
 * abbinato a qualcuno già iscritto (possible_duplicate_person_id), il testo
 * che Ale aveva scritto per quella iscrizione. Gli id restano sul server: al
 * browser arriva solo il testo di Ale.
 */
async function alreadyEnrolledAs(workshopId: string): Promise<Map<string, string>> {
  const { data, error } = await getGestionaleDb()
    .from("gw_booking_participants")
    .select("id, booking_id, person_id, possible_duplicate_person_id, entered_as")
    .eq("workshop_id", workshopId)
    .is("removed_at", null)
    .is("deleted_at", null);
  if (error) throw new Error(`Gestionale (iscrizioni): ${error.message}`);
  const rows = (data ?? []) as DuplicateRecord[];
  const hints = new Map<string, string>();
  for (const row of rows) {
    if (!row.possible_duplicate_person_id) continue;
    const other = rows.find((r) => r.person_id === row.possible_duplicate_person_id && r.booking_id !== row.booking_id && r.entered_as);
    if (other?.entered_as) hints.set(row.id, other.entered_as);
  }
  return hints;
}

/**
 * 4g (#10): metodo dell'ultimo pagamento registrato da questo operatore (in
 * qualsiasi workshop), proposto nel modulo del pagamento. Solo il metodo.
 */
export async function getLastPaymentMethod(operatorId: string): Promise<PaymentMethod | null> {
  await requireOperator();
  if (!isUuidLike(operatorId)) return null;
  const { data, error } = await getGestionaleDb()
    .from("gw_payments")
    .select("kind, method, created_by, created_at")
    .eq("created_by", operatorId)
    .eq("kind", "pagamento")
    .not("method", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  const rows = (data ?? []) as { kind: Payment["kind"]; method: PaymentMethod | null; created_by: string | null; created_at: string }[];
  return lastUsedMethod(
    rows.map((row) => ({ kind: row.kind, method: row.method, createdBy: row.created_by, createdAt: row.created_at })),
    operatorId,
  );
}

/**
 * 4g (#40): per la conferma prima di cambiare il prezzo del workshop (tab
 * Iscrizioni e Info, entrambi i ruoli): stato, prezzo, prezzo speciale e
 * pagato di ogni iscrizione. Nessun dato di persone.
 */
export async function getFeeRows(workshopId: string): Promise<FeeRow[]> {
  await requireOperator();
  if (!isUuidLike(workshopId)) return [];
  const { data, error } = await getGestionaleDb()
    .from("gw_bookings")
    .select("status, agreed_fee_cents, fee_custom, gw_payments(amount_cents)")
    .eq("workshop_id", workshopId)
    .is("deleted_at", null)
    .is("gw_payments.deleted_at", null);
  if (error) throw new Error(`Gestionale (prezzi): ${error.message}`);
  type Row = { status: BookingStatus; agreed_fee_cents: number | string | null; fee_custom: boolean; gw_payments: { amount_cents: number | string }[] };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    status: row.status,
    agreedFeeCents: row.agreed_fee_cents === null ? null : Number(row.agreed_fee_cents),
    feeCustom: row.fee_custom,
    paidCents: row.gw_payments.reduce((sum, payment) => sum + Number(payment.amount_cents), 0),
  }));
}

/** Prenotazioni del workshop come le vede Ale: testo scritto da lei, quote e pagamenti. */
export async function getRegistrations(workshopId: string): Promise<Registration[]> {
  await requireOperator();
  if (!isUuidLike(workshopId)) return [];

  const [{ data, error }, hints] = await Promise.all([
    getGestionaleDb()
      .from("gw_bookings")
      .select(REGISTRATION_COLUMNS)
      .eq("workshop_id", workshopId)
      .is("deleted_at", null)
      .is("gw_booking_participants.deleted_at", null)
      .is("gw_payments.deleted_at", null)
      .order("created_at", { ascending: true }),
    alreadyEnrolledAs(workshopId),
  ]);
  if (error) throw new Error(`Gestionale (iscrizioni): ${error.message}`);

  return ((data ?? []) as unknown as RegistrationRecord[]).map((row) => ({
    bookingId: row.id,
    version: row.version,
    status: row.status,
    present: row.present,
    notes: row.notes,
    invoiceStatus: row.invoice_status,
    agreedFeeCents: row.agreed_fee_cents === null ? null : Number(row.agreed_fee_cents),
    feeCustom: row.fee_custom,
    createdAt: row.created_at,
    createdByRole: (Array.isArray(row.gw_operators) ? row.gw_operators[0] : row.gw_operators)?.role ?? null,
    people: row.gw_booking_participants
      .filter((p) => !p.removed_at)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((p) => ({
        participantId: p.id,
        isPrimary: p.is_primary,
        enteredAs: p.entered_as,
        enteredEmail: p.entered_email ?? null,
        alreadyAs: hints.get(p.id) ?? null,
      })),
    payments: sortPayments(row.gw_payments.map(toPayment)),
  }));
}
