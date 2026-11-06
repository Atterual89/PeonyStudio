// Richieste di associazione e solleciti (Fase 4d, parte B), puro. Valgono per
// persona e periodo associativo (migrazione 023); qui solo etichette, gruppi
// del tab Partecipanti e la lista per il Ccn di Gmail.

import { isConfirmed } from "./labels";
import type { BookingPersonView, BookingStatus, BookingView, MembershipContact } from "./types";

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "2026-10-12" → "12 ott". */
export function formatDayMonth(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "Richiesta inviata il 12 ott" · "Sollecito 1 il 20 ott". */
export function contactLabel(contact: Pick<MembershipContact, "number" | "sentOn">): string {
  return contact.number === 0
    ? `Richiesta inviata il ${formatDayMonth(contact.sentOn)}`
    : `Sollecito ${contact.number} il ${formatDayMonth(contact.sentOn)}`;
}

/** Riga chiusa: "sollecito 2 · 25 ott". */
export function contactShortLabel(contact: Pick<MembershipContact, "number" | "sentOn">): string {
  return `${contact.number === 0 ? "richiesta" : `sollecito ${contact.number}`} · ${formatDayMonth(contact.sentOn)}`;
}

/** Ultimo contatto valido (numero più alto), o null. */
export function lastContact<T extends Pick<MembershipContact, "number">>(contacts: readonly T[]): T | null {
  return contacts.reduce<T | null>((last, contact) => (!last || contact.number > last.number ? contact : last), null);
}

/** Pulsante del passo successivo: stessa regola del database (massimo valido + 1). */
export function nextContactLabel(contacts: readonly Pick<MembershipContact, "number">[]): string {
  const last = lastContact(contacts);
  return last ? `Registra sollecito ${last.number + 1}` : "Registra richiesta inviata";
}

export type ContactGroup = "da_contattare" | "richiesta_inviata" | "da_verificare";

/** D26: solo questi gruppi hanno "Copia email" e "Registra come inviata"; le non collegate no. */
export function isRequestGroup(group: ContactGroup): group is "da_contattare" | "richiesta_inviata" {
  return group === "da_contattare" || group === "richiesta_inviata";
}

/**
 * Non in regola per il periodo del workshop (D26): collegata al libro soci →
 * da contattare (nessun contatto) o richiesta inviata (almeno uno); non
 * collegata → da verificare nel libro soci (forse è già socia).
 */
export function contactGroupOf(entry: Pick<BookingPersonView, "membership" | "contacts">): ContactGroup | null {
  if (entry.membership.kind === "in_regola") return null;
  if (entry.membership.kind === "non_collegata") return "da_verificare";
  return entry.contacts.length > 0 ? "richiesta_inviata" : "da_contattare";
}

/** D26: nei gruppi contano le iscrizioni confermate; con "includi interessati" anche gli interessati. */
export function inContactScope(status: BookingStatus, includeInterested = false): boolean {
  return isConfirmed(status) || (includeInterested && status === "interessato");
}

/**
 * Persone del gruppo nelle iscrizioni confermate (e, se indicato, interessate),
 * una volta sola anche se compaiono in più righe (come il riepilogo soci, per
 * persona).
 */
export function peopleInGroup(
  bookings: readonly BookingView[],
  group: ContactGroup,
  { includeInterested = false }: { includeInterested?: boolean } = {},
): BookingPersonView[] {
  const seen = new Map<string, BookingPersonView>();
  for (const booking of bookings) {
    if (!inContactScope(booking.status, includeInterested)) continue;
    for (const entry of booking.people) {
      if (contactGroupOf(entry) === group && !seen.has(entry.person.id)) seen.set(entry.person.id, entry);
    }
  }
  return [...seen.values()];
}

/**
 * Indirizzi per il Ccn di Gmail (separati da virgola, senza doppioni, ignorando
 * maiuscole), le persone che hanno un'email e quelle senza.
 */
export function bccList(people: readonly BookingPersonView[]): { text: string; withEmail: BookingPersonView[]; withoutEmail: BookingPersonView[] } {
  const emails = new Map<string, string>();
  const withEmail: BookingPersonView[] = [];
  const withoutEmail: BookingPersonView[] = [];
  for (const entry of people) {
    const email = entry.person.email?.trim();
    if (!email) {
      withoutEmail.push(entry);
      continue;
    }
    withEmail.push(entry);
    if (!emails.has(email.toLowerCase())) emails.set(email.toLowerCase(), email);
  }
  return { text: [...emails.values()].join(", "), withEmail, withoutEmail };
}
