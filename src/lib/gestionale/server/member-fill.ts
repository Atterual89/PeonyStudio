import "server-only";

import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { memberFill, type MemberFill } from "@/lib/gestionale/member-name";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { getLinkedMemberSummary } from "@/lib/gestionale/server/membership";
import type { Person } from "@/lib/gestionale/types";

/**
 * Persone collegate al libro soci con campi vuoti che il socio può riempire
 * (pagina Persone, "Completa i dati dal libro soci"). SOLA LETTURA: le
 * scritture le fanno solo i pulsanti (p/actions.ts).
 */
export async function listCompletablePeople(): Promise<{ person: Person; fill: MemberFill }[]> {
  await requireAdmin();
  const candidates = (await loadPeople()).filter(
    (person) => !person.merged_into && memberKeyOfPerson(person) && (!person.first_name || !person.last_name || !person.email),
  );
  const result: { person: Person; fill: MemberFill }[] = [];
  for (const person of candidates) {
    const fill = memberFill(person, await getLinkedMemberSummary(person));
    if (Object.keys(fill).length > 0) result.push({ person, fill });
  }
  return result;
}
