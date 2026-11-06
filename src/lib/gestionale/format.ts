// Formattazione e normalizzazione condivise (pure, usabili anche nel client).

import type { Person } from "./types";

/** Minuscole, senza accenti, spazi compressi. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

type NamedPerson = Pick<Person, "first_name" | "last_name" | "nickname">;

export function fullName(person: NamedPerson): string {
  return [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
}

/** Nome visualizzato: il nickname, altrimenti nome e cognome. */
export function displayName(person: NamedPerson): string {
  return person.nickname?.trim() || fullName(person) || "Senza nome";
}

/** "250", "250,50", "250.5", "€ 250" → centesimi. null se vuoto o non valido. */
export function parseEuroToCents(input: string | null | undefined): number | null {
  const cleaned = (input ?? "").replace(/[€\s]/g, "").replace(",", ".");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [euros, decimals = ""] = cleaned.split(".");
  return Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
}

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  // Raggruppamento manuale: identico su server e browser (niente differenze ICU).
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const rest = abs % 100;
  return `${negative ? "−" : ""}${euros}${rest ? `,${String(rest).padStart(2, "0")}` : ""} €`;
}

/** Valore per un campo importo del form ("250" o "250,50"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const rest = cents % 100;
  return rest ? `${Math.floor(cents / 100)},${String(rest).padStart(2, "0")}` : String(cents / 100);
}

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  return dateFormatter.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));
}

/** Data di un pagamento: facoltativa (026). */
export function formatPaymentDate(paidOn: string | null | undefined): string {
  return paidOn ? formatDate(paidOn) : "data non indicata";
}

export function formatDateRange(startsOn: string, endsOn: string | null): string {
  if (!endsOn || endsOn === startsOn) return formatDate(startsOn);
  return `${formatDate(startsOn)} – ${formatDate(endsOn)}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

/** Data e ora nel fuso Europe/Rome (data di generazione degli export). */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
