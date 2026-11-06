// Logica pura del tab Partecipanti (D15): elenco per prenotazione, riepilogo
// soci per persona.

import { contactGroupOf, inContactScope } from "./contacts";
import { normalizeText } from "./format";
import { isConfirmed } from "./labels";
import type { BookingPersonView, BookingView } from "./types";

export type BookingFilter =
  | "confermati"
  | "interessati"
  | "lista_attesa"
  | "cancellati"
  | "quota_mancante"
  | "non_soci"
  | "non_collegati"
  | "da_contattare"
  | "richiesta_inviata"
  | "da_verificare";

export const BOOKING_FILTERS: { key: BookingFilter; label: string }[] = [
  { key: "confermati", label: "Confermati" },
  { key: "interessati", label: "Interessati" },
  { key: "lista_attesa", label: "Lista d'attesa" },
  { key: "cancellati", label: "Cancellati" },
  { key: "quota_mancante", label: "Quota non registrata" },
  { key: "non_soci", label: "Non in regola" },
  // 017: prenotazioni (di qualunque stato) con almeno una persona non collegata al libro soci.
  { key: "non_collegati", label: "Non collegate" },
  // 4d + D26: richieste di associazione (collegate e non in regola, per
  // persona); le non collegate a parte, senza richieste.
  { key: "da_contattare", label: "Da contattare" },
  { key: "richiesta_inviata", label: "Richiesta inviata" },
  { key: "da_verificare", label: "Da verificare nel libro soci" },
];

/**
 * "Confermati" = prenotato + acconto + saldato. "Quota non registrata" e "Non
 * in regola" (D11, stato della pagina admin) riguardano le prenotazioni
 * confermate con almeno una persona in quello stato.
 */
export function matchesBookingFilter(
  booking: BookingView,
  filter: BookingFilter,
  { includeInterested = false }: { includeInterested?: boolean } = {},
): boolean {
  switch (filter) {
    case "confermati":
      return isConfirmed(booking.status);
    case "interessati":
      return booking.status === "interessato";
    case "lista_attesa":
      return booking.status === "lista_attesa";
    case "cancellati":
      return booking.status === "cancellato";
    case "quota_mancante":
      return isConfirmed(booking.status) && booking.people.some((p) => p.membership.kind === "quota_mancante");
    case "non_soci":
      return isConfirmed(booking.status) && booking.people.some((p) => p.membership.kind !== "in_regola");
    case "non_collegati":
      return booking.people.some((p) => p.membership.kind === "non_collegata");
    case "da_contattare":
    case "richiesta_inviata":
    case "da_verificare":
      return inContactScope(booking.status, includeInterested) && booking.people.some((p) => contactGroupOf(p) === filter);
  }
}

/**
 * Nome di una persona nel tab Partecipanti (admin): "Nome Cognome" se c'è
 * (scheda o libro soci collegato), altrimenti il nome visualizzato; accanto,
 * piccolo, il nickname o il testo scritto da Ale se diverso.
 */
export function personNames(entry: Pick<BookingPersonView, "fullName" | "displayName" | "enteredAs" | "person">): {
  main: string;
  alias: string | null;
} {
  const main = entry.fullName ?? entry.displayName;
  const alias = [entry.person.nickname, entry.enteredAs, entry.displayName]
    .map((value) => value?.trim())
    .find((value) => value && normalizeText(value) !== normalizeText(main));
  return { main, alias: entry.fullName ? (alias ?? null) : null };
}

/** "Claudia Rossi + Francesco Bianchi", con il principale per primo. */
export function bookingTitle(booking: BookingView): string {
  return [...booking.people]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((p) => personNames(p).main)
    .join(" + ");
}

/** Riepilogo soci PER PERSONA sulle prenotazioni confermate (la verifica è individuale). */
export function membershipSummary(bookings: readonly BookingView[]) {
  const people = bookings.filter((b) => isConfirmed(b.status)).flatMap((b) => b.people);
  return {
    persone: people.length,
    soci: people.filter((p) => p.membership.kind === "in_regola").length,
    quotaMancante: people.filter((p) => p.membership.kind === "quota_mancante").length,
    nonSoci: people.filter((p) => p.membership.kind === "modulo_mancante").length,
    nonCollegati: people.filter((p) => p.membership.kind === "non_collegata").length,
    emailMancanti: people.filter((p) => !p.person.email).length,
  };
}

const MEMBERSHIP_RANK = { non_collegata: 0, modulo_mancante: 0, quota_mancante: 1, in_regola: 2 };

/** Per l'ordinamento: lo stato socio "peggiore" tra le persone della prenotazione. */
export function worstMembershipRank(booking: BookingView): number {
  return Math.min(...booking.people.map((p) => MEMBERSHIP_RANK[p.membership.kind]), 2);
}
