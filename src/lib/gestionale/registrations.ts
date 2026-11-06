// Logica pura del tab Iscrizioni dell'organizzatrice (D18, D20): solo testo
// scritto da Ale, mai dati anagrafici.

import { normalizeText } from "./format";
import { ADMIN_ENTRY_LABEL } from "./labels";
import type { Registration } from "./types";

/** "Claudia + Francesco" come li ha scritti Ale, principale per primo. */
export function registrationTitle(registration: Pick<Registration, "people">): string {
  const names = registration.people.map((person) => person.enteredAs);
  if (names.every((name) => !name)) return ADMIN_ENTRY_LABEL;
  return names.map((name) => name ?? ADMIN_ENTRY_LABEL).join(" + ");
}

/**
 * 4g (#7): "Cerca un nome" in cima all'elenco, filtro sul telefono sul testo
 * scritto da Ale (minuscole, senza accenti; ogni parola cercata deve esserci).
 */
export function matchesSearch(registration: Pick<Registration, "people">, query: string): boolean {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeText(registration.people.map((person) => `${person.enteredAs ?? ""} ${person.enteredEmail ?? ""}`).join(" "));
  return words.every((word) => text.includes(word));
}

/** "Sembra già iscritta come «X»" (4e, #28 e #5): solo il testo che Ale stessa aveva scritto. */
export function alreadyEnrolledText(enteredAs: string): string {
  return `Sembra già iscritta come «${enteredAs}»`;
}

/** Riga di Ale: il server ha abbinato una persona a un'altra iscrizione di questo workshop. */
export function alreadyEnrolledHint(registration: Pick<Registration, "people">): string | null {
  const hit = registration.people.find((person) => person.alreadyAs);
  return hit?.alreadyAs ? `${alreadyEnrolledText(hit.alreadyAs)}: possibile doppione.` : null;
}
