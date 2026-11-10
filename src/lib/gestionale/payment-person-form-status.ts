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
  person:{first_name:string|null;last_name:string|null;email:string|null},
  evidence:readonly FormEvidenceForCandidate[],
):PersonFormStatus{
  const identity={firstName:person.first_name,lastName:person.last_name,email:person.email};
  const candidateEmail=normalizeMembershipEmail(person.email);
  const relevant=evidence.filter(row=>row.source==="google_sheet" ||
    (row.source==="manual_form"&&row.membership_status==="verified"));
  const matching=relevant.filter(row=>formIdentityCompatible(identity,row));
  const sharedEmailConflict=relevant.some(row=>Boolean(candidateEmail&&
    normalizeMembershipEmail(row.email)===candidateEmail &&
    !formIdentityCompatible(identity,row)));
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
