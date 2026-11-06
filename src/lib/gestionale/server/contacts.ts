import "server-only";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import type { MembershipContact } from "@/lib/gestionale/types";

// Richieste di associazione (4d, migrazione 023). D18: solo admin
// (requireAdmin); i loader dell'organizzatrice non le leggono mai.

type ContactRecord = {
  id: string;
  person_id: string;
  period_key: string;
  kind: MembershipContact["kind"];
  number: number;
  sent_on: string;
  note: string | null;
};

const COLUMNS = "id, person_id, period_key, kind, number, sent_on, note";

function toContact(row: ContactRecord): MembershipContact {
  return { id: row.id, periodKey: row.period_key, kind: row.kind, number: row.number, sentOn: row.sent_on, note: row.note };
}

/** Contatti validi del periodo per ogni persona, dal più vecchio (numero crescente). */
export async function getMembershipContacts(personIds: readonly string[], periodKey: string): Promise<Map<string, MembershipContact[]>> {
  await requireAdmin();
  const byPerson = new Map<string, MembershipContact[]>();
  if (personIds.length === 0) return byPerson;
  const { data, error } = await getGestionaleDb()
    .from("gw_membership_contacts")
    .select(COLUMNS)
    .in("person_id", [...new Set(personIds)])
    .eq("period_key", periodKey)
    .is("deleted_at", null)
    .order("number", { ascending: true });
  if (error) throw new Error(`Gestionale (richieste di associazione): ${error.message}`);
  for (const row of (data ?? []) as ContactRecord[]) {
    byPerson.set(row.person_id, [...(byPerson.get(row.person_id) ?? []), toContact(row)]);
  }
  return byPerson;
}

/** Scheda persona: tutti i contatti validi, di ogni periodo (il più recente per primo). */
export async function getPersonContacts(personId: string): Promise<MembershipContact[]> {
  await requireAdmin();
  const { data, error } = await getGestionaleDb()
    .from("gw_membership_contacts")
    .select(COLUMNS)
    .eq("person_id", personId)
    .is("deleted_at", null)
    .order("period_key", { ascending: false })
    .order("number", { ascending: true });
  if (error) throw new Error(`Gestionale (richieste di associazione): ${error.message}`);
  return ((data ?? []) as ContactRecord[]).map(toContact);
}
