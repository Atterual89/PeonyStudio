// Altri nomi delle persone e "+ Nuova persona" (Fase 4d, parte B2), puro.

import { displayName, normalizeText } from "./format";
import type { Person } from "./types";

export type PersonAlias = { id: string; personId: string; alias: string };

export type ExistingPerson = { id: string; name: string; reason: "nickname" | "altro nome" | "nome e cognome" | "email" };

/**
 * "Esiste già: X — apri": persone (non unite) con lo stesso nickname, altro
 * nome, nome + cognome o email della persona che si sta creando. Nickname e
 * altri nomi si confrontano tra loro in tutte le combinazioni.
 */
export function existingPeopleFor(
  input: { nickname: string; first_name: string; last_name: string; email: string; aliases: readonly string[] },
  people: readonly Person[],
  aliases: readonly PersonAlias[],
): ExistingPerson[] {
  const names = new Set([input.nickname, ...input.aliases].map(normalizeText).filter(Boolean));
  const fullName = input.first_name.trim() && input.last_name.trim() ? normalizeText(`${input.first_name} ${input.last_name}`) : "";
  const email = input.email.trim().toLowerCase();
  const aliasesOf = new Map<string, string[]>();
  for (const alias of aliases) aliasesOf.set(alias.personId, [...(aliasesOf.get(alias.personId) ?? []), normalizeText(alias.alias)]);

  const found: ExistingPerson[] = [];
  for (const person of people) {
    if (person.merged_into) continue;
    const reason: ExistingPerson["reason"] | null =
      person.nickname && names.has(normalizeText(person.nickname))
        ? "nickname"
        : (aliasesOf.get(person.id) ?? []).some((alias) => names.has(alias))
          ? "altro nome"
          : fullName && normalizeText([person.first_name, person.last_name].filter(Boolean).join(" ")) === fullName
            ? "nome e cognome"
            : email && person.email?.trim().toLowerCase() === email
              ? "email"
              : null;
    if (reason) found.push({ id: person.id, name: displayName(person), reason });
  }
  return found;
}

/** Testo scritto da Ale che corrisponde esattamente a un nickname o a un altro nome (stessa normalizzazione). */
export function sameEnteredText(enteredAs: string | null, text: string): boolean {
  const normalized = normalizeText(text);
  return Boolean(normalized) && normalizeText(enteredAs) === normalized;
}
