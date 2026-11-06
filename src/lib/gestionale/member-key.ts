// Chiave di un socio come lo vede la pagina admin (D11, migrazione 016), pura.
//   "m:<uuid>"         validazione manuale (riga manual_override della tabella)
//   "e:<email>"        socio del libro soci o del modulo, per email normalizzata
//   "n:<nome cognome>" socio del libro soci senza email, per nome (chiave admin)

import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";

import type { Person } from "./types";
import { isUuidLike } from "./validation";

export type MemberKey =
  | { kind: "manual"; id: string }
  | { kind: "email"; email: string }
  | { kind: "name"; nameKey: string };

export function parseMemberKey(value: unknown): MemberKey | null {
  if (typeof value !== "string" || value.length > 300) return null;
  const rest = value.slice(2);
  if (value.startsWith("m:")) return isUuidLike(rest) ? { kind: "manual", id: rest } : null;
  if (value.startsWith("e:")) {
    const email = normalizeMembershipEmail(rest);
    return email.includes("@") && email === rest ? { kind: "email", email } : null;
  }
  if (value.startsWith("n:")) {
    const nameKey = normalizeMembershipNameKey(rest, null);
    return nameKey && nameKey === rest ? { kind: "name", nameKey } : null;
  }
  return null;
}

/** Chiave di una riga delle fonti admin (null se la riga non ha né email né nome e cognome). */
export function memberKeyOfRow(row: {
  tableId: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}): string | null {
  if (row.tableId) return `m:${row.tableId}`;
  const email = normalizeMembershipEmail(row.email);
  if (email.includes("@")) return `e:${email}`;
  const nameKey = normalizeMembershipNameKey(row.first_name, row.last_name);
  return nameKey ? `n:${nameKey}` : null;
}

/** Socio collegato esplicitamente alla persona ("Cerca nel libro soci"), se c'è. */
export function memberKeyOfPerson(person: Pick<Person, "association_member_id" | "membership_email">): string | null {
  if (person.association_member_id) return `m:${person.association_member_id}`;
  const email = normalizeMembershipEmail(person.membership_email);
  return email.includes("@") ? `e:${email}` : null;
}
