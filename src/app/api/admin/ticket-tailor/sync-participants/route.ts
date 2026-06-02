import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SyncMessage = {
  level: "warning" | "error";
  ticketTailorOrderId?: string;
  ticketTailorIssuedTicketId?: string;
  message: string;
};

type TicketTailorOrderRow = {
  ticket_tailor_order_id: string;
  ticket_tailor_event_id: string | null;
  event_id: string | null;
  buyer_email: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
};

type TicketTailorIssuedTicketRow = {
  ticket_tailor_issued_ticket_id: string;
  ticket_tailor_order_id: string;
  ticket_tailor_event_id: string | null;
  event_id: string | null;
  holder_first_name: string | null;
  holder_last_name: string | null;
  holder_email: string | null;
  checked_in: boolean | null;
};

type EventParticipantRow = {
  event_id: string | null;
  ticket_tailor_event_id: string | null;
  profile_id: null;
  ticket_tailor_order_id: string;
  ticket_tailor_issued_ticket_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  participant_type: "buyer" | "attendee";
  linked_buyer_profile_id: null;
  association_status?: "unknown";
  checked_in: boolean;
  checked_in_source: "ticket_tailor" | "unknown";
  partner_status?: "not_needed";
  notes_admin?: null;
};

type ExistingParticipant = {
  partner_status: string | null;
};

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "ADMIN_SYNC_SECRET is not configured.",
      },
      { status: 500 },
    );
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized sync request.",
      },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const errors: SyncMessage[] = [];
  const [orders, tickets] = await Promise.all([
    getSyncedOrders(),
    getSyncedIssuedTickets(),
  ]);
  const ordersById = new Map(
    orders.map((order) => [order.ticket_tailor_order_id, order]),
  );
  let buyerParticipantsUpserted = 0;
  let attendeeParticipantsUpserted = 0;
  let skipped = 0;

  for (const order of orders) {
    const participant = mapBuyerParticipant(order);
    const result = await upsertParticipant(participant);

    if (result.ok) {
      buyerParticipantsUpserted += 1;
    } else {
      skipped += 1;
      errors.push({
        level: "error",
        ticketTailorOrderId: order.ticket_tailor_order_id,
        message: result.message ?? "Participant upsert failed.",
      });
    }
  }

  for (const ticket of tickets) {
    const order = ordersById.get(ticket.ticket_tailor_order_id);

    if (!order) {
      skipped += 1;
      errors.push({
        level: "warning",
        ticketTailorIssuedTicketId: ticket.ticket_tailor_issued_ticket_id,
        message:
          "Issued ticket skipped because matching ticket_tailor_order was not found.",
      });
      continue;
    }

    const participant = mapAttendeeParticipant(ticket, order);
    const result = await upsertParticipant(participant);

    if (result.ok) {
      attendeeParticipantsUpserted += 1;
    } else {
      skipped += 1;
      errors.push({
        level: "error",
        ticketTailorOrderId: ticket.ticket_tailor_order_id,
        ticketTailorIssuedTicketId: ticket.ticket_tailor_issued_ticket_id,
        message: result.message ?? "Participant upsert failed.",
      });
    }
  }

  return NextResponse.json({
    ok: !errors.some((error) => error.level === "error"),
    ordersRead: orders.length,
    ticketsRead: tickets.length,
    buyerParticipantsUpserted,
    attendeeParticipantsUpserted,
    skipped,
    errors,
  });

  async function getSyncedOrders() {
    const { data, error } = await supabase
      .from("ticket_tailor_orders")
      .select(
        "ticket_tailor_order_id,ticket_tailor_event_id,event_id,buyer_email,buyer_first_name,buyer_last_name",
      )
      .range(0, 999);

    if (error) {
      console.error("[ticket-tailor sync] Could not load synced orders", {
        message: error.message,
      });
      errors.push({
        level: "error",
        message: "Could not load ticket_tailor_orders.",
      });
      return [] as TicketTailorOrderRow[];
    }

    return (data ?? []).filter(isTicketTailorOrderRow);
  }

  async function getSyncedIssuedTickets() {
    const { data, error } = await supabase
      .from("ticket_tailor_issued_tickets")
      .select(
        "ticket_tailor_issued_ticket_id,ticket_tailor_order_id,ticket_tailor_event_id,event_id,holder_first_name,holder_last_name,holder_email,checked_in",
      )
      .range(0, 999);

    if (error) {
      console.error("[ticket-tailor sync] Could not load issued tickets", {
        message: error.message,
      });
      errors.push({
        level: "error",
        message: "Could not load ticket_tailor_issued_tickets.",
      });
      return [] as TicketTailorIssuedTicketRow[];
    }

    return (data ?? []).filter(isTicketTailorIssuedTicketRow);
  }

  async function upsertParticipant(participant: EventParticipantRow) {
    const existing = await findExistingParticipant(participant);

    if (!existing.ok) {
      return { ok: false, message: existing.message };
    }

    const { error } = existing.participant
      ? await updateParticipant(participant, existing.participant)
      : await supabase
          .from("event_participants")
          .insert(buildParticipantInsertPayload(participant));

    if (error) {
      console.error("[ticket-tailor sync] Participant upsert failed", {
        participantType: participant.participant_type,
        ticketTailorOrderId: participant.ticket_tailor_order_id,
        ticketTailorIssuedTicketId: participant.ticket_tailor_issued_ticket_id,
        message: error.message,
      });

      return { ok: false, message: error.message };
    }

    return { ok: true };
  }

  async function findExistingParticipant(participant: EventParticipantRow) {
    let query = supabase
      .from("event_participants")
      .select("partner_status")
      .eq("participant_type", participant.participant_type)
      .limit(1);

    if (participant.participant_type === "buyer") {
      query = query
        .eq("ticket_tailor_order_id", participant.ticket_tailor_order_id)
        .is("ticket_tailor_issued_ticket_id", null);
    } else if (participant.ticket_tailor_issued_ticket_id) {
      query = query.eq(
        "ticket_tailor_issued_ticket_id",
        participant.ticket_tailor_issued_ticket_id,
      );
    } else {
      return {
        ok: false,
        message: "Missing attendee ticket_tailor_issued_ticket_id.",
      };
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false, message: error.message };
    }

    return {
      ok: true,
      participant: (data?.[0] ?? null) as ExistingParticipant | null,
    };
  }

  async function updateParticipant(
    participant: EventParticipantRow,
    existing: ExistingParticipant,
  ) {
    const payload = buildParticipantUpdatePayload(participant, existing);
    let query = supabase
      .from("event_participants")
      .update(payload)
      .eq("participant_type", participant.participant_type);

    if (participant.participant_type === "buyer") {
      query = query
        .eq("ticket_tailor_order_id", participant.ticket_tailor_order_id)
        .is("ticket_tailor_issued_ticket_id", null);
    } else if (participant.ticket_tailor_issued_ticket_id) {
      query = query.eq(
        "ticket_tailor_issued_ticket_id",
        participant.ticket_tailor_issued_ticket_id,
      );
    }

    return query;
  }
}

function mapBuyerParticipant(order: TicketTailorOrderRow): EventParticipantRow {
  return {
    event_id: order.event_id,
    ticket_tailor_event_id: order.ticket_tailor_event_id,
    profile_id: null,
    ticket_tailor_order_id: order.ticket_tailor_order_id,
    ticket_tailor_issued_ticket_id: null,
    first_name: order.buyer_first_name,
    last_name: order.buyer_last_name,
    email: order.buyer_email,
    participant_type: "buyer",
    linked_buyer_profile_id: null,
    association_status: "unknown",
    checked_in: false,
    checked_in_source: "unknown",
    partner_status: "not_needed",
    notes_admin: null,
  };
}

function mapAttendeeParticipant(
  ticket: TicketTailorIssuedTicketRow,
  order: TicketTailorOrderRow,
): EventParticipantRow {
  return {
    event_id: ticket.event_id ?? order.event_id,
    ticket_tailor_event_id:
      ticket.ticket_tailor_event_id ?? order.ticket_tailor_event_id,
    profile_id: null,
    ticket_tailor_order_id: ticket.ticket_tailor_order_id,
    ticket_tailor_issued_ticket_id: ticket.ticket_tailor_issued_ticket_id,
    first_name: ticket.holder_first_name ?? order.buyer_first_name,
    last_name: ticket.holder_last_name ?? order.buyer_last_name,
    email: ticket.holder_email ?? order.buyer_email,
    participant_type: "attendee",
    linked_buyer_profile_id: null,
    association_status: "unknown",
    checked_in: ticket.checked_in ?? false,
    checked_in_source:
      typeof ticket.checked_in === "boolean" ? "ticket_tailor" : "unknown",
    partner_status: "not_needed",
    notes_admin: null,
  };
}

function buildParticipantInsertPayload(participant: EventParticipantRow) {
  return participant;
}

function buildParticipantUpdatePayload(
  participant: EventParticipantRow,
  existing: ExistingParticipant,
) {
  const payload: Partial<EventParticipantRow> = {
    event_id: participant.event_id,
    ticket_tailor_event_id: participant.ticket_tailor_event_id,
    profile_id: participant.profile_id,
    ticket_tailor_order_id: participant.ticket_tailor_order_id,
    ticket_tailor_issued_ticket_id: participant.ticket_tailor_issued_ticket_id,
    first_name: participant.first_name,
    last_name: participant.last_name,
    email: participant.email,
    participant_type: participant.participant_type,
    linked_buyer_profile_id: participant.linked_buyer_profile_id,
    checked_in: participant.checked_in,
    checked_in_source: participant.checked_in_source,
  };

  if (!existing.partner_status || existing.partner_status === "not_needed") {
    payload.partner_status = "not_needed";
  }

  return payload;
}

function isTicketTailorOrderRow(value: unknown): value is TicketTailorOrderRow {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.ticket_tailor_order_id === "string";
}

function isTicketTailorIssuedTicketRow(
  value: unknown,
): value is TicketTailorIssuedTicketRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.ticket_tailor_issued_ticket_id === "string" &&
    typeof value.ticket_tailor_order_id === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
