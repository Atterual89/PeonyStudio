import "server-only";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { resolveCentralPerson, type CentralPerson } from "@/lib/gestionale/central-person-resolution";
import { isActivePeonyTicket,isPeonyTicketEvent } from "@/lib/gestionale/peony-ticket-rules";
import { timestampToRomeDate } from "@/lib/gestionale/workshops";
import type { Person } from "@/lib/gestionale/types";

export type PeonyPersonHistoryRow={
  ticketId:string;
  eventId:string;
  title:string;
  startsOn:string;
  role:"intestatario"|"partner";
  originalName:string|null;
  href:string;
};

/** Partecipazioni Peony della persona canonica, senza usare email del
 * compratore come collegamento implicito per il partner.
 * Non crea né unisce schede; il dato del ticket resta immutato.
 */
export async function loadPeonyPersonHistory(
  person:Person, allPeople:readonly Person[],
):Promise<PeonyPersonHistoryRow[]>{
  await requireAdmin();
  const db=getGestionaleDb();
  const [holders,partners,ticketEmailMatches]=await Promise.all([
    db.from("gw_peony_booking_holders")
      .select("event_id,ticket_id,person_id,member_row_id").range(0,9999),
    db.from("gw_peony_booking_partners")
      .select("event_id,ticket_id,person_id,member_row_id,partner_name,partner_email").range(0,9999),
    person.email?db.from("ticket_tailor_issued_tickets")
      .select("ticket_tailor_issued_ticket_id,ticket_tailor_event_id,holder_first_name,holder_last_name,holder_email,status")
      .ilike("holder_email",person.email).range(0,9999):
      Promise.resolve({data:[],error:null}),
  ]);
  if(holders.error||partners.error||ticketEmailMatches.error)
    throw new Error("Partecipazioni Peony non disponibili.");
  const holderLinks=holders.data??[],partnerLinks=partners.data??[];
  const ids=[...new Set([...holderLinks,...partnerLinks].map(row=>row.ticket_id))];
  const linkedTickets=ids.length?await db.from("ticket_tailor_issued_tickets")
    .select("ticket_tailor_issued_ticket_id,ticket_tailor_event_id,holder_first_name,holder_last_name,holder_email,status")
    .in("ticket_tailor_issued_ticket_id",ids.slice(0,10000)).range(0,9999):
    {data:[],error:null};
  if(linkedTickets.error)throw new Error("Biglietti collegati non disponibili.");

  const tickets=new Map<string,{
    ticket_tailor_issued_ticket_id:string;ticket_tailor_event_id:string|null;
    holder_first_name:string|null;holder_last_name:string|null;holder_email:string|null;status:string|null;
  }>();
  for(const ticket of [...(ticketEmailMatches.data??[]),...(linkedTickets.data??[])])
    tickets.set(ticket.ticket_tailor_issued_ticket_id,ticket);
  if(!tickets.size)return [];

  const usedEventIds=[...new Set([...tickets.values()].map(t=>t.ticket_tailor_event_id).filter((id):id is string=>Boolean(id)))];
  if(!usedEventIds.length)return [];
  const eventResult=await db.from("events")
    .select("id,title,starts_at,ends_at,ticket_tailor_event_id,category,source")
    .in("ticket_tailor_event_id",usedEventIds.slice(0,10000)).range(0,9999);
  if(eventResult.error)throw new Error("Eventi Peony non disponibili.");
  const eventMap=new Map((eventResult.data??[]).filter(e=>isPeonyTicketEvent(e))
    .map(e=>[e.ticket_tailor_event_id,e]));

  const memberIds=[...new Set([...holderLinks,...partnerLinks]
    .map(row=>row.member_row_id).filter((id):id is string=>Boolean(id)))];
  const members=memberIds.length?await db.from("association_members")
    .select("id,first_name,last_name,email").in("id",memberIds.slice(0,10000)).range(0,9999):
    {data:[],error:null};
  if(members.error)throw new Error("Abbinamenti soci non disponibili.");
  const evidence=members.data??[];
  const people:CentralPerson[]=allPeople.filter(p=>!p.merged_into);
  const holderByTicket=new Map(holderLinks.map(row=>[row.ticket_id,row]));
  const partnerByTicket=new Map(partnerLinks.map(row=>[row.ticket_id,row]));
  const history:PeonyPersonHistoryRow[]=[];
  for(const ticket of tickets.values()){
    if(!isActivePeonyTicket(ticket.status))continue;
    const event=eventMap.get(ticket.ticket_tailor_event_id);
    if(!event||!event.starts_at)continue;
    const name=[ticket.holder_first_name,ticket.holder_last_name].filter(Boolean).join(" ").trim();
    const holder=holderByTicket.get(ticket.ticket_tailor_issued_ticket_id);
    const holderMatch=resolveCentralPerson({people,memberEvidence:evidence,
      explicitPersonId:holder?.person_id,memberRowId:holder?.member_row_id,
      ticketName:name,ticketEmail:ticket.holder_email});
    const partner=partnerByTicket.get(ticket.ticket_tailor_issued_ticket_id);
    const partnerMatch=partner?resolveCentralPerson({people,memberEvidence:evidence,
      explicitPersonId:partner.person_id,memberRowId:partner.member_row_id,
      ticketName:partner.partner_name,ticketEmail:partner.partner_email}):null;
    const role=holderMatch?.personId===person.id?"intestatario":
      partnerMatch?.personId===person.id?"partner":null;
    if(!role)continue;
    history.push({
      ticketId:ticket.ticket_tailor_issued_ticket_id,
      eventId:event.id,
      title:event.title,
      startsOn:timestampToRomeDate(event.starts_at)??event.starts_at.slice(0,10),
      role,originalName:role==="intestatario"?name:partner?.partner_name??null,
      href:`/gestione/peony/${event.id}?ticket=${encodeURIComponent(ticket.ticket_tailor_issued_ticket_id)}`,
    });
  }
  return history.sort((a,b)=>b.startsOn.localeCompare(a.startsOn)||a.ticketId.localeCompare(b.ticketId));
}
