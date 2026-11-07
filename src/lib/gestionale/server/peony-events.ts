import "server-only";

import { cache } from "react";

import { isLuxuriaTitle, timestampToRomeDate } from "@/lib/gestionale/workshops";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { isUuidLike } from "@/lib/gestionale/validation";

export type PeonyEvent = {
  id: string;
  title: string;
  startsOn: string | null;
  endsOn: string | null;
  ticketTailorEventId: string;
  category: string | null;
};

export type PeonyAttendee = {
  id: string;
  ticketId: string;
  orderId: string | null;
  name: string;
  email: string | null;
  ticketType: string | null;
  present: boolean;
  checkedInVia: "peony" | "ticket_tailor" | "none";
  notes: string | null;
  associationStatus: string | null;
};

export type PeonyEventSummary = PeonyEvent & { ticketCount: number };

export function isActivePeonyTicket(status: string | null): boolean {
  if (!status) return true;
  const normalized = status.toLowerCase();
  return !["void", "cancelled", "canceled", "refunded", "deleted", "inactive"].some((blocked) =>
    normalized.includes(blocked),
  );
}

type EventRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  ticket_tailor_event_id: string | null;
  category: string | null;
  source: string | null;
};

function toPeonyEvent(row: EventRow): PeonyEvent | null {
  if (!row.ticket_tailor_event_id || row.source !== "ticket_tailor" || isLuxuriaTitle(row.title)) return null;
  return {
    id: row.id,
    title: row.title,
    startsOn: timestampToRomeDate(row.starts_at),
    endsOn: timestampToRomeDate(row.ends_at),
    ticketTailorEventId: row.ticket_tailor_event_id,
    category: row.category,
  };
}

/** I biglietti Peony sono solo Ticket Tailor. I workshop LuXuria non entrano mai in questo flusso. */
const loadEvents = cache(async (): Promise<PeonyEvent[]> => {
  const { data, error } = await getGestionaleDb()
    .from("events")
    .select("id,title,starts_at,ends_at,ticket_tailor_event_id,category,source")
    .eq("source", "ticket_tailor")
    .not("ticket_tailor_event_id", "is", null)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .range(0, 9999);
  if (error) throw new Error(`Eventi Peony: ${error.message}`);
  return ((data ?? []) as EventRow[])
    .map(toPeonyEvent)
    .filter((row): row is PeonyEvent => row !== null);
});

export async function loadPeonyEventsSummary(): Promise<PeonyEventSummary[]> {
  await requireAdmin();
  const events = await loadEvents();
  if (events.length === 0) return [];
  const ids = events.map((event) => event.ticketTailorEventId);
  const counts = new Map<string, number>();
  // Fetch in blocchi: PostgREST limita la dimensione della query IN.
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await getGestionaleDb()
      .from("ticket_tailor_issued_tickets")
      .select("ticket_tailor_event_id,status")
      .in("ticket_tailor_event_id", ids.slice(i, i + 100))
      .range(0, 9999);
    if (error) throw new Error(`Biglietti Ticket Tailor: ${error.message}`);
    for (const ticket of data ?? []) {
      if (ticket.ticket_tailor_event_id && isActivePeonyTicket(ticket.status)) {
        counts.set(ticket.ticket_tailor_event_id, (counts.get(ticket.ticket_tailor_event_id) ?? 0) + 1);
      }
    }
  }
  return events.map((event) => ({
    ...event,
    ticketCount: counts.get(event.ticketTailorEventId) ?? 0,
  }));
}

export async function getPeonyEvent(id: string): Promise<PeonyEvent | null> {
  await requireAdmin();
  if (!isUuidLike(id)) return null;
  return (await loadEvents()).find((event) => event.id === id) ?? null;
}

export async function loadPeonyAttendees(event: PeonyEvent): Promise<PeonyAttendee[]> {
  await requireAdmin();
  const db = getGestionaleDb();
  const [tickets, participants, checkins] = await Promise.all([
    db.from("ticket_tailor_issued_tickets")
      .select("ticket_tailor_issued_ticket_id,ticket_tailor_order_id,holder_first_name,holder_last_name,holder_email,ticket_type_name,status,checked_in")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId)
      .range(0, 9999),
    db.from("event_participants")
      .select("ticket_tailor_issued_ticket_id,notes_admin,association_status,checked_in")
      .eq("ticket_tailor_event_id", event.ticketTailorEventId)
      .not("ticket_tailor_issued_ticket_id", "is", null)
      .range(0, 9999),
    db.from("gw_peony_checkins")
      .select("ticket_id,present")
      .eq("event_id", event.id)
      .range(0, 9999),
  ]);
  if (tickets.error) throw new Error(`Biglietti: ${tickets.error.message}`);
  if (participants.error) throw new Error(`Partecipanti: ${participants.error.message}`);
  if (checkins.error) throw new Error(`Presenze: ${checkins.error.message}`);

  const participantByTicket = new Map((participants.data ?? []).map((item) => [item.ticket_tailor_issued_ticket_id, item]));
  const overrides = new Map((checkins.data ?? []).map((item) => [item.ticket_id, item.present]));

  return (tickets.data ?? [])
    .filter((ticket) => isActivePeonyTicket(ticket.status))
    .map((ticket): PeonyAttendee => {
      const participant = participantByTicket.get(ticket.ticket_tailor_issued_ticket_id);
      const override = overrides.get(ticket.ticket_tailor_issued_ticket_id);
      const checkedIn = ticket.checked_in === true || participant?.checked_in === true;
      const name = [ticket.holder_first_name, ticket.holder_last_name].filter(Boolean).join(" ").trim();
      return {
        id: ticket.ticket_tailor_issued_ticket_id,
        ticketId: ticket.ticket_tailor_issued_ticket_id,
        orderId: ticket.ticket_tailor_order_id,
        name: name || "Intestatario non indicato",
        email: ticket.holder_email?.trim() || null,
        ticketType: ticket.ticket_type_name || null,
        present: override ?? checkedIn,
        checkedInVia: override !== undefined ? "peony" : checkedIn ? "ticket_tailor" : "none",
        notes: participant?.notes_admin ?? null,
        associationStatus: participant?.association_status ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
}
