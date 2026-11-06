// D27 (Fase 5): tab Email (solo admin), puro. Una riga per persona:
//   Confermati (Acconto pagato o Saldato) → selezionati;
//   Interessati e Prenotati a parola → in grigio, non selezionati;
//   lista d'attesa e cancellati → esclusi; persone unite → escluse.
// "Copia email (N)": indirizzi per il Ccn di Gmail separati da ", ", senza
// doppioni (ignorando maiuscole). Al browser arrivano solo nome, email e stato.

import { personNames } from "./bookings";
import type { BookingStatus, BookingView } from "./types";

export type EmailRow = {
  personId: string;
  name: string;
  alias: string | null;
  email: string | null;
  status: BookingStatus;
  /** Confermati: selezionati all'apertura. */
  confirmed: boolean;
};

const CONFIRMED: readonly BookingStatus[] = ["acconto", "saldato"];
const OTHERS: readonly BookingStatus[] = ["interessato", "prenotato"];

export function emailRows(bookings: readonly BookingView[]): EmailRow[] {
  const rows = new Map<string, EmailRow>();
  for (const booking of bookings) {
    const confirmed = CONFIRMED.includes(booking.status);
    if (!confirmed && !OTHERS.includes(booking.status)) continue;
    for (const entry of booking.people) {
      if (entry.person.merged_into || rows.has(entry.person.id)) continue;
      const names = personNames(entry);
      rows.set(entry.person.id, {
        personId: entry.person.id,
        name: names.main,
        alias: names.alias,
        email: entry.person.email?.trim() || null,
        status: booking.status,
        confirmed,
      });
    }
  }
  return [...rows.values()].sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || a.name.localeCompare(b.name, "it"));
}

/** Persone selezionate all'apertura: i confermati con l'email. */
export function defaultEmailSelection(rows: readonly EmailRow[]): Set<string> {
  return new Set(rows.filter((row) => row.confirmed && row.email).map((row) => row.personId));
}

/** Testo per il Ccn e quante email (senza doppioni, ignorando maiuscole). */
export function emailText(rows: readonly EmailRow[], selected: ReadonlySet<string>): { text: string; count: number } {
  const emails = new Map<string, string>();
  for (const row of rows) {
    if (!row.email || !selected.has(row.personId)) continue;
    if (!emails.has(row.email.toLowerCase())) emails.set(row.email.toLowerCase(), row.email);
  }
  return { text: [...emails.values()].join(", "), count: emails.size };
}
