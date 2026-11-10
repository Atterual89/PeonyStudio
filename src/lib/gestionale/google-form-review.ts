import type { AssociationMembersSyncPreview } from "@/lib/association/members-sync";
import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";

/** La revisione non applica modifiche: classifica soltanto le evidenze. */
export type FormReviewKind = "new" | "changed" | "duplicate" | "homonym" | "missing_form";
export type FormReviewCase = {
  id: string;
  kind: FormReviewKind;
  name: string;
  email: string | null;
  sourceRowId: string | null;
  sourceHash: string | null;
  relatedRecords: number;
  differences: Array<{label:string;before:string;after:string}>;
  evidence: Array<{id:string;source:string;name:string;email:string|null;status:string|null;expiresAt?:string|null}>;
  candidates: Array<{ id: string; name: string; email: string | null }>;
  explanation: string;
  /** Le incongruenze potenzialmente ambigue non sono importabili in un clic. */
  canConfirm: boolean;
};

export type ReviewMember = {
  id: string;
  source: string | null;
  source_row_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: string | null;
  source_hash?: string | null;
  contact?: string | null;
  membership_starts_at?: string | null;
  membership_expires_at?: string | null;
};
export type ReviewPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  email: string | null;
  merged_into: string | null;
};
const normName=(first:string|null,last:string|null)=>normalizeMembershipNameKey(first,last);
const name=(first:string|null,last:string|null)=>[first,last].filter(Boolean).join(" ").trim() || "Nominativo non disponibile";
const email=(value:string|null)=>normalizeMembershipEmail(value);
const unique=<T>(items:T[])=>[...new Set(items)];

export function buildGoogleFormReviewQueue(input:{
  preview: AssociationMembersSyncPreview;
  members: readonly ReviewMember[];
  people: readonly ReviewPerson[];
}): FormReviewCase[] {
  const {preview,members}=input;
  const people=input.people.filter(person=>!person.merged_into);
  const forms=members.filter(row=>row.source==="google_sheet");
  const payments=members.filter(row=>row.source==="manual_override"&&row.membership_status==="verified");
  const paper=members.filter(row=>row.source==="manual_form"&&row.membership_status==="verified");
  const candidates=(personName:string,emailAddress:string|null)=>{
    const n=normName(...personNameParts(personName));
    const e=email(emailAddress);
    return people.filter(p=>
      (e&&email(p.email)===e) ||
      (n&&normName(p.first_name,p.last_name)===n)
    ).map(p=>({id:p.id,name:name(p.first_name,p.last_name)||p.nickname||"Persona",email:p.email}));
  };
  const bySource=new Map<string,ReviewMember[]>();
  for(const row of forms){
    if(!row.source_row_id)continue;
    bySource.set(row.source_row_id,[...(bySource.get(row.source_row_id)??[]),row]);
  }
  const result:FormReviewCase[]=[];
  const evidenceOf=(rows:readonly ReviewMember[])=>
    rows.map(row=>({
      id:row.id,
      source:row.source==="google_sheet"?"Modulo Google":row.source==="manual_override"?"Quota email/manuale":row.source==="manual_form"?"Modulo cartaceo":"Altro",
      name:name(row.first_name,row.last_name),
      email:row.email,status:row.membership_status,expiresAt:row.membership_expires_at,
    }));
  const duplicateSourceIds=new Set<string>();
  for(const [sourceRowId,rows] of bySource){
    if(rows.length<2)continue;
    duplicateSourceIds.add(sourceRowId);
    const first=rows[0];
    result.push({
      id:`duplicate:${sourceRowId}`,kind:"duplicate",
      name:name(first.first_name,first.last_name),email:first.email,
      sourceRowId,sourceHash:null,relatedRecords:rows.length,
      differences:[...new Set(rows.map(row=>row.membership_expires_at??"—"))].length>1
       ? [{label:"Scadenza registrata",before:rows[0].membership_expires_at??"—",
          after:rows.at(-1)?.membership_expires_at??"—"}]:[],
      evidence:evidenceOf(rows),
      candidates:candidates(name(first.first_name,first.last_name),first.email),
      explanation:`${rows.length} copie tecniche della stessa risposta Google, create durante le sincronizzazioni. Gli ID sono del database, non nuovi moduli compilati. Confronta le versioni prima di consolidare.`,
      canConfirm:false,
    });
  }
  // Nomi uguali con email discordanti: non assumere che siano la stessa persona.
  const byName=new Map<string,Array<{email:string;first:string|null;last:string|null}>>();
  const allIdentities=[
    ...preview.validSourceRows.map(row=>({first:row.first_name,last:row.last_name,email:row.email})),
    ...payments.map(row=>({first:row.first_name,last:row.last_name,email:row.email})),
    ...people.map(row=>({first:row.first_name,last:row.last_name,email:row.email})),
  ];
  for(const row of allIdentities){
    const key=normName(row.first,row.last);
    if(!key||!row.email)continue;
    byName.set(key,[...(byName.get(key)??[]),{...row,email:email(row.email)}]);
  }
  const ambiguousNames=new Set<string>();
  for(const [key,rows] of byName){
    const addresses=unique(rows.map(row=>row.email).filter(Boolean));
    if(addresses.length<2)continue;
    ambiguousNames.add(key);
    result.push({
      id:`homonym:${key}`,kind:"homonym",name:name(rows[0].first,rows[0].last),
      email:null,sourceRowId:null,sourceHash:null,relatedRecords:addresses.length,differences:[],
      evidence:evidenceOf(members.filter(member=>normName(member.first_name,member.last_name)===key)),
      candidates:candidates(name(rows[0].first,rows[0].last),null),
      explanation:`Lo stesso nome compare con ${addresses.length} indirizzi email diversi. Possono essere omonimi, email condivise o una sola persona: decidi prima di collegare.`,
      canConfirm:false,
    });
  }
  for(const row of preview.previewRows){
    if(row.action!=="create"&&row.action!=="update")continue;
    const nk=normName(row.first_name,row.last_name);
    const isDuplicate=duplicateSourceIds.has(row.source_row_id);
    const isAmbiguous=ambiguousNames.has(nk);
    if(isDuplicate||isAmbiguous)continue;
    const matched=candidates(name(row.first_name,row.last_name),row.email);
    const isNew=row.action==="create";
    const previous=members.find(member=>member.id===row.existingMemberId);
    const current=preview.validSourceRows.find(form=>form.source_row_id===row.source_row_id);
    const differences:Array<{label:string;before:string;after:string}>=[];
    if(previous&&current){
      const fields:[
        string,string|null|undefined,string|null|undefined,
      ][]=[
        ["Nome",previous.first_name,current.first_name],
        ["Cognome",previous.last_name,current.last_name],
        ["Email",previous.email,current.email],
        ["Contatto",previous.contact,current.contact],
        ["Data modulo",previous.membership_starts_at,current.membership_starts_at],
        ["Scadenza associativa registrata",previous.membership_expires_at,current.membership_expires_at],
      ];
      for(const [label,before,after] of fields){
        if((before??"").trim()!==(after??"").trim())
          differences.push({label,before:before||"—",after:after||"—"});
      }
    }
    result.push({
      id:`form:${row.source_row_id}`,kind:isNew?"new":"changed",
      name:name(row.first_name,row.last_name),email:row.email,
      sourceRowId:row.source_row_id,
      sourceHash:preview.validSourceRows.find(source=>source.source_row_id===row.source_row_id)?.source_hash??null,
      relatedRecords:1,differences,evidence:evidenceOf(members.filter(member=>member.source==="google_sheet"&&member.source_row_id===row.source_row_id)),candidates:matched,
      explanation:isNew
        ? matched.length?"Modulo nuovo: esiste già una possibile scheda persona. Importa il modulo e collegalo alla scheda esistente, senza crearne un'altra.":"Modulo nuovo: controlla i dati prima di aggiungerlo."
        : "Il modulo Google e la copia nel database differiscono. Verifica i campi prima di aggiornare.",
      canConfirm:matched.length<=1,
    });
  }
  const formEmails=new Set(preview.validSourceRows.map(row=>email(row.email)).filter(Boolean));
  const formNames=new Set(preview.validSourceRows.map(row=>normName(row.first_name,row.last_name)).filter(Boolean));
  const missingKeys=new Set<string>();
  for(const payment of payments){
    const key=email(payment.email)||normName(payment.first_name,payment.last_name);
    if(!key||missingKeys.has(key))continue;
    if(formEmails.has(email(payment.email))||(!payment.email&&formNames.has(normName(payment.first_name,payment.last_name))))continue;
    if(paper.some(row=>(row.email&&payment.email&&email(row.email)===email(payment.email))||
      normName(row.first_name,row.last_name)===normName(payment.first_name,payment.last_name)))continue;
    missingKeys.add(key);
    result.push({
      id:`missing:${payment.id}`,kind:"missing_form",
      name:name(payment.first_name,payment.last_name),email:payment.email,
      sourceRowId:null,sourceHash:null,relatedRecords:1,differences:[],evidence:evidenceOf([payment]),
      candidates:candidates(name(payment.first_name,payment.last_name),payment.email),
      explanation:"Quota confermata ma modulo Google non trovato. Controlla l'indirizzo del modulo prima di chiedere una nuova compilazione.",
      canConfirm:false,
    });
  }
  const order:Record<FormReviewKind,number>={new:0,duplicate:1,homonym:2,missing_form:3,changed:4};
  return result.sort((a,b)=>order[a.kind]-order[b.kind]||a.name.localeCompare(b.name,"it"));
}
function personNameParts(value:string):[string|null,string|null] {
  const parts=value.trim().split(/\s+/);
  return parts.length>1?[parts.slice(0,-1).join(" "),parts[parts.length-1]]:[value,null];
}
