// D27 (Fase 5): presenze, puro. Una spunta "Presente" per iscrizione (una
// coppia = 1, come si contano le iscrizioni, D15), solo sulle iscrizioni
// confermate. La spunta e "Presenti X / Y" compaiono dal giorno di inizio del
// workshop.

import { isConfirmed } from "./labels";
import type { BookingStatus } from "./types";

/** Dal giorno di inizio (date ISO, ora di Roma). */
export function showPresence(workshopStartsOn: string, today: string): boolean {
  return today >= workshopStartsOn;
}

/** La spunta si può mettere su questa iscrizione. */
export function canMarkPresent(status: BookingStatus): boolean {
  return isConfirmed(status);
}

/** "Presenti X / Y": X iscrizioni confermate con la spunta, Y iscrizioni confermate. */
export function presentCount(bookings: readonly { status: BookingStatus; present: boolean }[]): { present: number; total: number } {
  const confirmed = bookings.filter((booking) => canMarkPresent(booking.status));
  return { present: confirmed.filter((booking) => booking.present).length, total: confirmed.length };
}
