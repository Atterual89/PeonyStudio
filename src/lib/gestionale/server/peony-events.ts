import "server-only";

import { cache } from "react";

import { deriveMembershipState, normalizeMembershipEmail, type MembershipEvidenceRow } from "@/lib/association/membership-state";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { partnerFromCheckout, peonyPartnerRequired, type CheckoutPartner } from "@/lib/gestionale/peony-partner";
import { timestampToRomeDate } from "@/lib/gestionale/workshops";
import { isActivePeonyTicket, isPeonyTicketEvent } from "@/lib/gestionale/peony-ticket-rules";
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
  matchMethod: "email" | "name" | "manual" | null;
  /** Le verifiche riflettono i dati gia' sincronizzati; non sono interrogazioni Google live. */
};

export type PeonyPartner = {
  name: string | null;
  email: string | null;
  source: "ticket_tailor" | "user" | "admin";
  membership: PeonyMembership | null;
};

export type PeonyAttendee = {
  id: string;
  ticketId: string;
  orderId: string | null;
  name: string;
  email: string | null;
  ticketType: string | null;
  notes: string | null;
  association: PeonyMembership | null;
  associationRequired: boolean;
  partnerRequired: boolean;
  partner: PeonyPartner | null;
  linkedPersonId: string | null;
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
  const ids = events.map((event) => event.ticketTailorEventId);
  const counts = new Map<string, number>();
  const freshness = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await getGestionaleDb().from("ticket_tailor_issued_tickets")
      .select("ticket_tailor_event_id,status,last_synced_at")
      .in("ticket_tailor_event_id", ids.slice(i, i + 100))
      .range(0, 9999);
    if (error) throw new Error(`Biglietti Ticket Tailor: ${error.message}`);
    for (const ticket of data ?? []) {
      const key = ticket.ticket_tailor_event_id;
      if (!key) continue;
      if (isActivePeonyTicket(ticket.status)) counts.set(key, (counts.get(key) ?? 0) + 1);
      if (ticket.last_synced_at && (!freshness.get(key) || freshness.get(key)! < ticket.last_synced_at)) {
        freshness.set(key, ticket.last_synced_at);
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

function associationStatus(
  evidence: MembershipEvidenceRow[],
  event: PeonyEvent,
  identity: { email?: string | null; firstName?: string | null; lastName?: string | null },
): PeonyMembership | null {
  const period = membershipPeriodFor(event.startsOn ?? "");
  if (!period || evidence.length === 0) return null;
  const state = deriveMembershipState(evidence, identity, {
    paymentsFrom: period.paymentsFrom,
    paymentsUntil: period.validUntil,
  });
  return {
    status: state.status,
    formPresent: state.formPresent,
    feePaid: state.currentYearPaid,
    expiresAt: state.membershipExpiresAt,
    matchMethod: state.paymentMatchMethod,
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

async function readAllMemberEvidence(): Promise<Array<MembershipEvidenceRow & { updated_at: string | null }>> {
  const rows: Array<MembershipEvidenceRow & { updated_at: string | null }> = [];
  const db = getGestionaleDb();
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await db.from("association_members")
      .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,updated_at")
      .order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error(`Associazione: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 500) break;
  }
  return rows;
}

export async function loadPeonyAttendees(event: PeonyEvent): Promise<PeonyRoster> {
  await requireAdmin();
  const db = getGestionaleDb();
  const [tickets, participants, memberships, people, enrollments, orders] = await Promise.all([
    db.from("ticket_tailor_issued_tickets")
      .select("ticket_tailor_issued_ticket_id,ticket_tailor_order_id,holder_first_name,holder_last_name,holder_email,ticket_type_name,status,last_synced_at")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId).range(0, 9999),
    db.from("event_participants")
      .select("ticket_tailor_issued_ticket_id,notes_admin")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId)
      .not("ticket_tailor_issued_ticket_id", "is", null).range(0, 9999),
    readAllMemberEvidence(),
    db.from("gw_people").select("id,email")
      .is("deleted_at", null).is("merged_into", null).range(0, 9999),
    db.from("user_event_enrollments")
      .select("ticket_tailor_order_id,partner_source,partner_email,partner_name")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId).range(0, 9999),
    db.from("ticket_tailor_orders")
      .select("ticket_tailor_order_id,raw_payload")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId).range(0, 9999),
  ]);
  for (const [label, response] of [
    ["Biglietti", tickets], ["Partecipanti", participants],
    ["Anagrafica", people],
    ["Partner", enrollments], ["Ordini", orders],
  ] as const) {
    if (response.error) throw new Error(`${label}: ${response.error.message}`);
  }
  const participantByTicket = new Map((participants.data ?? []).map((row) => [row.ticket_tailor_issued_ticket_id, row]));
  const enrollmentByOrder = new Map((enrollments.data ?? []).filter((r) => r.ticket_tailor_order_id)
    .map((row) => [row.ticket_tailor_order_id, row]));
  const checkoutByOrder = new Map<string, CheckoutPartner | null>();
  for (const order of orders.data ?? []) {
    checkoutByOrder.set(order.ticket_tailor_order_id, partnerFromCheckout(order.raw_payload));
  }
  const evidence = memberships as MembershipEvidenceRow[];
  const peopleByEmail = new Map<string, string | null>();
  for (const person of people.data ?? []) {
    const email = normalizeMembershipEmail(person.email);
    if (!email || !email.includes("@")) continue;
    peopleByEmail.set(email, peopleByEmail.has(email) ? null : person.id);
  }
  const attendees = (tickets.data ?? [])
    .filter((ticket) => isActivePeonyTicket(ticket.status))
    .map((ticket): PeonyAttendee => {
      const orderId = ticket.ticket_tailor_order_id;
      const saved = orderId ? enrollmentByOrder.get(orderId) : undefined;
      const fromCheckout = orderId ? checkoutByOrder.get(orderId) : null;
      // Le correzioni effettuate nella vecchia Admin hanno precedenza;
      // se la Admin non ne conosce uno, usare il dato del checkout TT.
      const name = saved?.partner_name?.trim() || fromCheckout?.name || null;
      const email = saved?.partner_email?.trim() || fromCheckout?.email || null;
      const required = peonyPartnerRequired(event.title, ticket.ticket_type_name);
      const partner: PeonyPartner | null = required && (name || email)
        ? {
            name, email,
            source: saved?.partner_source === "admin" || saved?.partner_source === "user"
              ? saved.partner_source : "ticket_tailor",
            membership: associationStatus(evidence, event, partnerIdentity(name, email)),
          }
        : null;
      const identity = {
        email: ticket.holder_email,
        firstName: ticket.holder_first_name,
        lastName: ticket.holder_last_name,
      };
      return {
        id: ticket.ticket_tailor_issued_ticket_id,
        ticketId: ticket.ticket_tailor_issued_ticket_id,
        orderId,
        name: [ticket.holder_first_name, ticket.holder_last_name].filter(Boolean).join(" ").trim() || "Intestatario non indicato",
        email: ticket.holder_email?.trim() || null,
        ticketType: ticket.ticket_type_name || null,
        notes: participantByTicket.get(ticket.ticket_tailor_issued_ticket_id)?.notes_admin ?? null,
        association: /(observer|osservator)/i.test(ticket.ticket_type_name ?? "")
          ? null : associationStatus(evidence, event, identity),
        associationRequired: !/(observer|osservator)/i.test(ticket.ticket_type_name ?? ""),
        partnerRequired: required,
        partner,
        linkedPersonId: peopleByEmail.get(normalizeMembershipEmail(ticket.holder_email)) ?? null,
      };
    }).sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
  return {
    attendees,
    ticketsLastSyncedAt: (tickets.data ?? []).map((t) => t.last_synced_at).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null,
    associationLastSyncedAt: memberships
      .map((m) => m.updated_at).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null,
  };
}


/** Solo intestatari e partner dei prossimi eventi. Evita di rileggere
 * l'intero libro soci una volta per ogni workshop. */
export type UpcomingPeonyGroup = {
  key: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  href: string;
  people: { key: string; name: string; email: string | null; observer: boolean }[];
};

export async function loadUpcomingPeonyPeople(today: string): Promise<UpcomingPeonyGroup[]> {
  await requireAdmin();
  const upcoming = (await loadEvents())
    .filter((event) => event.startsOn && (event.endsOn ?? event.startsOn) >= today)
    .sort((a, b) => (a.startsOn ?? "").localeCompare(b.startsOn ?? ""));
  if (!upcoming.length) return [];
  const db = getGestionaleDb();
  const readBatched = async (table: "ticket_tailor_issued_tickets" | "ticket_tailor_orders" | "user_event_enrollments",
    columns: string, field: string, values: string[]) => {
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < values.length; i += 80) {
      const batch = values.slice(i, i + 80);
      for (let offset = 0; offset < 10000; offset += 500) {
        const result = await db.from(table).select(columns).in(field, batch).range(offset, offset + 499);
        if (result.error) throw new Error(`Prossimi workshop: lettura ${table} non riuscita.`);
        rows.push(...((result.data ?? []) as unknown as Record<string, unknown>[]));
        if ((result.data ?? []).length < 500) break;
      }
    }
    return rows;
  };
  const ids = upcoming.map((event) => event.ticketTailorEventId);
  const ticketRows = await readBatched(
    "ticket_tailor_issued_tickets",
    "ticket_tailor_event_id,ticket_tailor_issued_ticket_id,ticket_tailor_order_id,holder_first_name,holder_last_name,holder_email,ticket_type_name,status",
    "ticket_tailor_event_id", ids,
  );
  const active = ticketRows.filter((row) => isActivePeonyTicket(typeof row.status === "string" ? row.status : null));
  const orderIds = [...new Set(active.map((row) => row.ticket_tailor_order_id).filter((id): id is string => typeof id === "string" && Boolean(id)))];
  const [enrollments, orders] = orderIds.length ? await Promise.all([
    readBatched("user_event_enrollments","ticket_tailor_order_id,partner_source,partner_email,partner_name","ticket_tailor_order_id",orderIds),
    readBatched("ticket_tailor_orders","ticket_tailor_order_id,raw_payload","ticket_tailor_order_id",orderIds),
  ]) : [[], []];
  const byOrder = new Map(enrollments.map((row) => [String(row.ticket_tailor_order_id), row]));
  const checkoutByOrder = new Map(orders.map((row) => [String(row.ticket_tailor_order_id), partnerFromCheckout(row.raw_payload)]));
  return upcoming.map((event) => {
    const people = new Map<string, UpcomingPeonyGroup["people"][number]>();
    function add(name: string, email: string | null, observer: boolean) {
      const safeName = name.trim() || email || "Nome da completare";
      const normalizedEmail = normalizeMembershipEmail(email);
      const key = normalizedEmail ? `e:${normalizedEmail}` : `n:${safeName.toLocaleLowerCase("it")}`;
      if (!people.has(key)) people.set(key, { key, name: safeName, email, observer });
      else if (!observer) people.get(key)!.observer = false;
    }
    for (const row of active) {
      if (row.ticket_tailor_event_id !== event.ticketTailorEventId) continue;
      const ticketName = [row.holder_first_name, row.holder_last_name].filter(Boolean).join(" ").trim();
      const email = typeof row.holder_email === "string" ? row.holder_email.trim() || null : null;
      const ticketType = typeof row.ticket_type_name === "string" ? row.ticket_type_name : null;
      const observer = /(observer|osservator)/i.test(ticketType ?? "");
      add(ticketName, email, observer);
      if (!peonyPartnerRequired(event.title, ticketType)) continue;
      const orderId = typeof row.ticket_tailor_order_id === "string" ? row.ticket_tailor_order_id : "";
      const fromAdmin = byOrder.get(orderId);
      const fromCheckout = checkoutByOrder.get(orderId);
      const partnerName = typeof fromAdmin?.partner_name === "string" && fromAdmin.partner_name.trim()
        ? fromAdmin.partner_name.trim() : fromCheckout?.name ?? null;
      const partnerEmail = typeof fromAdmin?.partner_email === "string" && fromAdmin.partner_email.trim()
        ? fromAdmin.partner_email.trim() : fromCheckout?.email ?? null;
      if (partnerName || partnerEmail) add(partnerName ?? "", partnerEmail, false);
    }
    return {
      key: `peony:${event.id}`,
      title: event.title,
      startsOn: event.startsOn!,
      endsOn: event.endsOn,
      href: `/gestione/peony/${event.id}`,
      people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "it")),
    };
  }).filter((event) => event.people.length > 0);
}
