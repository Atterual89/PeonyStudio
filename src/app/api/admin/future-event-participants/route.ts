import { NextRequest, NextResponse } from "next/server";

import {
  deriveMembershipState,
  type MembershipEvidenceRow,
} from "@/lib/association/membership-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  title: string | null;
  slug: string | null;
  category: string | null;
  starts_at: string | null;
  ticket_tailor_event_id: string | null;
};

type TicketRow = {
  ticket_tailor_issued_ticket_id: string;
  ticket_tailor_order_id: string | null;
  ticket_tailor_event_id: string | null;
  event_id: string | null;
  ticket_type_name: string | null;
  holder_first_name: string | null;
  holder_last_name: string | null;
  holder_email: string | null;
  status: string | null;
};

type MemberRow = MembershipEvidenceRow;

type EnrollmentRow = {
  id: string;
  event_id: string | null;
  ticket_tailor_event_id: string | null;
  ticket_tailor_order_id: string | null;
  partner_source: string | null;
  partner_email: string | null;
  partner_name: string | null;
};

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: eventData, error: eventsError } = await supabase
    .from("events")
    .select("id,title,slug,category,starts_at,ticket_tailor_event_id")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .range(0, 499);

  if (eventsError) {
    return NextResponse.json(
      { ok: false, message: eventsError.message },
      { status: 500 },
    );
  }

  const events = (eventData ?? []) as EventRow[];
  const ticketTailorEventIds = events
    .map((event) => event.ticket_tailor_event_id)
    .filter((value): value is string => Boolean(value));

  if (ticketTailorEventIds.length === 0) {
    return NextResponse.json({ ok: true, events: [] });
  }

  const { data: ticketData, error: ticketsError } = await supabase
    .from("ticket_tailor_issued_tickets")
    .select(
      "ticket_tailor_issued_ticket_id,ticket_tailor_order_id,ticket_tailor_event_id,event_id,ticket_type_name,holder_first_name,holder_last_name,holder_email,status",
    )
    .in("ticket_tailor_event_id", ticketTailorEventIds)
    .range(0, 4999);

  if (ticketsError) {
    return NextResponse.json(
      { ok: false, message: ticketsError.message },
      { status: 500 },
    );
  }

  const tickets = ((ticketData ?? []) as TicketRow[]).filter((ticket) =>
    isActiveTicketStatus(ticket.status),
  );
  const { data: memberData, error: membersError } = await supabase
    .from("association_members")
    .select(
      "first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at",
    )
    .in("source", ["google_sheet", "official_members_book"])
    .range(0, 9999);

  if (membersError) {
    return NextResponse.json(
      { ok: false, message: membersError.message },
      { status: 500 },
    );
  }

  const membershipRows = (memberData ?? []) as MemberRow[];

  const eventIds = events.map((event) => event.id);
  const enrollmentByEventOrder = new Map<string, EnrollmentRow>();
  const enrollmentByTicketTailorEventOrder = new Map<string, EnrollmentRow>();

  if (eventIds.length > 0) {
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("user_event_enrollments")
      .select(
        "id,event_id,ticket_tailor_event_id,ticket_tailor_order_id,partner_source,partner_email,partner_name",
      )
      .in("event_id", eventIds)
      .range(0, 4999);

    if (enrollmentError) {
      return NextResponse.json(
        { ok: false, message: enrollmentError.message },
        { status: 500 },
      );
    }

    for (const enrollment of (enrollmentData ?? []) as EnrollmentRow[]) {
      if (enrollment.event_id && enrollment.ticket_tailor_order_id) {
        enrollmentByEventOrder.set(
          `${enrollment.event_id}|${enrollment.ticket_tailor_order_id}`,
          enrollment,
        );
      }
      if (
        enrollment.ticket_tailor_event_id &&
        enrollment.ticket_tailor_order_id
      ) {
        enrollmentByTicketTailorEventOrder.set(
          `${enrollment.ticket_tailor_event_id}|${enrollment.ticket_tailor_order_id}`,
          enrollment,
        );
      }
    }
  }

  const ticketsByEvent = new Map<string, TicketRow[]>();
  for (const ticket of tickets) {
    const key = ticket.ticket_tailor_event_id;
    if (!key) continue;
    ticketsByEvent.set(key, [...(ticketsByEvent.get(key) ?? []), ticket]);
  }

  const result = events.map((event) => {
    const partnerCheckRequired = eventNeedsPartnerCheck(event);
    const eventTickets = event.ticket_tailor_event_id
      ? ticketsByEvent.get(event.ticket_tailor_event_id) ?? []
      : [];

    const participants = eventTickets
      .map((ticket) => {
        const email = normalizeEmail(ticket.holder_email);
        const membership = deriveMembershipState(membershipRows, {
          email,
          firstName: ticket.holder_first_name,
          lastName: ticket.holder_last_name,
        });
        const enrollment =
          (ticket.ticket_tailor_order_id
            ? enrollmentByEventOrder.get(
                `${event.id}|${ticket.ticket_tailor_order_id}`,
              )
            : undefined) ??
          (event.ticket_tailor_event_id && ticket.ticket_tailor_order_id
            ? enrollmentByTicketTailorEventOrder.get(
                `${event.ticket_tailor_event_id}|${ticket.ticket_tailor_order_id}`,
              )
            : undefined);

        const partnerStatus = !partnerCheckRequired
          ? "not_required"
          : enrollment?.partner_source === "user"
            ? "user_provided"
            : enrollment?.partner_source === "admin"
              ? "admin_provided"
              : "missing";

        return {
          id: ticket.ticket_tailor_issued_ticket_id,
          ticket_tailor_order_id: ticket.ticket_tailor_order_id,
          ticket_type_name: ticket.ticket_type_name,
          first_name: ticket.holder_first_name,
          last_name: ticket.holder_last_name,
          email: ticket.holder_email,
          membership_status: membership.status,
          membership_expires_at: membership.membershipExpiresAt,
          partner_status: partnerStatus,
          enrollment_id: enrollment?.id ?? null,
          partner_name: enrollment?.partner_name ?? null,
          partner_email: enrollment?.partner_email ?? null,
          partner_source: enrollment?.partner_source ?? null,
        };
      })
      .sort((a, b) => {
        const aKey = `${a.last_name ?? ""} ${a.first_name ?? ""} ${a.email ?? ""}`;
        const bKey = `${b.last_name ?? ""} ${b.first_name ?? ""} ${b.email ?? ""}`;
        return aKey.localeCompare(bKey, "it", { sensitivity: "base" });
      });

    return {
      id: event.id,
      title: event.title,
      category: event.category,
      starts_at: event.starts_at,
      ticket_tailor_event_id: event.ticket_tailor_event_id,
      partner_check_required: partnerCheckRequired,
      participants,
    };
  });

  return NextResponse.json({ ok: true, events: result });
}

function eventNeedsPartnerCheck(event: EventRow) {
  const normalized = `${event.title ?? ""} ${event.slug ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ");

  const excluded = [
    "rope jam",
    "open day",
    "pratica assistita",
    "aperi bottom",
    "aperibottom",
  ];

  return !excluded.some((value) => normalized.includes(value));
}

function isActiveTicketStatus(status: string | null) {
  if (!status) return true;

  const normalized = status.toLowerCase();
  return !["void", "cancelled", "canceled", "refunded", "deleted", "inactive"].some(
    (blocked) => normalized.includes(blocked),
  );
}

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}
