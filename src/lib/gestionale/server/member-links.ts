import "server-only";

import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import { isVerifiedOfficialNameOnlyMatch, memberLinkProposals, type LinkPerson, type LinkProposal } from "@/lib/gestionale/exact-matches";
import { displayName, fullName } from "@/lib/gestionale/format";
import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { getMemberBadge, getMemberSummary, listUnlinkedMembers } from "@/lib/gestionale/server/membership";

// Fase 5: collegamento in blocco delle persone al libro soci
// (/gestione/altro/soci). Persone del gestionale senza collegamento esplicito
// (né validazione manuale né socio per email), non unite; proposte uniche per
// email (preselezionate) e per nome e cognome (da confermare). Sola lettura:
// il collegamento lo fa linkMemberProposalsAction, che le ricalcola.

export async function findMemberLinkProposals(): Promise<{ proposals: LinkProposal[]; none: LinkPerson[]; alreadyVerified: number }> {
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
  const allPersonNames=people.filter(person=>!person.merged_into).map(person=>({
    id:person.id,
    nameKey:normalizeMembershipNameKey(person.first_name,person.last_name),
  }));
  // Le quote già verificate nel libro ufficiale non richiedono una seconda
  // conferma solo per l'assenza dell'email nel registro Team Artist.
  // La verifica è per il periodo corrente (non estende le quote al 2027).
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const checks=await Promise.all(result.proposals.map(async (proposal)=>{
    if(proposal.by!=="nome" || proposal.personEmail || proposal.memberEmail ||
      !proposal.memberId.startsWith("n:")) return false;
    const [member,badge]=await Promise.all([
      getMemberSummary(proposal.memberId),
      getMemberBadge(proposal.memberId,today),
    ]);
    return isVerifiedOfficialNameOnlyMatch(proposal,allPersonNames,
      member?{source:member.source,badgeKind:badge.kind}:null);
  }));
  return {
    proposals:result.proposals.filter((_,index)=>!checks[index]),
    alreadyVerified:checks.filter(Boolean).length,
    none:[...result.none].sort((a,b)=>a.name.localeCompare(b.name,"it")),
  };
}
