import type { MembershipEvidenceRow } from "@/lib/association/membership-state";

/** Il collegamento esplicito prevale sul testo/nickname del biglietto.
 * Non crea soci o conferme: identifica soltanto quali prove gia' presenti
 * consultare per il partecipante.
 */
export type PeonyIdentity = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};
export type PeonyLinkedPerson = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_email?: string | null;
  membership_name_key?: string | null;
  association_member_id?: string | null;
};
type MemberRow = Pick<MembershipEvidenceRow, "first_name" | "last_name" | "email"> & { id: string };

export function identityForLinkedPeonyAttendee(
  evidence: readonly MemberRow[],
  person: PeonyLinkedPerson | null | undefined,
  memberRowId: string | null | undefined,
  fallback: PeonyIdentity,
): PeonyIdentity {
  // Abbinamento esplicito a una riga del modulo/libro/quote.
  if (memberRowId) {
    const row = evidence.find(item => item.id === memberRowId);
    if (row) return { email: row.email, firstName: row.first_name, lastName: row.last_name };
  }
  if (!person) return fallback;

  // Una validazione manuale già collegata identifica il nome anagrafico,
  // senza attestare un modulo Google inesistente.
  if (person.association_member_id) {
    const row = evidence.find(item => item.id === person.association_member_id);
    if (row) return { email: row.email, firstName: row.first_name, lastName: row.last_name };
  }

  // Se il nome salvato nel biglietto è un nickname, usa la chiave ufficiale
  // confermata nella scheda, mai il nickname per verificare l'associazione.
  if (person.membership_name_key) {
    return { email: person.membership_email ?? null, firstName: person.membership_name_key, lastName: null };
  }
  return {
    email: person.membership_email ?? person.email,
    firstName: person.first_name,
    lastName: person.last_name,
  };
}
