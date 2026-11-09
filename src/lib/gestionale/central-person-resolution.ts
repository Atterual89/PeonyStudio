import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";

/** Profilo di una sola persona, non un record del modulo o del biglietto. */
export type CentralPerson = {
  id:string;
  first_name:string|null;last_name:string|null;nickname:string|null;email:string|null;
  association_member_id?:string|null;membership_email?:string|null;membership_name_key?:string|null;
};
export type MemberProof={id:string;first_name:string|null;last_name:string|null;email:string|null};
export type ResolvedPerson={personId:string;reason:"explicit"|"confirmed_member"|"ticket_identity"};

const sameEmail=(a:string|null|undefined,b:string|null|undefined)=>{
  const first=normalizeMembershipEmail(a),second=normalizeMembershipEmail(b);
  return Boolean(first&&second&&first===second);
};
const normalizedName=(first:string|null|undefined,last:string|null|undefined)=>
  normalizeMembershipNameKey(first,last);
const normalizedAlias=(value:string|null|undefined)=>(value??"").trim().toLocaleLowerCase("it")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ");

/** Non utilizza email di pagamento condivise, nomi simili o nickname non verificati
 * come prova sufficiente per unire due anagrafiche.
 *
 * Riferimento esplicito -> identità associativa già confermata -> nome+email TT.
 * Con collegamento esplicito a una fonte soci, non usiamo l'email del compratore
 * come fallback: potrebbe aver comprato per qualcun altro.
 */
export function resolveCentralPerson(input:{
  people:readonly CentralPerson[];
  explicitPersonId?:string|null;
  memberRowId?:string|null;
  memberEvidence:readonly MemberProof[];
  ticketEmail?:string|null;
  ticketName?:string|null;
}):ResolvedPerson|null{
  const {people,explicitPersonId,memberRowId,memberEvidence,ticketEmail,ticketName}=input;
  if(explicitPersonId){
    const direct=people.find(p=>p.id===explicitPersonId);
    return direct?{personId:direct.id,reason:"explicit"}:null;
  }
  if(memberRowId){
    const evidence=memberEvidence.find(e=>e.id===memberRowId);
    if(!evidence)return null;
    const key=normalizedName(evidence.first_name,evidence.last_name);
    const matched=people.filter(person=>{
      if(person.association_member_id===memberRowId)return true;
      if(person.membership_email && sameEmail(person.membership_email,evidence.email)){
        const personName=normalizedName(person.first_name,person.last_name);
        return !personName||!key||personName===key;
      }
      return Boolean(key&&person.membership_name_key===key);
    });
    return matched.length===1?{personId:matched[0].id,reason:"confirmed_member"}:null;
  }
  // Email univoca E stesso nome ufficiale o nickname esatto: non associare un
  // biglietto acquistato da terzi solo perche' condivide l'email del compratore.
  if(!ticketEmail||!ticketName)return null;
  const ticketNameKey=normalizedName(ticketName,null);
  const ticketAlias=normalizedAlias(ticketName);
  const candidates=people.filter(person=>{
    if(!sameEmail(person.email,ticketEmail))return false;
    const personNameKey=normalizedName(person.first_name,person.last_name);
    const personNickname=normalizedAlias(person.nickname);
    return Boolean(ticketNameKey&&personNameKey&&ticketNameKey===personNameKey)||
      Boolean(ticketAlias&&personNickname&&ticketAlias===personNickname);
  });
  return candidates.length===1?{personId:candidates[0].id,reason:"ticket_identity"}:null;
}
