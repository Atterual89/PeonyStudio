import "server-only";

import { cache } from "react";

import { deriveMembershipState, normalizeMembershipEmail, normalizeMembershipNameKey, type MembershipEvidenceRow } from "@/lib/association/membership-state";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { partnerFromCheckout, peonyPartnerRequired, type CheckoutPartner } from "@/lib/gestionale/peony-partner";
import { choosePartner } from "@/lib/gestionale/peony-booking-partner";
import { buildPeonyMemberDirectory } from "@/lib/gestionale/peony-member-candidates";
import { identityForLinkedPeonyAttendee } from "@/lib/gestionale/peony-linked-identity";
import { resolveCentralPerson } from "@/lib/gestionale/central-person-resolution";
import { ticketTailorCreatedAt, compareTicketChronology } from "@/lib/gestionale/ticket-order-chronology";
import { timestampToRomeDate } from "@/lib/gestionale/workshops";
import { isActivePeonyTicket, isPeonyTicketEvent, isMembershipFreePeonyEvent, peonyAssociationRequired } from "@/lib/gestionale/peony-ticket-rules";
import { peonyTicketRole, ticketTypeNameForIssuedTicket, ticketTypeNamesFromEventPayload, type PeonyTicketRole } from "@/lib/gestionale/peony-ticket-type";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { isUuidLike } from "@/lib/gestionale/validation";

export { isActivePeonyTicket } from "@/lib/gestionale/peony-ticket-rules";

export type PeonyEvent = {
  id: string;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  ticketTailorEventId: string;
  category: string | null;
};
export type PeonyEventSummary = PeonyEvent & { ticketCount: number; ticketsLastSyncedAt: string | null };

export type PeonyMembership = {
  status: "valid" | "payment_missing" | "missing_form";
  formPresent: boolean;
  feePaid: boolean;
  expiresAt: string | null;
  matchMethod: "email" | "name" | "manual" | "payment_email" | null;
  verifiedInOfficialBook: boolean;
  /** Le verifiche riflettono i dati gia' sincronizzati; non sono interrogazioni Google live. */
};

export type PeonyPartner = {
  name: string | null;
  /** Testo originale del partner in TT/gestionale, senza sovrascrivere il nome ufficiale. */
  enteredName?:string|null;
  email: string | null;
  source: "ticket_tailor" | "user" | "admin" | "gestionale";
  membership: PeonyMembership | null;
  linkedPersonId: string | null;
  /** Email del profilo canonico; distinta dal recapito inserito sul biglietto. */
  profileEmail?: string | null;
  profileAlias?: string | null;
  memberRowId: string | null;
};

export type PeonyAttendee = {
  id: string;
  ticketId: string;
  orderId: string | null;
  name: string;
  /** Nome originale immutabile di Ticket Tailor, distinto dal profilo ufficiale. */
  enteredName?: string;
  /** Recapito del biglietto, usato per le comunicazioni Ticket Tailor. */
  email: string | null;
  /** Email nella scheda gw_people: non ricavare automaticamente dal compratore. */
  profileEmail?: string | null;
  profileAlias?: string | null;
  createdAt?: string | null;
  ticketType: string | null;
  ticketRole: PeonyTicketRole;
  freeEvent: boolean;
  notes: string | null;
  association: PeonyMembership | null;
  associationRequired: boolean;
  partnerRequired: boolean;
  partner: PeonyPartner | null;
  linkedPersonId: string | null;
  holderMatch: {name:string;email:string|null;origin:string}|null;
};
export type PeonyRoster = {
  attendees: PeonyAttendee[];
  ticketsLastSyncedAt: string | null;
  associationLastSyncedAt: string | null;
};

type EventRow = {
  id: string; title: string; starts_at: string | null; ends_at: string | null;
  ticket_tailor_event_id: string | null; category: string | null; source: string | null;
};

function toPeonyEvent(row: EventRow): PeonyEvent | null {
  if (!isPeonyTicketEvent(row) || !row.ticket_tailor_event_id) return null;
  return {
    id: row.id, title: row.title,
    startsOn: timestampToRomeDate(row.starts_at),
    endsOn: timestampToRomeDate(row.ends_at),
    ticketTailorEventId: row.ticket_tailor_event_id,
    category: row.category,
  };
}

/** Workshop LuXuria non si importano mai come biglietti Ticket Tailor. */
const loadEvents = cache(async (): Promise<PeonyEvent[]> => {
  const { data, error } = await getGestionaleDb().from("events")
    .select("id,title,starts_at,ends_at,ticket_tailor_event_id,category,source")
    .eq("source", "ticket_tailor")
    .not("ticket_tailor_event_id", "is", null)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .range(0, 9999);
  if (error) throw new Error(`Eventi Peony: ${error.message}`);
  return ((data ?? []) as EventRow[]).map(toPeonyEvent).filter((row): row is PeonyEvent => row !== null);
});

export async function loadPeonyEventsSummary(): Promise<PeonyEventSummary[]> {
  await requireAdmin();
  const events = await loadEvents();
  if (events.length === 0) return [];
  // Single SQL aggregate: do not transfer every ticket row on each dashboard visit.
  const {data, error: summaryError}=await getGestionaleDb().rpc("gw_peony_ticket_summary");
  const counts = new Map<string, number>();
  const freshness = new Map<string, string>();
  if (!summaryError) {
    for(const row of data ?? []) {
      if(!row.ticket_tailor_event_id) continue;
      counts.set(row.ticket_tailor_event_id, Number(row.ticket_count ?? 0));
      if(row.last_synced_at)freshness.set(row.ticket_tailor_event_id,row.last_synced_at);
    }
  } else {
    // Safe deployment order: the existing dashboard keeps working until the
    // migration and PostgREST schema reload complete.
    console.warn("[gestionale] Riepilogo SQL non ancora disponibile; uso conteggio precedente.");
    const ids=events.map(event=>event.ticketTailorEventId);
    for(let i=0;i<ids.length;i+=100) {
      const {data:rows,error}=await getGestionaleDb().from("ticket_tailor_issued_tickets")
        .select("ticket_tailor_event_id,status,last_synced_at")
        .in("ticket_tailor_event_id",ids.slice(i,i+100)).range(0,9999);
      if(error)throw new Error(`Biglietti Ticket Tailor: ${error.message}`);
      for(const row of rows??[]) {
        const key=row.ticket_tailor_event_id;
        if(!key)continue;
        if(isActivePeonyTicket(row.status)) counts.set(key,(counts.get(key)??0)+1);
        if(row.last_synced_at&&(!freshness.get(key)||freshness.get(key)!<row.last_synced_at))
          freshness.set(key,row.last_synced_at);
      }
    }
  }
  return events.map((event) => ({
    ...event, ticketCount: counts.get(event.ticketTailorEventId) ?? 0,
    ticketsLastSyncedAt: freshness.get(event.ticketTailorEventId) ?? null,
  }));
}

export async function getPeonyEvent(id: string): Promise<PeonyEvent | null> {
  await requireAdmin();
  if (!isUuidLike(id)) return null;
  return (await loadEvents()).find((event) => event.id === id) ?? null;
}

export function associationStatus(
  evidence: MembershipEvidenceRow[],
  event: PeonyEvent,
  identity: { email?: string | null; firstName?: string | null; lastName?: string | null },
): PeonyMembership | null {
  const period = membershipPeriodFor(event.startsOn ?? "");
  if (!period || evidence.length === 0) return null;
  const state = deriveMembershipState(evidence, identity, {
    paymentsFrom: period.paymentsFrom,
    paymentsUntil: period.validUntil,
    referenceDate: event.startsOn ?? undefined,
  });
  return {
    status: state.status,
    formPresent: state.formPresent,
    feePaid: state.currentYearPaid,
    expiresAt: state.membershipExpiresAt,
    matchMethod: state.paymentMatchMethod,
    verifiedInOfficialBook: state.verifiedInOfficialBook,
  };
}

function partnerIdentity(name: string | null, email: string | null) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    email,
    firstName: words.length >= 2 ? words.slice(0, -1).join(" ") : null,
    lastName: words.length >= 2 ? words[words.length - 1] : null,
  };
}

export const readAllMemberEvidence = cache(async (): Promise<Array<MembershipEvidenceRow & { id: string; updated_at: string | null }>> => {
  const rows: Array<MembershipEvidenceRow & { id: string; updated_at: string | null }> = [];
  const db = getGestionaleDb();
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await db.from("association_members")
      .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,notes_admin,updated_at")
      .in("source", ["google_sheet", "manual_override", "official_members_book"])
      .order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error(`Associazione: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  return rows;
});

export async function loadPeonyAttendees(event: PeonyEvent): Promise<PeonyRoster> {
  await requireAdmin();
  const db = getGestionaleDb();
  const [tickets, participants, memberships, people, enrollments, orders, overrides, holderOverrides, rawEvent] = await Promise.all([
    db.from("ticket_tailor_issued_tickets")
      .select("ticket_tailor_issued_ticket_id,ticket_tailor_order_id,holder_first_name,holder_last_name,holder_email,ticket_type_name,raw_payload,status,last_synced_at")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId).range(0, 9999),
    db.from("event_participants")
      .select("ticket_tailor_issued_ticket_id,notes_admin")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId)
      .not("ticket_tailor_issued_ticket_id", "is", null).range(0, 9999),
    readAllMemberEvidence(),
    db.from("gw_people").select("id,first_name,last_name,nickname,email,membership_name_key,membership_email,association_member_id")
      .is("deleted_at",null).is("merged_into",null)
      .is("deleted_at", null).is("merged_into", null).range(0, 9999),
    db.from("user_event_enrollments")
      .select("ticket_tailor_order_id,partner_source,partner_email,partner_name")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId).range(0, 9999),
    db.from("ticket_tailor_orders")
      .select("ticket_tailor_order_id,raw_payload")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId).range(0, 9999),
    db.from("gw_peony_booking_partners")
      .select("ticket_id,partner_name,partner_email,person_id,member_row_id")
      .eq("event_id", event.id).range(0, 9999),
    db.from("gw_peony_booking_holders")
      .select("ticket_id,person_id,member_row_id")
      .eq("event_id",event.id).range(0,9999),
    db.from("events").select("raw_payload").eq("id",event.id).maybeSingle(),
  ]);
  for (const [label, response] of [
    ["Biglietti", tickets], ["Partecipanti", participants],
    ["Anagrafica", people],
    ["Partner", enrollments], ["Ordini", orders], ["Abbinamenti partner", overrides],
    ["Abbinamenti intestatario",holderOverrides],["Tipi biglietto",rawEvent],
  ] as const) {
    if (response.error) throw new Error(`${label}: ${response.error.message}`);
  }
  const ticketNames=ticketTypeNamesFromEventPayload(rawEvent.data?.raw_payload);
  const freeEvent=isMembershipFreePeonyEvent(event.title);
  const participantByTicket = new Map((participants.data ?? []).map((row) => [row.ticket_tailor_issued_ticket_id, row]));
  const enrollmentByOrder = new Map((enrollments.data ?? []).filter((r) => r.ticket_tailor_order_id)
    .map((row) => [row.ticket_tailor_order_id, row]));
  const overrideByTicket = new Map((overrides.data ?? []).map((row) => [row.ticket_id, row]));
  const holderByTicket = new Map((holderOverrides.data??[]).map(row=>[row.ticket_id,row]));
  const checkoutByOrder = new Map<string, CheckoutPartner | null>();
  const purchasedAtByOrder = new Map<string, number | null>();
  for (const order of orders.data ?? []) {
    checkoutByOrder.set(order.ticket_tailor_order_id, partnerFromCheckout(order.raw_payload));
    purchasedAtByOrder.set(order.ticket_tailor_order_id, ticketTailorCreatedAt(order.raw_payload));
  }
  const evidence = memberships;
  const candidates=buildPeonyMemberDirectory(memberships,people.data??[]);
  const memberById=new Map(candidates.filter(candidate=>candidate.kind==="member").map(row=>[row.id,row]));
  const personById=new Map((people.data??[]).map(person=>[person.id,person]));
  // I ticket NON sono un'anagrafica: risolviamo un profilo gw_people soltanto
  // con conferma esplicita o un unico abbinamento dimostrabile.
  const allPeople=people.data??[];
  const allEvidence=memberships;
  const labelFor=(person:(typeof allPeople)[number]|null|undefined,fallback:string)=>{
    if(!person)return {name:fallback,alias:null as string|null};
    const entered=[person.first_name,person.last_name].filter(Boolean).join(" ").trim()
      ||person.nickname||fallback;
    const key=person.membership_name_key;
    const official=evidence.filter(row=>row.source==="official_members_book" &&
      (row.membership_status==="verified"||row.membership_status==="expired") &&
      (row.id===person.association_member_id ||
        Boolean(key&&normalizeMembershipNameKey(row.first_name,row.last_name)===key)));
    const verifiedName=official.length===1
      ?[official[0].first_name,official[0].last_name].filter(Boolean).join(" ").trim():null;
    const name=verifiedName||entered;
    return {name,alias:verifiedName&&verifiedName!==entered?entered:null};
  };
  const attendees = (tickets.data ?? [])
    .filter((ticket) => isActivePeonyTicket(ticket.status))
    .sort((a,b) => compareTicketChronology(
      {id:a.ticket_tailor_issued_ticket_id,
        time:(a.ticket_tailor_order_id?purchasedAtByOrder.get(a.ticket_tailor_order_id):null)
          ??ticketTailorCreatedAt(a.raw_payload)},
      {id:b.ticket_tailor_issued_ticket_id,
        time:(b.ticket_tailor_order_id?purchasedAtByOrder.get(b.ticket_tailor_order_id):null)
          ??ticketTailorCreatedAt(b.raw_payload)},
    ))
    .map((ticket): PeonyAttendee => {
      const orderId = ticket.ticket_tailor_order_id;
      const saved = orderId ? enrollmentByOrder.get(orderId) : undefined;
      const fromCheckout = orderId ? checkoutByOrder.get(orderId) : null;
      // Il collegamento esplicito alla prenotazione prevale su Admin e checkout.
      const chosen = choosePartner(overrideByTicket.get(ticket.ticket_tailor_issued_ticket_id) ?? null,
        saved ?? null, fromCheckout);
      const ticketType=ticketTypeNameForIssuedTicket(ticket.raw_payload,ticketNames,ticket.ticket_type_name);
      const ticketRole=peonyTicketRole(ticketType);
      const required = peonyPartnerRequired(event.title, ticketType);
      const membershipRequired=peonyAssociationRequired(event.title,ticketRole);
      const partnerProfile=required&&chosen?resolveCentralPerson({
        people:allPeople,memberEvidence:allEvidence,
        explicitPersonId:chosen.personId,memberRowId:chosen.memberRowId,
        ticketName:chosen.name,ticketEmail:chosen.email,
      }):null;
      const partnerPerson=partnerProfile?personById.get(partnerProfile.personId):null;
      const partnerDisplay=labelFor(partnerPerson,chosen?.name||"Partner");
      const partner: PeonyPartner | null = required && chosen ? {
        name:partnerDisplay.name,
        profileAlias:partnerDisplay.alias,
        enteredName:chosen.name,
        email:partnerPerson?.email??chosen.email, source: chosen.source,
        linkedPersonId: partnerProfile?.personId??null,
        profileEmail:partnerPerson?.email??null,
        memberRowId: chosen.memberRowId ?? null,
        membership: associationStatus(evidence,event,identityForLinkedPeonyAttendee(
          evidence,partnerPerson,partnerPerson?.membership_name_key||partnerPerson?.membership_email
            ?null:chosen.memberRowId,partnerIdentity(chosen.name,chosen.email),
        )),
      } : null;
      const savedHolder=holderByTicket.get(ticket.ticket_tailor_issued_ticket_id);
      const member=savedHolder?.member_row_id?memberById.get(savedHolder.member_row_id):null;
      const ticketName=[ticket.holder_first_name,ticket.holder_last_name].filter(Boolean).join(" ").trim()||"Intestatario non indicato";
      const resolved=resolveCentralPerson({
        people:allPeople,memberEvidence:allEvidence,
        explicitPersonId:savedHolder?.person_id,memberRowId:savedHolder?.member_row_id,
        ticketName,ticketEmail:ticket.holder_email,
      });
      const person=resolved?personById.get(resolved.personId):null;
      const holderDisplay=labelFor(person,ticketName);
      const purchasedAt=(orderId?purchasedAtByOrder.get(orderId):null)
        ??ticketTailorCreatedAt(ticket.raw_payload);
      const directMember=savedHolder?.member_row_id?evidence.find(row=>row.id===savedHolder.member_row_id):null;
      const matchedHolder=person?{
        name:[person.first_name,person.last_name].filter(Boolean).join(" ").trim()||person.nickname||ticketName,
        email:person.email??null,origin:"Anagrafica",
      }:member?{
        name:member.name,email:member.email,origin:member.origin,
      }:directMember?{
        name:[directMember.first_name,directMember.last_name].filter(Boolean).join(" ").trim()||"Socio",
        email:directMember.email,origin:"Registro associativo",
      }:null;
      const identity = identityForLinkedPeonyAttendee(
        evidence, person,person?.membership_name_key||person?.membership_email
          ?null:savedHolder?.member_row_id,
        matchedHolder ? {email:matchedHolder.email,firstName:matchedHolder.name,lastName:null} : {
          email:ticket.holder_email,firstName:ticket.holder_first_name,lastName:ticket.holder_last_name,
        },
      );
      return {
        id: ticket.ticket_tailor_issued_ticket_id,
        ticketId: ticket.ticket_tailor_issued_ticket_id,
        orderId,
        name:holderDisplay.name,
        profileAlias:holderDisplay.alias,
        enteredName:ticketName,
        email: ticket.holder_email?.trim() || null,
        profileEmail:person?.email??null,
        createdAt:purchasedAt===null||purchasedAt===undefined?null:new Date(purchasedAt).toISOString(),
        ticketType,
        ticketRole,
        freeEvent,
        notes: participantByTicket.get(ticket.ticket_tailor_issued_ticket_id)?.notes_admin ?? null,
        association: associationStatus(evidence, event, identity),
        associationRequired: membershipRequired,
        partnerRequired: required,
        partner,
        holderMatch:matchedHolder,
        linkedPersonId:resolved?.personId??null,
      };
    });
  return {
    attendees,
    ticketsLastSyncedAt: (tickets.data ?? []).map((t) => t.last_synced_at).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null,
    associationLastSyncedAt: memberships
      .map((m) => m.updated_at).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null,
  };
}


/** La pagina Persone e la pagina Evento condividono lo stesso calcolo
 * di partner e stato associativo. Non ricostruire le coppie dai soli nomi. */
export type UpcomingPeonyGroup = {
  key: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  href: string;
  bookings: PeonyAttendee[];
};

export async function loadUpcomingPeonyPeople(today: string): Promise<UpcomingPeonyGroup[]> {
  await requireAdmin();
  const upcoming = (await loadEvents())
    .filter((event) => event.startsOn && (event.endsOn ?? event.startsOn) >= today)
    .sort((a,b) => (a.startsOn ?? "").localeCompare(b.startsOn ?? ""));
  const results: UpcomingPeonyGroup[] = [];
  // Piccoli gruppi per evitare decine di interrogazioni concorrenti.
  for (let start = 0; start < upcoming.length; start += 4) {
    const chunk = upcoming.slice(start, start+4);
    const rosters = await Promise.all(chunk.map((event) => loadPeonyAttendees(event)));
    for (let i=0; i<chunk.length; i++) {
      if (!rosters[i].attendees.length) continue;
      const event = chunk[i];
      results.push({
        key: `peony:${event.id}`, title: event.title,
        startsOn: event.startsOn!, endsOn: event.endsOn,
        href: `/gestione/peony/${event.id}`,
        bookings: rosters[i].attendees,
      });
    }
  }
  return results;
}
