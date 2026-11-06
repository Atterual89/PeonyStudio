// Nome e cognome del socio collegato (D11) e completamento della scheda
// persona dal libro soci. Logica pura: i dati arrivano dalle fonti admin
// (server/membership.ts), le scritture solo dai pulsanti
// (gw_fill_person_fields, campi vuoti, con storico).

import { normalizeMembershipNameKey } from "@/lib/association/membership-state";

import type { MemberSummary, Person } from "./types";

type NameRow = { first_name: string | null; last_name: string | null; source?: string | null };

/**
 * Ordine del campo unico nome del modulo (Google Sheet): "cognome_nome" se
 * l'intestazione nomina prima il cognome ("Cognome e nome"), "nome_cognome"
 * se prima il nome; null se non lo dice (es. solo "Name").
 */
export type SingleNameOrder = "cognome_nome" | "nome_cognome" | null;

export function singleNameOrder(header: string | null | undefined): SingleNameOrder {
  const words = ` ${(header ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const surname = Math.min(...[" cognome ", " surname "].map((w) => words.indexOf(w)).filter((i) => i >= 0), Infinity);
  const name = Math.min(...[" nome ", " name "].map((w) => words.indexOf(w)).filter((i) => i >= 0), Infinity);
  if (surname === Infinity || name === Infinity) return null;
  return surname < name ? "cognome_nome" : "nome_cognome";
}

const clean = (value: string | null | undefined) => value?.trim().replace(/\s+/g, " ") || null;

export type MemberName = { firstName: string | null; lastName: string | null; split: boolean };

/**
 * Nome e cognome separati del socio:
 * 1. la prima riga del socio (dalla più autorevole) con nome e cognome separati;
 * 2. altrimenti (campo unico, es. modulo) un'unica riga delle altre fonti con
 *    le stesse parole in nome e cognome separati;
 * 3. altrimenti, con due sole parole e l'ordine noto dall'intestazione, si separano;
 * 4. altrimenti resta un campo unico (split = false): non si indovina.
 */
export function resolveMemberName(
  sameMember: readonly NameRow[],
  allRows: readonly NameRow[],
  order: SingleNameOrder = null,
): MemberName {
  const separate = sameMember.find((row) => clean(row.first_name) && clean(row.last_name));
  if (separate) return { firstName: clean(separate.first_name), lastName: clean(separate.last_name), split: true };

  const single = sameMember.map((row) => clean(row.first_name) ?? clean(row.last_name)).find(Boolean) ?? null;
  if (!single) return { firstName: null, lastName: null, split: false };

  const key = normalizeMembershipNameKey(single, null);
  if (key) {
    const candidates = new Map<string, MemberName>();
    for (const row of allRows) {
      const first = clean(row.first_name);
      const last = clean(row.last_name);
      if (!first || !last || normalizeMembershipNameKey(first, last) !== key) continue;
      candidates.set(`${first.toLowerCase()}|${last.toLowerCase()}`, { firstName: first, lastName: last, split: true });
    }
    if (candidates.size === 1) return [...candidates.values()][0];
  }

  const words = single.split(" ");
  if (words.length === 2 && order) {
    return order === "cognome_nome"
      ? { firstName: words[1], lastName: words[0], split: true }
      : { firstName: words[0], lastName: words[1], split: true };
  }
  return { firstName: single, lastName: null, split: false };
}

export type MemberFill = Partial<Record<"first_name" | "last_name" | "email", string>>;

/** Campi VUOTI della persona che il socio collegato può riempire (nome e cognome solo se separati). */
export function memberFill(
  person: Pick<Person, "first_name" | "last_name" | "email">,
  member: Pick<MemberSummary, "first_name" | "last_name" | "email" | "name_split"> | null,
): MemberFill {
  if (!member) return {};
  const fill: MemberFill = {};
  if (member.name_split) {
    if (!clean(person.first_name) && clean(member.first_name)) fill.first_name = clean(member.first_name)!;
    if (!clean(person.last_name) && clean(member.last_name)) fill.last_name = clean(member.last_name)!;
  }
  if (!clean(person.email) && clean(member.email)) fill.email = member.email!.trim().toLowerCase();
  return fill;
}

/** "Rami Olmo" in un campo unico: va completato a mano. */
export function unsplitMemberName(
  person: Pick<Person, "first_name" | "last_name">,
  member: Pick<MemberSummary, "first_name" | "name_split"> | null,
): string | null {
  if (!member || member.name_split || !clean(member.first_name)) return null;
  return !clean(person.first_name) || !clean(person.last_name) ? clean(member.first_name) : null;
}

/** "Collegata a <Nome> <Cognome>". */
export function memberFullName(member: Pick<MemberSummary, "first_name" | "last_name">): string {
  return [clean(member.first_name), clean(member.last_name)].filter(Boolean).join(" ") || "socio senza nome";
}
