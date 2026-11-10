import { formIdentityCompatible } from "@/lib/association/form-identity";
import { normalizeMembershipEmail } from "@/lib/association/membership-state";

export type FormEvidenceForCandidate={
  first_name:string|null;last_name:string|null;email:string|null;
  source:string|null;membership_status?:string|null;
};
export type PersonFormStatus="google"|"paper"|"conflict"|"missing";

/** Un modulo appartiene alla PERSONA (non al pagamento o all'evento).
 * Stessa email da sola non basta: può appartenere ad altro nominativo.
 */
export function formStatusForPerson(
  person:{first_name:string|null;last_name:string|null;email:string|null;membership_email?:string|null},
  evidence:readonly FormEvidenceForCandidate[],
):PersonFormStatus{
  const candidateEmails=[...new Set([person.email,person.membership_email]
    .map(normalizeMembershipEmail).filter(value=>value.includes("@")))];
  const identities=candidateEmails.map(email=>({
    firstName:person.first_name,lastName:person.last_name,email,
  }));
  if(!identities.length)identities.push({
    firstName:person.first_name,lastName:person.last_name,email:null as string|null,
  });
  const relevant=evidence.filter(row=>row.source==="google_sheet" ||
    (row.source==="manual_form"&&row.membership_status==="verified"));
  const compatible=(row:FormEvidenceForCandidate)=>
    identities.some(identity=>formIdentityCompatible(identity,row));
  const matching=relevant.filter(compatible);
  const sharedEmailConflict=relevant.some(row=>Boolean(
    candidateEmails.includes(normalizeMembershipEmail(row.email)) && !compatible(row)));
  if(sharedEmailConflict)return "conflict";
  if(matching.some(row=>row.source==="google_sheet"))return "google";
  if(matching.some(row=>row.source==="manual_form"))return "paper";
  return "missing";
}

export function formStatusLabel(status:PersonFormStatus):string {
  switch(status){
    case "google":return "Modulo Google presente";
    case "paper":return "Modulo cartaceo confermato";
    case "conflict":return "Modulo con email condivisa: verificare identità";
    default:return "Modulo da verificare";
  }
}
