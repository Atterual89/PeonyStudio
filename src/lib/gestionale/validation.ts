// Validazione degli input delle server action (arrivano dal browser).

import type {
  BookingStatus,
  ExpenseCategory,
  InvoiceStatus,
  Party,
  PaymentMethod,
  PaymentType,
  SettlementStatus,
  TransferStatus,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidLike(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

const STATUSES: readonly BookingStatus[] = ["interessato", "prenotato", "acconto", "saldato", "lista_attesa", "cancellato"];

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function asText(value: unknown, max = 5000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function oneOf<T extends string>(values: readonly T[]) {
  return (value: unknown): value is T => typeof value === "string" && (values as readonly string[]).includes(value);
}

export const isPaymentType = oneOf<PaymentType>(["acconto", "saldo", "altro"]);
export const isPaymentMethod = oneOf<PaymentMethod>(["contanti", "paypal", "bonifico", "altro"]);
export const isInvoiceStatus = oneOf<InvoiceStatus>(["non_richiesta", "richiesta", "emessa"]);
export const isParty = oneOf<Party>(["peony", "redsabbath"]);
export const isExpenseCategory = oneOf<ExpenseCategory>(["viaggi", "vitto", "alloggio", "sala", "materiali", "altro"]);
export const isTransferStatus = oneOf<TransferStatus>(["da_eseguire", "eseguito"]);
export const isSettlementStatus = oneOf<SettlementStatus>(["provvisorio", "verificato"]);

/** Data YYYY-MM-DD valida. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
