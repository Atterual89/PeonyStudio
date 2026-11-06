import "server-only";

import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import { memberLinkProposals, type LinkPerson, type LinkProposal } from "@/lib/gestionale/exact-matches";
import { displayName, fullName } from "@/lib/gestionale/format";
import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { listUnlinkedMembers } from "@/lib/gestionale/server/membership";

// Fase 5: collegamento in blocco delle persone al libro soci
// (/gestione/altro/soci). Persone del gestionale senza collegamento esplicito
// (né validazione manuale né socio per email), non unite; proposte uniche per
// email (preselezionate) e per nome e cognome (da confermare). Sola lettura:
// il collegamento lo fa linkMemberProposalsAction, che le ricalcola.

export async function findMemberLinkProposals(): Promise<{ proposals: LinkProposal[]; none: LinkPerson[] }> {
  await requireAdmin();
  const [people, members] = await Promise.all([loadPeople(), listUnlinkedMembers()]);
  const candidates: LinkPerson[] = people
    .filter((person) => !person.merged_into && !memberKeyOfPerson(person))
    .map((person) => ({
      id: person.id,
      version: person.version,
      name: fullName(person) || displayName(person),
      email: person.email,
      emailKey: normalizeMembershipEmail(person.email),
      nameKey: normalizeMembershipNameKey(person.first_name, person.last_name),
    }));
  const result = memberLinkProposals(candidates, members);
  return { ...result, none: [...result.none].sort((a, b) => a.name.localeCompare(b.name, "it")) };
}
