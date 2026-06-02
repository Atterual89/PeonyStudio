import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getTicketTailorOrdersForEvents,
  type TicketTailorOrder,
} from "@/lib/ticketTailor";

export const dynamic = "force-dynamic";

type SyncMessage = {
  level: "warning" | "error";
  ticketTailorOrderId?: string;
  message: string;
};

type SupabaseOrderRow = {
  ticket_tailor_order_id: string;
  buyer_email: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  ticket_tailor_event_id: string | null;
  event_id: string | null;
  payment_status: string | null;
  order_status: string | null;
  total_tickets: number | null;
  raw_payload: Record<string, unknown>;
  last_synced_at: string;
};

type TargetEvent = {
  id: string;
  ticket_tailor_event_id: string;
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
  let targetEventsQueryError: string | null = null;
  const targetEvents = await getTargetEvents();
  const eventIdByTicketTailorId = new Map(
    targetEvents.map((event) => [event.ticket_tailor_event_id, event.id]),
  );
  const targetEventIds = targetEvents.map((event) => event.ticket_tailor_event_id);
  const { orders, pagesRead } =
    await getTicketTailorOrdersForEvents(targetEventIds);
  let upserted = 0;
  let skipped = 0;
  let ignoredNonTargetOrders = 0;
  let matched = 0;

  for (const order of orders) {
    if (!isTargetOrder(order, eventIdByTicketTailorId)) {
      ignoredNonTargetOrders += 1;
      continue;
    }

    const row = mapTicketTailorOrderToSupabaseRow(
      order,
      eventIdByTicketTailorId,
    );

    if (!row) {
      skipped += 1;
      errors.push({
        level: "error",
        message: "Missing Ticket Tailor order id.",
      });
      continue;
    }

    matched += 1;

    const { error } = await supabase
      .from("ticket_tailor_orders")
      .upsert(row, { onConflict: "ticket_tailor_order_id" });

    if (error) {
      console.error("[ticket-tailor sync] Order upsert failed", {
        ticketTailorOrderId: row.ticket_tailor_order_id,
        message: error.message,
      });

      errors.push({
        level: "error",
        ticketTailorOrderId: row.ticket_tailor_order_id,
        message: error.message,
      });
      continue;
    }

    upserted += 1;
  }

  return NextResponse.json({
    ok: !errors.some((error) => error.level === "error"),
    targetEvents: targetEvents.length,
    targetEventIdsSample: targetEventIds.slice(0, 10),
    targetEventsQueryError,
    pagesRead,
    fetched: orders.length,
    matched,
    upserted,
    skipped,
    ignoredNonTargetOrders,
    errors,
  });

  async function getTargetEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("id,ticket_tailor_event_id")
      .range(0, 999);

    if (error) {
      targetEventsQueryError = error.message;
      console.error("[ticket-tailor sync] Could not load events map", {
        message: error.message,
      });
      errors.push({
        level: "error",
        message:
          "Could not load public.events target list. Orders sync cannot continue safely.",
      });
      return [] as TargetEvent[];
    }

    return (data ?? []).filter(
      (event): event is TargetEvent =>
        typeof event.id === "string" &&
        typeof event.ticket_tailor_event_id === "string" &&
        event.ticket_tailor_event_id.trim().length > 0,
    );
  }
}

function mapTicketTailorOrderToSupabaseRow(
  order: TicketTailorOrder,
  eventIdByTicketTailorId: Map<string, string>,
): SupabaseOrderRow | null {
  if (!order.ticketTailorOrderId) {
    return null;
  }

  const eventId = order.ticketTailorEventId
    ? eventIdByTicketTailorId.get(order.ticketTailorEventId)
    : undefined;

  return {
    ticket_tailor_order_id: order.ticketTailorOrderId,
    buyer_email: order.buyerEmail ?? null,
    buyer_first_name: order.buyerFirstName ?? null,
    buyer_last_name: order.buyerLastName ?? null,
    ticket_tailor_event_id: order.ticketTailorEventId ?? null,
    event_id: eventId ?? null,
    payment_status: order.paymentStatus ?? null,
    order_status: order.orderStatus ?? null,
    total_tickets: order.totalTickets ?? null,
    raw_payload: order.rawPayload,
    last_synced_at: new Date().toISOString(),
  };
}

function isTargetOrder(
  order: TicketTailorOrder,
  eventIdByTicketTailorId: Map<string, string>,
) {
  if (
    order.ticketTailorEventId &&
    eventIdByTicketTailorId.has(order.ticketTailorEventId)
  ) {
    return true;
  }

  return getIssuedTicketEventIds(order.rawPayload).some((eventId) =>
    eventIdByTicketTailorId.has(eventId),
  );
}

function getIssuedTicketEventIds(record: Record<string, unknown>) {
  const issuedTickets = record.issued_tickets;

  if (!Array.isArray(issuedTickets)) {
    return [];
  }

  return issuedTickets
    .map((ticket) =>
      isRecord(ticket)
        ? getString(ticket.event_id) ?? getString(ticket.eventId)
        : null,
    )
    .filter((eventId): eventId is string => Boolean(eventId));
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
