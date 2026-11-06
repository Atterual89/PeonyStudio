// "Collega le corrispondenze esatte (N)" (Fase 4e, #10), puro: per le persone
// non collegate al libro soci, il socio che corrisponde in modo esatto e unico.

import { normalizeText } from "./format";
import type { MemberSummary, Person } from "./types";

type PersonLike = Pick<Person, "first_name" | "last_name" | "email">;
type MemberLike = Pick<MemberSummary, "first_name" | "last_name" | "email">;

const fullNameOf = (first: string | null, last: string | null) => normalizeText([first, last].filter(Boolean).join(" "));

/**
 * Esatta: stessa email, oppure stesso nome e cognome (la persona li ha
 * entrambi) e nessuna email diversa tra le due.
 */
export function isExactMemberMatch(person: PersonLike, member: MemberLike): boolean {
  const personEmail = normalizeText(person.email);
  const memberEmail = normalizeText(member.email);
  if (personEmail && memberEmail) return personEmail === memberEmail;
  if (!person.first_name?.trim() || !person.last_name?.trim()) return false;
  return fullNameOf(person.first_name, person.last_name) === fullNameOf(member.first_name, member.last_name);
}

export type ExactMatch = {
  personId: string;
  version: number;
  personName: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
};

/**
 * Solo corrispondenze esatte e uniche: una persona con un solo socio esatto,
 * e un socio proposto per una sola persona.
 */
export function uniqueExactMatches(
  candidates: readonly { person: PersonLike & Pick<Person, "id" | "version">; personName: string; members: readonly MemberSummary[] }[],
): ExactMatch[] {
  const proposals = candidates.flatMap(({ person, personName, members }) => {
    const exact = [...new Map(members.filter((member) => isExactMemberMatch(person, member)).map((m) => [m.id, m])).values()];
    if (exact.length !== 1) return [];
    const [member] = exact;
    return [
      {
        personId: person.id,
        version: person.version,
        personName,
        memberId: member.id,
        memberName: [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email || "Socio",
        memberEmail: member.email,
      },
    ];
  });
  const perMember = new Map<string, number>();
  for (const proposal of proposals) perMember.set(proposal.memberId, (perMember.get(proposal.memberId) ?? 0) + 1);
  return proposals.filter((proposal) => perMember.get(proposal.memberId) === 1);
}

// ---------------------------------------------------------------------------
// Fase 5: collegamento in blocco (/gestione/altro/soci)
// ---------------------------------------------------------------------------

/** Socio non ancora collegato, con tutte le email e le chiavi di nome delle sue righe (già normalizzate). */
export type MemberCandidate = {
  key: string;
  name: string;
  email: string | null;
  emails: readonly string[];
  nameKeys: readonly string[];
};

export type LinkPerson = {
  id: string;
  version: number;
  name: string;
  email: string | null;
  /** Email normalizzata come la pagina admin (normalizeMembershipEmail). */
  emailKey: string;
  /** Nome e cognome come la pagina admin (normalizeMembershipNameKey), "" se meno di due parole. */
  nameKey: string;
};

export type LinkProposal = {
  personId: string;
  version: number;
  personName: string;
  personEmail: string | null;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  /** email: proposta preselezionata; nome: da confermare esplicitamente. */
  by: "email" | "nome";
  /** Solo per "nome": la persona ha un'email diversa da quella del socio. */
  differentEmail: boolean;
};

/**
 * Proposte di collegamento per le persone non collegate: prima per email
 * (normalizzata), poi per nome e cognome. Solo corrispondenze uniche: un solo
 * socio per persona e un socio proposto per una sola persona; il resto va in
 * `none` (nessuna corrispondenza o più soci possibili).
 */
export function memberLinkProposals(
  people: readonly LinkPerson[],
  members: readonly MemberCandidate[],
): { proposals: LinkProposal[]; none: LinkPerson[] } {
  const byEmail = new Map<string, MemberCandidate[]>();
  const byName = new Map<string, MemberCandidate[]>();
  for (const member of members) {
    for (const email of new Set(member.emails)) if (email.includes("@")) byEmail.set(email, [...(byEmail.get(email) ?? []), member]);
    for (const nameKey of new Set(member.nameKeys)) if (nameKey) byName.set(nameKey, [...(byName.get(nameKey) ?? []), member]);
  }

  const proposals: LinkProposal[] = [];
  const none: LinkPerson[] = [];
  for (const person of people) {
    const emailHits = person.emailKey.includes("@") ? (byEmail.get(person.emailKey) ?? []) : [];
    const nameHits = emailHits.length === 0 && person.nameKey ? (byName.get(person.nameKey) ?? []) : [];
    const hits = emailHits.length > 0 ? emailHits : nameHits;
    if (hits.length !== 1) {
      none.push(person);
      continue;
    }
    const [member] = hits;
    const by = emailHits.length > 0 ? "email" : "nome";
    proposals.push({
      personId: person.id,
      version: person.version,
      personName: person.name,
      personEmail: person.email,
      memberId: member.key,
      memberName: member.name,
      memberEmail: member.email,
      by,
      differentEmail: by === "nome" && person.emailKey.includes("@") && member.emails.some((email) => email.includes("@")) && !member.emails.includes(person.emailKey),
    });
  }

  const perMember = new Map<string, number>();
  for (const proposal of proposals) perMember.set(proposal.memberId, (perMember.get(proposal.memberId) ?? 0) + 1);
  const unique = proposals.filter((proposal) => perMember.get(proposal.memberId) === 1);
  const dropped = new Set(proposals.filter((proposal) => perMember.get(proposal.memberId) !== 1).map((proposal) => proposal.personId));
  return {
    proposals: unique,
    none: [...none, ...people.filter((person) => dropped.has(person.id))],
  };
}
