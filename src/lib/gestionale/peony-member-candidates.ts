import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import { cleanPartnerEmail, cleanPartnerName } from "@/lib/gestionale/peony-booking-partner";

export type DirectoryMemberRow = {
  id: string; first_name: string | null; last_name: string | null;
  email: string | null; source: string | null;
};
export type DirectoryPersonRow = {
  id: string; first_name: string | null; last_name: string | null;
  nickname: string | null; email: string | null; aliases?:string[];
};
export type MemberDirectoryCandidate = {
  kind: "member" | "person";
  id: string;
  name: string;
  email: string | null;
  aliases?:string[];
  origin: "Libro soci" | "Modulo Google" | "Modulo cartaceo" | "Conferma manuale" | "Anagrafica" | "Libro soci + modulo";
  // L'identità è esplicita. In caso di omonimia non unire mai indirizzi diversi.
};
const keyName=(first:string|null,last:string|null)=>
  normalizeMembershipNameKey(first,last);
const fullName=(first:string|null,last:string|null,nick?:string|null)=>
  cleanPartnerName([first,last].filter(Boolean).join(" "))||cleanPartnerName(nick)||null;
const sourcePriority=(source:string|null)=>
  source==="google_sheet"?0:source==="manual_form"?1:source==="manual_override"?2:3;
const origin=(source:string|null):MemberDirectoryCandidate["origin"]=>
  source==="manual_form"?"Modulo cartaceo":source==="google_sheet"?"Modulo Google":"Conferma manuale";

/**
 * Righe libro soci + modulo Google: unisce soltanto nominativi univoci.
 * Una riga libro senza email è associabile al modulo solo se per quel
 * nome risulta ESATTAMENTE un indirizzo, altrimenti resta indipendente.
 * Il nominativo esatto è parte della chiave, quindi un'email condivisa
 * da persone diverse non le fonde.
 */
export function buildPeonyMemberDirectory(
  evidence: readonly DirectoryMemberRow[], people: readonly DirectoryPersonRow[],
): MemberDirectoryCandidate[] {
  const groups=new Map<string,DirectoryMemberRow[]>();
  for(const row of evidence){
    if(!["google_sheet","manual_form","manual_override"].includes(row.source??""))continue;
    const name=keyName(row.first_name,row.last_name);
    const email=cleanPartnerEmail(row.email);
    const groupKey=name?`name:${name}`:email?`only-email:${normalizeMembershipEmail(email)}`:"";
    if(!groupKey)continue;
    groups.set(groupKey,[...(groups.get(groupKey)??[]),row]);
  }
  const result:MemberDirectoryCandidate[]=[];
  function pushGroup(rows:DirectoryMemberRow[],email:string|null){
    if(!rows.length)return;
    const ranked=[...rows].sort((a,b)=>sourcePriority(a.source)-sourcePriority(b.source));
    const first=ranked[0];
    const resolvedName=fullName(first.first_name,first.last_name)??email;
    if(!resolvedName)return;
    const hasBook=rows.some(row=>row.source==="official_members_book");
    const hasForm=rows.some(row=>row.source==="google_sheet");
    result.push({kind:"member",id:first.id,name:resolvedName,email,
      origin:hasBook&&hasForm?"Libro soci + modulo":origin(first.source)});
  }
  for(const rows of groups.values()){
    const byEmail=new Map<string,DirectoryMemberRow[]>();
    const without:DirectoryMemberRow[]=[];
    for(const row of rows){
      const email=cleanPartnerEmail(row.email);
      if(!email){without.push(row);continue;}
      const key=normalizeMembershipEmail(email);
      byEmail.set(key,[...(byEmail.get(key)??[]),row]);
    }
    if(byEmail.size===1){
      const [emailKey,withEmail]=[...byEmail.entries()][0];
      // Un'unica email per questo nome: libro senza email e modulo si
      // riferiscono allo stesso nominativo (salvo evidenze contrarie).
      pushGroup([...withEmail,...without],cleanPartnerEmail(withEmail[0].email)??emailKey);
    }else if(byEmail.size===0){
      // Senza email non indovinare l'identità degli omonimi con righe
      // ufficiali differenti: lascia scegliere il record preciso.
      const official=without.filter(row=>row.source==="official_members_book");
      if(official.length>1){
        for(const row of official)pushGroup([row],null);
        if(without.length>official.length)pushGroup(without.filter(row=>row.source!=="official_members_book"),null);
      }else pushGroup(without,null);
    }else{
      // Omonimi con email diverse: non assegnare a nessuna email le righe
      // anonime del libro. Le mantiene come risultato separato.
      for(const [key,items] of byEmail)pushGroup(items,cleanPartnerEmail(items[0].email)??key);
      if(without.length)pushGroup(without,null);
    }
  }

  for(const person of people){
    const name=fullName(person.first_name,person.last_name,person.nickname);
    const email=cleanPartnerEmail(person.email);
    if(!name&&!email)continue;
    const nameKey=keyName(person.first_name,person.last_name);
    const candidates=result.filter(row=>
      (nameKey?normalizeMembershipNameKey(row.name,null)===nameKey:false)
      ||(!nameKey&&email&&row.email&&normalizeMembershipEmail(row.email)===normalizeMembershipEmail(email))
    );
    const exact=candidates.filter(row=>
      email&&row.email&&normalizeMembershipEmail(email)===normalizeMembershipEmail(row.email));
    // Se il libro ha nome univoco ma non l'email, arricchisci soltanto
    // quando non esistono persone omonime con email in conflitto.
    // Il profilo canonico deve essere sempre selezionabile, anche se modulo
    // o libro soci hanno lo stesso nome/email. Non arricchire mai una prova
    // associativa modificando l'email dall'anagrafica senza conferma.
    result.push({kind:"person",id:person.id,name:name??email!,email,
      aliases:[person.nickname??"",...(person.aliases??[])].filter(Boolean),origin:"Anagrafica"});
  }
  // Evita le ripetizioni di una stessa identità esatta quando più annualità
  // compaiono con lo stesso nome ed email, senza fondere email incompatibili.
  const unique=new Set<string>();
  return result.filter(row=>{
    const key=row.kind==="person"?`person|${row.id}`:
      row.email?`member|${normalizeMembershipNameKey(row.name,null)}|${normalizeMembershipEmail(row.email)}`:
      `no-email|${row.kind}|${row.id}`;
    if(unique.has(key))return false;
    unique.add(key);return true;
  }).sort((a,b)=>a.name.localeCompare(b.name,"it")||(a.kind==="person"?-1:1) - (b.kind==="person"?-1:1)||String(a.email).localeCompare(String(b.email)));
}

export function filterPeonyMemberDirectory(rows:readonly MemberDirectoryCandidate[],query:string){
  const words=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase("it").trim().split(/\s+/).filter(Boolean);
  return rows.filter(row=>{
    const text=`${row.name} ${row.email??""} ${(row.aliases??[]).join(" ")}`
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("it");
    return words.every(word=>text.includes(word));
  }).slice(0,20);
}
