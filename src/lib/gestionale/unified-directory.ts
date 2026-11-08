import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { groupMemberEvidence } from "@/lib/gestionale/member-evidence-groups";
import type { Person } from "@/lib/gestionale/types";

export type RegistryEvidence = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  source: string | null;
  membership_status: string | null;
  membership_starts_at: string | null;
  membership_expires_at: string | null;
  notes_admin?: string | null;
};
export type UnifiedContact = {
  key: string;
  name: string;
  nickname: string | null;
  email: string | null;
  personId: string | null;
  personVersion: number | null;
  possiblePersonId: string | null;
  possiblePersonVersion: number | null;
  kind: "anagrafica" | "unita" | "registro";
  association: "verificata" | "da_verificare" | "solo_modulo" | "non_presente" | "non_disponibile";
  source: string;
  link: "confermato" | "email" | "da_verificare" | "nessuno";
  search: string;
};
type PersonRef = Pick<Person,
  "id" | "first_name" | "last_name" | "nickname" | "email" |
  "association_member_id" | "membership_email" | "membership_name_key" | "merged_into"> &
 { version?: number; instagram?: string|null; phone?: string|null; teamartist_id?: string|null };
type Group = {
  id: string;
  nameKey: string;
  rows: RegistryEvidence[];
  emails: Set<string>;
};
const mail=(s:string|null|undefined)=>normalizeMembershipEmail(s);
const nameKey=(first:string|null|undefined,last:string|null|undefined)=>normalizeMembershipNameKey(first,last);
const nameOf=(row:{first_name:string|null;last_name:string|null})=>[row.first_name,row.last_name].filter(Boolean).join(" ").trim();
const sources=(rows:readonly RegistryEvidence[])=>{
  const labels=[];
  const provenEmail=rows.some(r=>r.source==="manual_override"&&
    r.membership_status==="verified"&&r.notes_admin?.startsWith("Quota confermata da email ("));
  if(provenEmail)labels.push("Pagamento email confermato");
  if(rows.some(r=>r.source==="official_members_book"))labels.push("Libro soci");
  if(rows.some(r=>r.source==="google_sheet"))labels.push("Modulo Google");
  if(!provenEmail&&rows.some(r=>r.source==="manual_override"))labels.push("Verifica manuale");
  return labels.join(" · ");
};
function association(rows:readonly RegistryEvidence[],date:string):UnifiedContact["association"]{
  if(!rows.length)return "non_presente";
  const period=membershipPeriodFor(date);
  if(period&&rows.some(r=>r.source!=="google_sheet"&&r.membership_status==="verified"&&
    Boolean(r.membership_starts_at&&r.membership_starts_at>=period.paymentsFrom&&r.membership_starts_at<=period.validUntil)))
      return "verificata";
  return rows.some(r=>r.source==="official_members_book"||r.source==="manual_override")
    ?"da_verificare":"solo_modulo";
}
/**
 * Group same-name sources by compatible email. An official entry without email
 * joins an email cluster only if that name identifies exactly one email cluster.
 * This is presentation-only; it does not persist links or verify identities.
 */
function groupEvidence(rows:readonly RegistryEvidence[]):Group[]{
  // The same identity logic must be used in the member selector and in
  // Persone. A book record without email and one manual yearly validation
  // are separate proofs, not separate people when the name is unambiguous.
  return groupMemberEvidence(rows.map(row=>({
    ...row,tableId:row.source==="manual_override"?row.id:null,
  }))).map(group=>({
    id:group.map(row=>row.id).sort().join("|"),
    nameKey:nameKey(group[0]?.first_name,group[0]?.last_name),
    rows:group,
    emails:new Set(group.map(row=>mail(row.email)).filter(email=>email.includes("@"))),
  }));
}
const compatible=(person:PersonRef,group:Group)=>{
  const pn=nameKey(person.first_name,person.last_name);
  return !pn || !group.nameKey || pn===group.nameKey;
};
const preferred=(group:Group)=>{
  const rank:Record<string,number>={official_members_book:0,manual_override:1,google_sheet:2};
  return [...group.rows].sort((a,b)=>(rank[a.source??""]??9)-(rank[b.source??""]??9))[0];
};
const active=(people:readonly PersonRef[])=>people.filter(p=>!p.merged_into);

export function buildUnifiedDirectory(input:{
  people:readonly PersonRef[];
  evidence:readonly RegistryEvidence[];
  today:string;
  aliasesByPerson?:ReadonlyMap<string,readonly string[]>;
}):UnifiedContact[]{
  const people=active(input.people);
  const groups=groupEvidence(input.evidence);
  const byEmail=new Map<string,PersonRef[]>();
  const byName=new Map<string,PersonRef[]>();
  const byGroupEmail=new Map<string,Group[]>();
  for(const person of people){
    const email=mail(person.email);
    if(email.includes("@"))byEmail.set(email,[...(byEmail.get(email)??[]),person]);
    const nk=nameKey(person.first_name,person.last_name);
    if(nk)byName.set(nk,[...(byName.get(nk)??[]),person]);
  }
  for(const group of groups)for(const email of group.emails)
    byGroupEmail.set(email,[...(byGroupEmail.get(email)??[]),group]);
  const claimed=new Set<string>();
  const contacts:UnifiedContact[]=[];
  for(const person of people){
    const personEmail=mail(person.email);
    const memberEmail=mail(person.membership_email);
    const targetName=person.membership_name_key||"";
    let group:Group|undefined;
    let link:UnifiedContact["link"]="nessuno";
    const manual=person.association_member_id
      ? groups.filter(g=>g.rows.some(row=>row.id===person.association_member_id&&row.source==="manual_override")):[];
    if(manual.length===1){group=manual[0];link="confermato";}
    if(!group&&memberEmail.includes("@")){
      const options=(byGroupEmail.get(memberEmail)??[]).filter(g=>compatible(person,g));
      if(options.length===1){group=options[0];link="confermato";}
    }
    if(!group&&targetName){
      const options=groups.filter(g=>g.nameKey===targetName&&compatible(person,g));
      if(options.length===1){group=options[0];link="confermato";}
    }
    if(!group&&personEmail.includes("@")&&(byEmail.get(personEmail)??[]).length===1){
      const options=(byGroupEmail.get(personEmail)??[]).filter(g=>compatible(person,g));
      if(options.length===1){group=options[0];link="email";}
    }
    // Two anagrafiche pointing to one registry row must never be silently joined.
    if(group&&claimed.has(group.id)){group=undefined;link="da_verificare";}
    if(group)claimed.add(group.id);
    const best=group?preferred(group):null;
    const fullName=nameOf(person)||nameOf(best??{first_name:null,last_name:null})||person.nickname||person.email||"Persona senza nome";
    const email=person.email||best?.email||null;
    contacts.push({
      key:`person:${person.id}`,name:fullName,nickname:person.nickname,email,
      personId:person.id,personVersion:person.version??null,possiblePersonId:null,possiblePersonVersion:null,kind:group?"unita":"anagrafica",
      association:association(group?.rows??[],input.today),source:group?sources(group.rows):"Anagrafica",
      link,search:[fullName,person.nickname,email,person.instagram,person.phone,person.teamartist_id,
        group?.rows.map(nameOf).join(" "),...(input.aliasesByPerson?.get(person.id)??[])].filter(Boolean).join(" "),
    });
  }
  for(const group of groups){
    if(claimed.has(group.id))continue;
    const best=preferred(group);
    const email=best.email||[...group.emails][0]||null;
    const name=nameOf(best)||email||"Nominativo non disponibile";
    const matched=(byName.get(group.nameKey)??[]).filter(person=>
      compatible(person,group)&&(!person.email||!group.emails.size||group.emails.has(mail(person.email))));
    const possiblePersonId=group.nameKey&&matched.length===1?matched[0].id:null;
    contacts.push({
      key:`source:${group.id}`,name,email,nickname:null,personId:null,personVersion:null,possiblePersonId,
      possiblePersonVersion:possiblePersonId?(matched[0].version??null):null,
      kind:"registro",association:association(group.rows,input.today),source:sources(group.rows),
      link:possiblePersonId?"da_verificare":"nessuno",
      search:[name,email,group.rows.map(nameOf).join(" ")].filter(Boolean).join(" "),
    });
  }
  return contacts.sort((a,b)=>a.name.localeCompare(b.name,"it"));
}
