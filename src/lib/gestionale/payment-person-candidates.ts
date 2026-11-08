import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";

export type PaymentPersonCandidate = {
  kind: "person" | "member";
  id: string;
  name: string;
  email: string | null;
  source: string;
};

function normalizedEmail(candidate:PaymentPersonCandidate) {
  const value=normalizeMembershipEmail(candidate.email);
  return value.includes("@")?value:"";
}
function normalizedName(candidate:PaymentPersonCandidate) {
  return normalizeMembershipNameKey(candidate.name,null);
}
/**
 * Result presentation only, no database linking or quota confirmation.
 * Collapse a book/form result into a single existing profile when email and
 * legal name uniquely agree, or when a single email-less official entry has a
 * unique name match without another conflicting email in the book results.
 * Ambiguous names and shared emails stay separate for human review.
 */
export function combinePaymentPersonCandidates(candidates:readonly PaymentPersonCandidate[]):PaymentPersonCandidate[] {
  const people=candidates.filter(candidate=>candidate.kind==="person");
  const members=candidates.filter(candidate=>candidate.kind==="member");
  const membersByPerson=new Map<string,PaymentPersonCandidate[]>();
  const unmatched:PaymentPersonCandidate[]=[];
  const peopleByEmail=new Map<string,PaymentPersonCandidate[]>();
  const peopleByName=new Map<string,PaymentPersonCandidate[]>();
  const membersByName=new Map<string,PaymentPersonCandidate[]>();

  for(const person of people){
    const email=normalizedEmail(person);
    const name=normalizedName(person);
    if(email)peopleByEmail.set(email,[...(peopleByEmail.get(email)??[]),person]);
    if(name)peopleByName.set(name,[...(peopleByName.get(name)??[]),person]);
  }
  for(const member of members){
    const name=normalizedName(member);
    if(name)membersByName.set(name,[...(membersByName.get(name)??[]),member]);
  }
  for(const member of members){
    const email=normalizedEmail(member);
    const name=normalizedName(member);
    let matches:PaymentPersonCandidate[]=[];
    if(email){
      matches=(peopleByEmail.get(email)??[]).filter(person=>
        Boolean(name&&normalizedName(person)===name)
      );
    }else if(name){
      // Name-only book rows are never enough if another member with that
      // name has a conflicting email, or the name matches multiple profiles.
      const sameNameMembers=membersByName.get(name)??[];
      const sameNamePeople=peopleByName.get(name)??[];
      if(sameNameMembers.filter(item=>!normalizedEmail(item)).length===1 &&
        sameNamePeople.length===1 &&
        sameNameMembers.every(item=>!normalizedEmail(item)||
          normalizedEmail(item)===normalizedEmail(sameNamePeople[0]))){
        matches=sameNamePeople;
      }
    }
    const profile=matches.length===1?matches[0]:null;
    const profileEmail=profile?normalizedEmail(profile):"";
    // Shared email across multiple profiles is not a safe identity match.
    if(profile && (!profileEmail || (peopleByEmail.get(profileEmail)??[]).length===1)){
      membersByPerson.set(profile.id,[...(membersByPerson.get(profile.id)??[]),member]);
    }else unmatched.push(member);
  }

  const merged=people.map(person=>{
    const linked=membersByPerson.get(person.id)??[];
    if(!linked.length)return person;
    const provenance=linked.some(row=>row.source.toLowerCase().includes("libro"))
      ?"Anagrafica + libro soci / modulo"
      :"Anagrafica + modulo";
    return {...person,source:provenance};
  });

  return [...merged,...unmatched];
}
