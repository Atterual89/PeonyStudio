// Logica pura dell'anagrafica: ricerca, duplicati, validazione.

import { fullName, normalizeEmail, normalizeText } from "./format";
import type { Person, PersonFields } from "./types";

type SearchablePerson = Pick<
  Person,
  "id" | "first_name" | "last_name" | "nickname" | "email" | "instagram" | "merged_into"
>;

/** "Crea nuova: <testo>": una parola → nickname; più parole → nome + cognome. */
export function personFieldsFromFreeText(text: string): Pick<PersonFields, "nickname" | "first_name" | "last_name"> {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { nickname: words[0] ?? null, first_name: null, last_name: null };
  return { nickname: null, first_name: words[0], last_name: words.slice(1).join(" ") };
}

function haystack(person: SearchablePerson): string {
  return normalizeText(
    [person.nickname, person.first_name, person.last_name, person.email, person.instagram?.replace(/^@/, "")]
      .filter(Boolean)
      .join(" "),
  );
}

/** Ogni parola cercata deve comparire in uno dei campi (senza maiuscole e accenti). */
export function matchesPersonQuery(person: SearchablePerson, query: string): boolean {
  const tokens = normalizeText(query.replace(/^@/, "")).split(" ").filter(Boolean);
  if (tokens.length === 0) return false;
  const text = haystack(person);
  return tokens.every((token) => text.includes(token));
}

/** Persone non unite che corrispondono, con le corrispondenze "a inizio parola" per prime. */
export function searchPeople<T extends SearchablePerson>(people: readonly T[], query: string, limit = 20): T[] {
  const normalized = normalizeText(query.replace(/^@/, ""));
  if (normalized.length === 0) return [];

  const scored = people
    .filter((person) => !person.merged_into && matchesPersonQuery(person, query))
    .map((person) => {
      const words = haystack(person).split(" ");
      const prefix = words.some((word) => word.startsWith(normalized)) ? 0 : 1;
      return { person, prefix };
    });

  scored.sort((a, b) => a.prefix - b.prefix);
  return scored.slice(0, limit).map(({ person }) => person);
}

export type DuplicateReason = "nickname" | "nome_cognome" | "email";

export const DUPLICATE_REASON_LABELS: Record<DuplicateReason, string> = {
  nickname: "stesso nickname",
  nome_cognome: "stesso nome e cognome",
  email: "stessa email",
};

/** Possibili duplicati: nickname, nome+cognome o email uguali (normalizzati). */
export function findPossibleDuplicates<T extends SearchablePerson>(
  person: SearchablePerson,
  others: readonly T[],
): { person: T; reasons: DuplicateReason[] }[] {
  const nickname = normalizeText(person.nickname);
  const name = normalizeText(fullName(person));
  const hasFullName = Boolean(person.first_name && person.last_name);
  const email = normalizeEmail(person.email);

  const results: { person: T; reasons: DuplicateReason[] }[] = [];
  for (const other of others) {
    if (other.id === person.id || other.merged_into) continue;

    const reasons: DuplicateReason[] = [];
    if (nickname && normalizeText(other.nickname) === nickname) reasons.push("nickname");
    if (hasFullName && other.first_name && other.last_name && normalizeText(fullName(other)) === name) {
      reasons.push("nome_cognome");
    }
    if (email && normalizeEmail(other.email) === email) reasons.push("email");

    if (reasons.length > 0) results.push({ person: other, reasons });
  }
  return results;
}

/** Altre persone (non unite) con la stessa email: avviso non bloccante. */
export function peopleSharingEmail<T extends SearchablePerson>(
  person: Pick<Person, "id" | "email">,
  others: readonly T[],
): T[] {
  const email = normalizeEmail(person.email);
  if (!email) return [];
  return others.filter((other) => other.id !== person.id && !other.merged_into && normalizeEmail(other.email) === email);
}

export type PersonFormValues = Record<keyof PersonFields, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePersonForm(
  values: PersonFormValues,
): { ok: true; payload: PersonFields } | { ok: false; errors: Partial<Record<keyof PersonFields, string>> } {
  const errors: Partial<Record<keyof PersonFields, string>> = {};
  const clean = (value: string) => value.trim() || null;

  const payload: PersonFields = {
    first_name: clean(values.first_name),
    last_name: clean(values.last_name),
    nickname: clean(values.nickname),
    email: clean(values.email)?.toLowerCase() ?? null,
    instagram: clean(values.instagram),
    phone: clean(values.phone),
    teamartist_id: clean(values.teamartist_id),
    notes: clean(values.notes),
  };

  if (!payload.first_name && !payload.nickname) {
    errors.nickname = "Serve almeno il nome o il nickname.";
  }
  if (payload.email && !EMAIL.test(payload.email)) {
    errors.email = "Email non valida.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, payload };
}

export function personToFormValues(person: Partial<PersonFields>): PersonFormValues {
  return {
    nickname: person.nickname ?? "",
    first_name: person.first_name ?? "",
    last_name: person.last_name ?? "",
    email: person.email ?? "",
    instagram: person.instagram ?? "",
    phone: person.phone ?? "",
    teamartist_id: person.teamartist_id ?? "",
    notes: person.notes ?? "",
  };
}

export type MemberField = "first_name" | "last_name" | "email";

const MEMBER_FIELDS: MemberField[] = ["first_name", "last_name", "email"];

function sameValue(field: MemberField, a: string, b: string): boolean {
  return field === "email" ? normalizeEmail(a) === normalizeEmail(b) : a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Campi pieni della persona diversi dal libro soci (3b): si propone
 * "Nel libro soci: <valore> — usa questo". I campi vuoti li riempie il
 * database al collegamento (gw_fill_person_from_member).
 */
export function memberDifferences(
  values: Partial<Record<MemberField, string | null>>,
  member: Partial<Record<MemberField, string | null>>,
): { field: MemberField; value: string }[] {
  return MEMBER_FIELDS.flatMap((field) => {
    const mine = values[field]?.trim();
    const theirs = member[field]?.trim();
    if (!mine || !theirs || sameValue(field, mine, theirs)) return [];
    return [{ field, value: field === "email" ? normalizeEmail(theirs) : theirs }];
  });
}
