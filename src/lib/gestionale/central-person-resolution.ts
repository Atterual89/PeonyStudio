import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";

/** Profilo di una sola persona, non un record del modulo o del biglietto. */
export type CentralPerson = {
  id:string;
  first_name:string|null;last_name:string|null;nickname:string|null;email:string|null;
  association_member_id?:string|null;membership_email?:string|null;membership_name_key?:string|null;
};
export type MemberProof={id:string;first_name:string|null;last_name:string|null;email:string|null;source?:string|null;membership_status?:string|null};
export type ResolvedPerson={personId:string;reason:"explicit"|"confirmed_member"|"confirmed_ticket_member"|"ticket_identity"};

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
  // Se Ticket Tailor riporta il nome completo del socio ufficiale, la sua
  // prova di identita' e il collegamento KL gia' confermato possono risolvere
  // la stessa gw_people anche quando la scheda non ha ancora un'email.
  // E' una risoluzione in lettura: non scrive alcun abbinamento automatico.
  // Non basta il nome: servono email del biglietto, una sola tessera ufficiale,
  // nessun indirizzo incompatibile e un solo profilo gia' legato a quella tessera.
  if(ticketEmail && ticketName){
    const ticketKey=normalizedName(ticketName,null);
    const official=memberEvidence.filter(e=>e.source==="official_members_book" &&
      e.membership_status==="verified" &&
      normalizedName(e.first_name,e.last_name)===ticketKey);
    if(ticketKey && official.length===1 &&
      (!official[0].email || sameEmail(official[0].email,ticketEmail))){
      const record=official[0];
      const matches=people.filter(person=>
        person.association_member_id===record.id ||
        person.membership_name_key===ticketKey ||
        Boolean(record.email && person.membership_email &&
          sameEmail(person.membership_email,record.email)));
      if(matches.length===1)return {personId:matches[0].id,reason:"confirmed_ticket_member"};
      if(matches.length>1)return null;
    }
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
