"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { associationStatus, getPeonyEvent, isActivePeonyTicket, readAllMemberEvidence } from "@/lib/gestionale/server/peony-events";
import { cleanPartnerEmail, cleanPartnerName, isSameParticipant } from "@/lib/gestionale/peony-booking-partner";
import { normalizeText } from "@/lib/gestionale/format";
import { buildPeonyMemberDirectory, filterPeonyMemberDirectory } from "@/lib/gestionale/peony-member-candidates";
import { isUuidLike } from "@/lib/gestionale/validation";
import { todayInRome } from "@/lib/gestionale/workshops";
import { PEONY_EMAIL_KINDS, type PeonyEmailKind } from "@/lib/gestionale/peony-email-html";

export type PeonyActionResult = { ok: true } | { ok: false; error: string };

const validKind = (kind: unknown): kind is PeonyEmailKind =>
  typeof kind === "string" && PEONY_EMAIL_KINDS.some((item) => item.id === kind);

/** Non modifica mai i biglietti o le presenze Ticket Tailor. */
export async function savePeonyEmailTemplate(
  eventId: string,
  kind: PeonyEmailKind,
  subject: string,
  body: string,
): Promise<PeonyActionResult> {
  const operator = await requireAdmin();
  if (!validKind(kind) || !(await getPeonyEvent(eventId)))
    return { ok: false, error: "Evento o tipo di email non disponibile." };
  if (typeof subject !== "string" || typeof body !== "string" ||
      !subject.trim() || subject.length > 300 || body.length > 30000) {
    return { ok: false, error: "Indica un oggetto (max 300 caratteri) e un testo (max 30.000)." };
  }
  const { error } = await getGestionaleDb().from("gw_peony_email_kinds")
    .upsert({ event_id: eventId, kind, subject: subject.trim(), body,
      updated_by: operator.id, updated_at: new Date().toISOString() },
    { onConflict: "event_id,kind" });
  if (error) return { ok: false, error: "Impossibile salvare il modello email." };
  refreshGestione();
  return { ok: true };
}

export async function markPeonyEmailSent(
  eventId: string,
  ticketIds: string[],
  kind: PeonyEmailKind,
  subject: string,
): Promise<PeonyActionResult> {
  const operator = await requireAdmin();
  const event = await getPeonyEvent(eventId);
  if (!event || !validKind(kind) || !Array.isArray(ticketIds) ||
      ticketIds.length === 0 || ticketIds.length > 200 ||
      ticketIds.some((id) => typeof id !== "string" || !id || id.length > 200) ||
      typeof subject !== "string" || !subject.trim() || subject.length > 300) {
    return { ok: false, error: "Destinatari o oggetto non validi." };
  }
  const ids = [...new Set(ticketIds)];
  const { data, error: ticketsError } = await getGestionaleDb()
    .from("ticket_tailor_issued_tickets")
    .select("ticket_tailor_issued_ticket_id,status,holder_email")
    .eq("ticket_tailor_event_id", event.ticketTailorEventId)
    .in("ticket_tailor_issued_ticket_id", ids);
  if (ticketsError || data?.length !== ids.length ||
      data.some((row) => !isActivePeonyTicket(row.status) || !row.holder_email?.includes("@"))) {
    return { ok: false, error: "Alcuni biglietti non sono validi o non hanno email." };
  }
  const { error } = await getGestionaleDb().from("gw_peony_email_sends")
    .upsert(ids.map((id) => ({
      event_id: eventId, ticket_id: id,
      kind, subject: subject.trim(), sent_on: todayInRome(), created_by: operator.id,
    })), { onConflict: "event_id,ticket_id,kind,subject,sent_on", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Impossibile registrare le email inviate." };
  refreshGestione();
  return { ok: true };
}


export type PeonyPartnerCandidate = {
  kind: "member" | "person";
  id: string;
  name: string;
  email: string | null;
  origin: "Libro soci" | "Modulo Google" | "Conferma manuale" | "Anagrafica" | "Libro soci + modulo";
  membership: "valid" | "payment_missing" | "missing_form" | null;
};
export type PartnerSearchResult =
  | { ok: true; candidates: PeonyPartnerCandidate[] }
  | { ok: false; error: string };

const safeName = (first: string | null, last: string | null, nick?: string | null) =>
  cleanPartnerName([first,last].filter(Boolean).join(" ")) || cleanPartnerName(nick) || null;

async function readCandidates(eventId: string) {
  const event=await getPeonyEvent(eventId);
  if(!event)return null;
  const [evidence,peopleResponse]=await Promise.all([
    readAllMemberEvidence(),
    getGestionaleDb().from("gw_people").select("id,first_name,last_name,nickname,email")
      .is("deleted_at",null).is("merged_into",null).range(0,9999),
  ]);
  if(peopleResponse.error)throw new Error("Anagrafica non disponibile.");
  return {event,evidence,candidates:buildPeonyMemberDirectory(evidence,peopleResponse.data??[])};
}

/** Elenco soci, moduli e anagrafica con le fonti già deduplicate. */
export async function searchPeonyPartnerAction(eventId: string, query: string): Promise<PartnerSearchResult> {
  await requireAdmin();
  if(typeof query!=="string"||query.trim().length<2||query.length>120)
    return {ok:false,error:"Scrivi almeno due caratteri di nome, cognome o email."};
  try {
    const directory=await readCandidates(eventId);
    if(!directory)return {ok:false,error:"Evento non disponibile."};
    return {ok:true,candidates:filterPeonyMemberDirectory(directory.candidates,query).map(candidate=>({
      ...candidate,
      membership:associationStatus(directory.evidence,directory.event,{
        email:candidate.email,
        firstName:candidate.name,
        lastName:null,
      })?.status??null,
    }))};
  } catch(error) {
    console.error("Gestionale: ricerca associativa non disponibile",error instanceof Error?error.message:"errore");
    return {ok:false,error:"Impossibile cercare nell'anagrafica soci. Riprova."};
  }
}

export async function savePeonyPartnerAction(
  eventId: string, ticketId: string,
  selected: { kind:"member"|"person"; id:string } | { kind:"provisional"; name:string; email:string } | null,
): Promise<PeonyActionResult> {
  const operator=await requireAdmin();
  const event=await getPeonyEvent(eventId);
  if(!event || typeof ticketId!=="string" || ticketId.length<1 || ticketId.length>200)
    return {ok:false,error:"Iscrizione non valida."};
  if(selected !== null && (
    !selected || !["person","member","provisional"].includes(selected.kind) ||
    (selected.kind!=="provisional" && !isUuidLike(selected.id)) ||
    (selected.kind==="provisional" &&
      (typeof selected.name!=="string" || typeof selected.email!=="string" ||
        selected.name.length>220 || selected.email.length>320))
  )) return {ok:false,error:"Dati del partner non validi."};
  const db=getGestionaleDb();
  const {data:ticket,error:ticketError}=await db.from("ticket_tailor_issued_tickets")
    .select("ticket_tailor_issued_ticket_id,holder_first_name,holder_last_name,holder_email,ticket_type_name,status")
    .eq("ticket_tailor_event_id",event.ticketTailorEventId)
    .eq("ticket_tailor_issued_ticket_id",ticketId).maybeSingle();
  if(ticketError||!ticket||!isActivePeonyTicket(ticket.status))
    return {ok:false,error:"Il biglietto non è attivo o non è presente."};
  const { peonyPartnerRequired }=await import("@/lib/gestionale/peony-partner");
  if(!peonyPartnerRequired(event.title,ticket.ticket_type_name))
    return {ok:false,error:"Questo biglietto non prevede il partner."};

  let partnerName:string|null=null;
  let partnerEmail:string|null=null;
  let personId:string|null=null;
  let memberRowId:string|null=null;
  if(selected?.kind==="member"){
    const directory=await readCandidates(eventId);
    const candidate=directory?.candidates.find(c=>c.kind==="member"&&c.id===selected.id);
    if(!candidate)return {ok:false,error:"Socio non trovato. Ripeti la ricerca."};
    partnerName=candidate.name;
    partnerEmail=candidate.email;
    memberRowId=candidate.id;
  }else if(selected?.kind==="person"){
    const {data:row,error}=await db.from("gw_people")
      .select("id,first_name,last_name,nickname,email")
      .eq("id",selected.id).is("deleted_at",null).is("merged_into",null).maybeSingle();
    if(error||!row)return {ok:false,error:"Persona non trovata. Ripeti la ricerca."};
    partnerName=safeName(row.first_name,row.last_name,row.nickname);
    partnerEmail=cleanPartnerEmail(row.email);
    personId=row.id;
  }else if(selected?.kind==="provisional"){
    partnerName=cleanPartnerName(selected.name);
    partnerEmail=cleanPartnerEmail(selected.email);
    if(!partnerEmail && (!partnerName || partnerName.split(/\s+/).length<2))
      return {ok:false,error:"Indica nome e cognome oppure un'email valida."};
    if(selected.email.trim() && !partnerEmail)
      return {ok:false,error:"L'indirizzo email non è valido."};
  }
  if(selected && !partnerName && !partnerEmail)
    return {ok:false,error:"La persona selezionata non ha nome né email."};
  if(selected && (memberRowId || personId)){
    const {data:holder,error:holderError}=await db.from("gw_peony_booking_holders")
      .select("person_id,member_row_id")
      .eq("event_id",event.id).eq("ticket_id",ticketId).maybeSingle();
    if(holderError)return {ok:false,error:"Impossibile verificare l'intestatario collegato."};
    if((memberRowId&&holder?.member_row_id===memberRowId)||
      (personId&&holder?.person_id===personId))
      return {ok:false,error:"L'intestatario e il partner devono essere persone diverse."};
  }
  const ownerName=[ticket.holder_first_name,ticket.holder_last_name].filter(Boolean).join(" ");
  if(selected && isSameParticipant({name:ownerName,email:ticket.holder_email},
      {name:partnerName??"",email:partnerEmail}))
    return {ok:false,error:"L'intestatario non può essere il proprio partner."};

  const {error}=await db.from("gw_peony_booking_partners").upsert({
    event_id:event.id, ticket_id:ticket.ticket_tailor_issued_ticket_id,
    partner_name:partnerName,partner_email:partnerEmail,
    person_id:personId,member_row_id:memberRowId,updated_by:operator.id,
    updated_at:new Date().toISOString(),
  },{onConflict:"event_id,ticket_id"});
  if(error){
    console.error("Gestionale: salvataggio partner non riuscito",error.code);
    return {ok:false,error:"Non riesco a salvare il partner. Riprova."};
  }
  refreshGestione();
  return {ok:true};
}


/** Un collegamento dell'intestatario non cambia nome/email del biglietto TT.
 * È separato dall'eventuale collegamento del partner. */
export async function savePeonyHolderAction(
  eventId:string, ticketId:string,
  selected:{kind:"member"|"person";id:string}|null,
):Promise<PeonyActionResult>{
  const operator=await requireAdmin();
  const event=await getPeonyEvent(eventId);
  if(!event||typeof ticketId!=="string"||!ticketId||ticketId.length>200)
    return {ok:false,error:"Iscrizione non disponibile."};
  if(selected&&(!["member","person"].includes(selected.kind)||!isUuidLike(selected.id)))
    return {ok:false,error:"Seleziona una persona dall'anagrafica."};
  const db=getGestionaleDb();
  const {data:ticket,error:ticketError}=await db.from("ticket_tailor_issued_tickets")
    .select("ticket_tailor_issued_ticket_id,status,holder_first_name,holder_last_name,holder_email")
    .eq("ticket_tailor_event_id",event.ticketTailorEventId)
    .eq("ticket_tailor_issued_ticket_id",ticketId).maybeSingle();
  if(ticketError||!ticket||!isActivePeonyTicket(ticket.status))
    return {ok:false,error:"Biglietto assente o non attivo."};
  if(!selected){
    const {error}=await db.from("gw_peony_booking_holders")
      .delete().eq("event_id",eventId).eq("ticket_id",ticketId);
    if(error)return {ok:false,error:"Impossibile annullare l'abbinamento."};
    refreshGestione();
    return {ok:true};
  }
  let name:string|null=null,email:string|null=null;
  let memberId:string|null=null,personId:string|null=null;
  if(selected.kind==="member"){
    const directory=await readCandidates(eventId);
    const candidate=directory?.candidates.find(c=>c.kind==="member"&&c.id===selected.id);
    if(!candidate)return {ok:false,error:"Socio non trovato. Ripeti la ricerca."};
    memberId=candidate.id;name=candidate.name;email=candidate.email;
  }else{
    const {data:person,error}=await db.from("gw_people")
      .select("id,first_name,last_name,nickname,email")
      .eq("id",selected.id).is("deleted_at",null).is("merged_into",null).maybeSingle();
    if(error||!person)return {ok:false,error:"Persona non trovata. Ripeti la ricerca."};
    personId=person.id;name=safeName(person.first_name,person.last_name,person.nickname);
    email=cleanPartnerEmail(person.email);
  }
  if(!name&&!email)return {ok:false,error:"La scheda selezionata non ha dati identificativi."};
  const {data:linkedPartner,error:partnerError}=await db.from("gw_peony_booking_partners")
    .select("person_id,member_row_id")
    .eq("event_id",event.id).eq("ticket_id",ticketId).maybeSingle();
  if(partnerError)return {ok:false,error:"Impossibile verificare il partner collegato."};
  if((memberId&&linkedPartner?.member_row_id===memberId)||
      (personId&&linkedPartner?.person_id===personId))
    return {ok:false,error:"L'intestatario e il partner devono essere persone diverse."};
  const {error}=await db.from("gw_peony_booking_holders").upsert({
    event_id:eventId,ticket_id:ticketId,person_id:personId,member_row_id:memberId,
    updated_by:operator.id,updated_at:new Date().toISOString(),
  },{onConflict:"event_id,ticket_id"});
  if(error){
    console.error("Gestionale: errore abbinamento intestatario",error.code);
    return {ok:false,error:"Non riesco a salvare l'abbinamento."};
  }
  refreshGestione();
  return {ok:true};
}
