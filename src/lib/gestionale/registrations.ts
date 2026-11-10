// Logica pura del tab Iscrizioni dell'organizzatrice (D18, D20): solo testo
// scritto da Ale, mai dati anagrafici.

import { normalizeText } from "./format";
import { ADMIN_ENTRY_LABEL } from "./labels";
import type { Registration } from "./types";

type RegisteredPerson = Registration["people"][number];

/** Mostra il profilo confermato, senza nascondere il nickname usato da Ale. */
export function registrationPersonLabel(person: RegisteredPerson): {
  name: string; alias: string | null; linked: boolean;
  email: string | null; emailSource: "anagrafica" | "iscrizione" | null;
} {
  const profile = person.linkedProfile;
  const name = profile?.name?.trim() || person.enteredAs?.trim() || ADMIN_ENTRY_LABEL;
  const alias = profile
    ? [profile.nickname, person.enteredAs].map(value => value?.trim())
        .find(value => value && normalizeText(value) !== normalizeText(name)) ?? null
    : null;
  const email = profile?.email || person.enteredEmail || null;
  return { name, alias, linked: Boolean(profile), email,
    emailSource: profile?.email ? "anagrafica" : person.enteredEmail ? "iscrizione" : null };
}

/** Nome completo quando abbinato, altrimenti nome/nickname inserito da Ale. */
export function registrationTitle(registration: Pick<Registration, "people">): string {
  return registration.people.map(person => registrationPersonLabel(person).name).join(" + ") || ADMIN_ENTRY_LABEL;
}

/**
 * 4g (#7): "Cerca un nome" in cima all'elenco, filtro sul telefono sul testo
 * scritto da Ale (minuscole, senza accenti; ogni parola cercata deve esserci).
 */
export function matchesSearch(registration: Pick<Registration, "people">, query: string): boolean {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const text = normalizeText(registration.people.map((person) =>
    [person.enteredAs, person.enteredEmail, person.linkedProfile?.name,
      person.linkedProfile?.nickname, person.linkedProfile?.email].filter(Boolean).join(" ")).join(" "));
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
