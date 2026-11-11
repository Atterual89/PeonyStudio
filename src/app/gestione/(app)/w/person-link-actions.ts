"use server";

import {requireOrganizer} from "@/lib/gestionale/server/auth";
import {getGestionaleDb} from "@/lib/gestionale/server/db";
import {refreshGestione} from "@/lib/gestionale/server/refresh";
import {normalizeText} from "@/lib/gestionale/format";
import {isUuidLike} from "@/lib/gestionale/validation";

export type OrganizerMatchCandidate={
  id:string;name:string;nickname:string|null;emailHint:string|null;enrolled:boolean;
};
export type OrganizerMatchContext={
  current:{id:string;name:string;nickname:string|null}|null;
  confirmed:boolean;
  provisional:boolean;
  canSplit:boolean;
};
type Result<T>={ok:true;data:T}|{ok:false;error:string};
const invalid={ok:false as const,error:"Ricarica l'iscrizione e riprova."};
const fail=(text:string)=>({ok:false as const,error:text});
const nameOf=(row:{first_name:string|null;last_name:string|null;nickname:string|null})=>
  [row.first_name,row.last_name].filter(Boolean).join(" ").trim()||row.nickname||"Persona senza nome";
const mailHint=(mail:string|null)=>{
  if(!mail||!mail.includes("@"))return null;
  const [local,domain]=mail.split("@");
  return local.slice(0,1)+"***@"+domain;
};

async function activeParticipant(id:string){
  const db=getGestionaleDb();
  const {data:part,error}=await db.from("gw_booking_participants")
    .select("id,booking_id,workshop_id,person_id,entered_as,match_status,auto_created_person,is_primary")
    .eq("id",id).is("removed_at",null).is("deleted_at",null).maybeSingle();
  if(error||!part)return null;
  const {data:booking,error:be}=await db.from("gw_bookings")
    .select("id,workshop_id").eq("id",part.booking_id).is("deleted_at",null).maybeSingle();
  if(be||!booking||booking.workshop_id!==part.workshop_id)return null;
  const {data:workshop,error:we}=await db.from("gw_workshops").select("id")
    .eq("id",part.workshop_id).is("deleted_at",null).maybeSingle();
  if(we||!workshop)return null;
  return part;
}

/** Vista limitata alla persona DI QUESTA iscrizione; nessun dato associativo. */
export async function organizerMatchContextAction(input:{participantId:string}):
  Promise<Result<OrganizerMatchContext>>{
  await requireOrganizer();
  if(!isUuidLike(input?.participantId))return invalid;
  const part=await activeParticipant(input.participantId);
  if(!part)return fail("Partecipante non disponibile.");
  const db=getGestionaleDb();
  const [person,others]=await Promise.all([
    db.from("gw_people").select("id,first_name,last_name,nickname").eq("id",part.person_id)
      .is("deleted_at",null).is("merged_into",null).maybeSingle(),
    db.from("gw_booking_participants").select("id").eq("booking_id",part.booking_id)
      .is("deleted_at",null).is("removed_at",null).limit(2),
  ]);
  if(person.error||others.error)return fail("Anagrafica temporaneamente non disponibile.");
  const current=person.data?{
    id:person.data.id,name:nameOf(person.data),nickname:person.data.nickname??null,
  }:null;
  return {ok:true,data:{
    current,
    confirmed:part.match_status==="confermato"&&!part.auto_created_person,
    provisional:part.auto_created_person||part.match_status==="da_abbinare",
    canSplit:Boolean(part.is_primary&&part.auto_created_person&&
      part.match_status==="da_abbinare"&&/[\/+]|\s+e\s+/i.test(part.entered_as||"")&&
      others.data?.length===1),
  }};
}

/** Cerca soltanto per un testo fornito da Alessandra; non elenca il libro soci
 * né le quote. I risultati NON vengono collegati finché non conferma.
 */
export async function searchOrganizerPeopleAction(input:{participantId:string;query:string}):
  Promise<Result<OrganizerMatchCandidate[]>>{
  await requireOrganizer();
  if(!isUuidLike(input?.participantId)||typeof input.query!=="string"||
    input.query.trim().length<3||input.query.length>100)
    return fail("Scrivi almeno tre caratteri di nome, nickname o email.");
  const part=await activeParticipant(input.participantId);
  if(!part)return fail("Partecipante non disponibile.");
  const db=getGestionaleDb();
  const {data,error}=await db.from("gw_people")
    .select("id,first_name,last_name,nickname,email")
    .is("deleted_at",null).is("merged_into",null).range(0,9999);
  if(error)return fail("Ricerca nell'anagrafica non riuscita.");
  const people=data??[];
  const ids=people.map(p=>p.id);
  const aliases=new Map<string,string[]>();
  for(let i=0;i<ids.length;i+=500){
    const {data:items,error:aliasError}=await db.from("gw_person_aliases")
      .select("person_id,alias").in("person_id",ids.slice(i,i+500))
      .is("deleted_at",null).range(0,9999);
    if(aliasError)break;
    for(const a of items??[])
      aliases.set(a.person_id,[...(aliases.get(a.person_id)??[]),a.alias]);
  }
  const tokens=normalizeText(input.query.trim()).split(/\s+/).filter(Boolean);
  const matches=people.filter(person=>{
    const searchable=normalizeText([person.first_name,person.last_name,
      person.nickname,person.email,...(aliases.get(person.id)??[])].filter(Boolean).join(" "));
    return tokens.every(token=>searchable.includes(token));
  }).slice(0,15);
  if(!matches.length)return {ok:true,data:[]};
  const {data:enrolled,error:enrolledError}=await db.from("gw_booking_participants")
    .select("person_id,id").eq("workshop_id",part.workshop_id)
    .in("person_id",matches.map(p=>p.id))
    .is("removed_at",null).is("deleted_at",null);
  if(enrolledError)return fail("Impossibile verificare le iscrizioni esistenti.");
  const unavailable=new Set((enrolled??[]).filter(x=>x.id!==part.id).map(x=>x.person_id));
  return {ok:true,data:matches.map(person=>({
    id:person.id,name:nameOf(person),nickname:person.nickname??null,
    emailHint:mailHint(person.email),enrolled:unavailable.has(person.id),
  }))};
}

export type OrganizerLinkReceipt={
  alreadyLinked:boolean;
  excelLinked:boolean|null;
};

/** Il successo vale solo dopo lettura del collegamento realmente salvato.
 * Il collegamento al contatto Excel è separato e non viene inventato/modificato.
 */
export async function linkOrganizerPersonAction(input:{participantId:string;personId:string}):
  Promise<Result<OrganizerLinkReceipt>>{
  const operator=await requireOrganizer();
  if(!isUuidLike(input?.participantId)||!isUuidLike(input?.personId))return invalid;
  const before=await activeParticipant(input.participantId);
  if(!before)return fail("Partecipante non disponibile. Ricarica il workshop.");
  const alreadyLinked=before.person_id===input.personId &&
    before.match_status==="confermato"&&!before.auto_created_person;
  const db=getGestionaleDb();
  const {error}=await db.rpc("gw_organizer_link_workshop_person",{
    p_operator_id:operator.id,p_participant_id:input.participantId,p_person_id:input.personId,
  });
  if(error)return fail(error.code==="GW409"?
    "Questa persona è già iscritta al workshop. Controlla l'altra iscrizione.":
    "Abbinamento non salvato. Riprova dopo aver verificato la persona.");

  const {data:saved,error:readError}=await db.from("gw_booking_participants")
    .select("person_id,match_status,auto_created_person")
    .eq("id",input.participantId).is("removed_at",null).is("deleted_at",null).maybeSingle();
  if(readError||!saved||saved.person_id!==input.personId||
    saved.match_status!=="confermato"||saved.auto_created_person)
    return fail("Non è stato possibile verificare l'abbinamento nel database. Ricarica il workshop.");

  const {data:excelRows,error:excelError}=await db.from("gw_ale_contacts")
    .select("id").eq("owner_operator_id",operator.id)
    .eq("person_id",input.personId).limit(1);
  if(!alreadyLinked)refreshGestione();
  return {ok:true,data:{
    alreadyLinked,
    excelLinked:excelError?null:Boolean(excelRows?.length),
  }};
}

export async function splitOrganizerCompoundAction(input:{
  participantId:string;firstName:string;secondName:string;
  secondPersonId:string|null;createProvisional:boolean;
}):Promise<Result<null>>{
  const operator=await requireOrganizer();
  const first=typeof input?.firstName==="string"?input.firstName.trim():"";
  const second=typeof input?.secondName==="string"?input.secondName.trim():"";
  if(!isUuidLike(input?.participantId)||!first||!second||first===second||
    first.length>200||second.length>200||
    (input.secondPersonId!==null&&!isUuidLike(input.secondPersonId))||
    typeof input.createProvisional!=="boolean"||
    Boolean(input.secondPersonId)===input.createProvisional)
    return fail("Controlla i due nomi e seleziona il partner esistente oppure la creazione provvisoria.");
  const {error}=await getGestionaleDb().rpc("gw_organizer_split_compound_person",{
    p_operator_id:operator.id,p_participant_id:input.participantId,
    p_first_name:first,p_second_name:second,p_second_person_id:input.secondPersonId,
    p_create_provisional:input.createProvisional,
  });
  if(error)return fail(error.code==="GW409"?
    "Questa coppia è già divisa, oppure il partner risulta già iscritto. Aggiorna la pagina.":
    "Impossibile dividere la coppia. Verifica la scelta.");
  refreshGestione();
  return {ok:true,data:null};
}
