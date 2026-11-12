import "server-only";

// Fase C audit anagrafica: confronto tra il pallino attuale (abbinamento per
// email e nome a ogni caricamento) e quello nuovo (collegamenti salvati in
// gw_person_sources). Serve a decidere quando accendere GW_LINKED_MEMBERSHIP.

import type { EventMembershipRow } from "@/components/gestionale/EventMembershipCheck";
import type { EventDotColor } from "@/lib/gestionale/linked-membership";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getWorkshopBookings, listWorkshopsForCopy } from "@/lib/gestionale/server/data";
import { peonyMembershipRows, workshopMembershipRows } from "@/lib/gestionale/server/linked-membership";
import { loadPeonyAttendees, loadPeonyEventsSummary, type PeonyMembership } from "@/lib/gestionale/server/peony-events";
import type { MembershipBadge } from "@/lib/gestionale/types";

export type ComparisonRow = {
  eventId: string;
  eventName: string;
  eventDate: string;
  href: string;
  name: string;
  before: EventDotColor | "non_collegata";
  after: EventDotColor;
  reason: string;
  /** Riga della pagina evento: serve a chiarire i gialli dal confronto. */
  row: EventMembershipRow;
};

export type ComparisonResult = {
  rows: ComparisonRow[];
  events: number;
  people: number;
  errors: string[];
};

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function colorOfBadge(badge: MembershipBadge): ComparisonRow["before"] {
  if (badge.kind === "in_regola") return "verde";
  if (badge.kind === "non_collegata") return "non_collegata";
  return "rosso";
}

function colorOfPeony(association: PeonyMembership | null): ComparisonRow["before"] {
  if (!association) return "non_collegata";
  return association.status === "valid" ? "verde" : "rosso";
}

/**
 * Eventi dei prossimi 60 giorni (con includePast anche degli ultimi 30).
 * Mostra solo le persone il cui pallino cambia.
 */
export async function compareLinkedMembership(today: string, includePast = false): Promise<ComparisonResult> {
  await requireAdmin();
  const from = includePast ? addDays(today, -30) : today;
  const until = addDays(today, 60);
  const rows: ComparisonRow[] = [];
  const errors: string[] = [];
  let events = 0;
  let people = 0;

  const workshops = (await listWorkshopsForCopy(""))
    .filter((w) => w.startsOn >= from && w.startsOn <= until);
  for (const workshop of workshops) {
    try {
      const bookings = await getWorkshopBookings(workshop);
      const linked = new Map((await workshopMembershipRows(bookings, workshop.startsOn)).map((row) => [row.key, row]));
      events += 1;
      for (const booking of bookings) {
        if (booking.status === "cancellato") continue;
        for (const person of booking.people) {
          const after = linked.get(person.participantId);
          if (!after) continue;
          people += 1;
          const before = colorOfBadge(person.membership);
          if (before === after.color) continue;
          rows.push({
            eventId: workshop.id, eventName: workshop.name, eventDate: workshop.startsOn,
            href: `/gestione/w/${workshop.id}?tab=partecipanti`,
            name: person.displayName, before, after: after.color, reason: after.reason, row: after,
          });
        }
      }
    } catch (error) {
      errors.push(`${workshop.name}: ${(error as Error).message}`);
    }
  }

  const peonyEvents = (await loadPeonyEventsSummary())
    .filter((e) => e.startsOn && e.startsOn >= from && e.startsOn <= until);
  for (const event of peonyEvents) {
    try {
      const roster = await loadPeonyAttendees(event);
      const linked = new Map((await peonyMembershipRows(event, roster.attendees)).map((row) => [row.key, row]));
      events += 1;
      for (const attendee of roster.attendees) {
        if (!attendee.associationRequired) continue;
        const pairs: [string, string, PeonyMembership | null][] = [[`h:${attendee.ticketId}`, attendee.name, attendee.association]];
        if (attendee.partner) {
          pairs.push([`p:${attendee.ticketId}`, attendee.partner.name ?? "Partner", attendee.partner.membership]);
        }
        for (const [key, name, association] of pairs) {
          const after = linked.get(key);
          if (!after) continue;
          people += 1;
          const before = colorOfPeony(association);
          if (before === after.color) continue;
          rows.push({
            eventId: event.id, eventName: event.title, eventDate: event.startsOn ?? "",
            href: `/gestione/peony/${event.id}`,
            name, before, after: after.color, reason: after.reason, row: after,
          });
        }
      }
    } catch (error) {
      errors.push(`${event.title}: ${(error as Error).message}`);
    }
  }

  rows.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.name.localeCompare(b.name, "it"));
  return { rows, events, people, errors };
}
