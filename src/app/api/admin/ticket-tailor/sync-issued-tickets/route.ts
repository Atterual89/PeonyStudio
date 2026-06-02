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
  raw_payload: Record<string, unknown> | null;
};

type SupabaseIssuedTicketRow = {
  ticket_tailor_issued_ticket_id: string;
  ticket_tailor_order_id: string;
  ticket_tailor_event_id: string | null;
  event_id: string | null;
  ticket_type_name: string | null;
  holder_first_name: string | null;
  holder_last_name: string | null;
  holder_email: string | null;
  checked_in: boolean | null;
  checked_in_at: string | null;
  status: string | null;
  raw_payload: Record<string, unknown>;
  last_synced_at: string;
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
  const [orders, eventIdByTicketTailorId] = await Promise.all([
    getSyncedOrders(),
    getEventIdByTicketTailorId(),
  ]);
  let ticketsFound = 0;
  let upserted = 0;
  let skipped = 0;
  let unmatchedHistoricalTickets = 0;
  let unmatchedFutureOrUnknownTickets = 0;

  for (const order of orders) {
    const issuedTickets = getIssuedTickets(order.raw_payload);
    ticketsFound += issuedTickets.length;

    for (const ticket of issuedTickets) {
      const row = mapIssuedTicketToSupabaseRow(
        ticket,
        order,
        eventIdByTicketTailorId,
      );

      if (!row) {
        skipped += 1;
        errors.push({
          level: "error",
          ticketTailorOrderId: order.ticket_tailor_order_id,
          message: "Missing Ticket Tailor issued ticket id.",
        });
        continue;
      }

      if (row.ticket_tailor_event_id && !row.event_id) {
        if (isHistoricalTicket(ticket, order.raw_payload)) {
          unmatchedHistoricalTickets += 1;
        } else {
          unmatchedFutureOrUnknownTickets += 1;
          errors.push({
            level: "warning",
            ticketTailorOrderId: row.ticket_tailor_order_id,
            ticketTailorIssuedTicketId: row.ticket_tailor_issued_ticket_id,
            message:
              "Issued ticket saved, but no matching public.events row was found for a future or undated ticket_tailor_event_id.",
          });
        }
      }

      const { error } = await supabase
        .from("ticket_tailor_issued_tickets")
        .upsert(row, { onConflict: "ticket_tailor_issued_ticket_id" });

      if (error) {
        console.error("[ticket-tailor sync] Issued ticket upsert failed", {
          ticketTailorOrderId: row.ticket_tailor_order_id,
          ticketTailorIssuedTicketId: row.ticket_tailor_issued_ticket_id,
          message: error.message,
        });

        errors.push({
          level: "error",
          ticketTailorOrderId: row.ticket_tailor_order_id,
          ticketTailorIssuedTicketId: row.ticket_tailor_issued_ticket_id,
          message: error.message,
        });
        continue;
      }

      upserted += 1;
    }
  }

  return NextResponse.json({
    ok: !errors.some((error) => error.level === "error"),
    ordersRead: orders.length,
    ticketsFound,
    upserted,
    skipped,
    unmatchedHistoricalTickets,
    unmatchedFutureOrUnknownTickets,
    errors,
  });

  async function getSyncedOrders() {
    const { data, error } = await supabase
      .from("ticket_tailor_orders")
      .select(
        "ticket_tailor_order_id,ticket_tailor_event_id,event_id,raw_payload",
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

  async function getEventIdByTicketTailorId() {
    const { data, error } = await supabase
      .from("events")
      .select("id,ticket_tailor_event_id")
      .not("ticket_tailor_event_id", "is", null);

    if (error) {
      console.error("[ticket-tailor sync] Could not load events map", {
        message: error.message,
      });
      errors.push({
        level: "warning",
        message:
          "Could not load public.events map. Issued tickets will be saved without event_id.",
      });
      return new Map<string, string>();
    }

    return new Map(
      (data ?? [])
        .filter(
          (event): event is {
            id: string;
            ticket_tailor_event_id: string;
          } =>
            typeof event.id === "string" &&
            typeof event.ticket_tailor_event_id === "string",
        )
        .map((event) => [event.ticket_tailor_event_id, event.id]),
    );
  }
}

function mapIssuedTicketToSupabaseRow(
  ticket: Record<string, unknown>,
  order: TicketTailorOrderRow,
  eventIdByTicketTailorId: Map<string, string>,
): SupabaseIssuedTicketRow | null {
  const ticketTailorIssuedTicketId = findString(ticket, [
    "id",
    "issued_ticket_id",
    "issuedTicketId",
    "ticket_id",
    "barcode",
    "reference",
  ]);

  if (!ticketTailorIssuedTicketId) {
    return null;
  }

  const ticketTailorEventId =
    findString(ticket, [
      "ticket_tailor_event_id",
      "event_id",
      "eventId",
      "event.id",
      "event.event_id",
    ]) ?? order.ticket_tailor_event_id;
  const eventId = ticketTailorEventId
    ? eventIdByTicketTailorId.get(ticketTailorEventId) ?? order.event_id
    : order.event_id;

  return {
    ticket_tailor_issued_ticket_id: ticketTailorIssuedTicketId,
    ticket_tailor_order_id: order.ticket_tailor_order_id,
    ticket_tailor_event_id: ticketTailorEventId ?? null,
    event_id: eventId ?? null,
    ticket_type_name:
      findString(ticket, [
        "ticket_type_name",
        "ticket_type",
        "ticket_type.name",
        "ticket_type.description",
        "ticket_group_name",
        "name",
      ]) ?? null,
    holder_first_name:
      findString(ticket, [
        "holder_first_name",
        "first_name",
        "attendee_first_name",
        "ticket_holder.first_name",
        "holder.first_name",
      ]) ?? findString(order.raw_payload ?? {}, ["buyer_details.first_name"]),
    holder_last_name:
      findString(ticket, [
        "holder_last_name",
        "last_name",
        "attendee_last_name",
        "ticket_holder.last_name",
        "holder.last_name",
      ]) ?? findString(order.raw_payload ?? {}, ["buyer_details.last_name"]),
    holder_email:
      findString(ticket, [
        "holder_email",
        "email",
        "attendee_email",
        "ticket_holder.email",
        "holder.email",
      ]) ?? findString(order.raw_payload ?? {}, ["buyer_details.email"]),
    checked_in: findBoolean(ticket, [
      "checked_in",
      "checkedIn",
      "check_in.checked_in",
      "checkin.checked_in",
    ]),
    checked_in_at: findIsoTimestamp(ticket, [
      "checked_in_at",
      "checkedInAt",
      "check_in.checked_in_at",
      "checkin.checked_in_at",
    ]),
    status: findString(ticket, ["status", "state"]) ?? null,
    raw_payload: ticket,
    last_synced_at: new Date().toISOString(),
  };
}

function isTicketTailorOrderRow(value: unknown): value is TicketTailorOrderRow {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.ticket_tailor_order_id === "string";
}

function getIssuedTickets(rawPayload: Record<string, unknown> | null) {
  if (!rawPayload) {
    return [];
  }

  const issuedTickets = getPath(rawPayload, "issued_tickets");

  return Array.isArray(issuedTickets) ? issuedTickets.filter(isRecord) : [];
}

function isHistoricalTicket(
  ticket: Record<string, unknown>,
  orderPayload: Record<string, unknown> | null,
) {
  const date =
    findDateInRecord(ticket, [
      "end_date",
      "start_date",
      "event.end_date",
      "event.start_date",
    ]) ??
    (orderPayload
      ? findDateInRecord(orderPayload, [
          "event_summary.end_date",
          "event_summary.start_date",
          "end_date",
          "start_date",
        ])
      : null) ??
    findFirstNestedEventDate(ticket) ??
    (orderPayload ? findFirstNestedEventDate(orderPayload) : null);

  if (!date) {
    return false;
  }

  return date < new Date().toISOString().slice(0, 10);
}

function findDateInRecord(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getPath(record, path);
    const date = normalizeDate(value);

    if (date) {
      return date;
    }
  }

  return null;
}

function findFirstNestedEventDate(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const date = findFirstNestedEventDate(item);
      if (date) return date;
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (/start_date|end_date/i.test(key)) {
      const date = normalizeDate(child);
      if (date) return date;
    }

    if (isRecord(child) || Array.isArray(child)) {
      const date = findFirstNestedEventDate(child);
      if (date) return date;
    }
  }

  return null;
}

function findString(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getPath(record, path);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function findBoolean(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getPath(record, path);
    const booleanValue = normalizeBoolean(value);
    if (booleanValue !== null) {
      return booleanValue;
    }
  }

  return null;
}

function findIsoTimestamp(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getPath(record, path);
    const timestamp = normalizeTimestamp(value);
    if (timestamp) {
      return timestamp;
    }
  }

  return null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "checked_in"].includes(normalized)) return true;
    if (["false", "0", "no", "not_checked_in"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function normalizeTimestamp(value: unknown): string | null {
  if (isRecord(value)) {
    return normalizeTimestamp(value.iso ?? value.datetime ?? value.unix);
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue * (numericValue > 9_999_999_999 ? 1 : 1000))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDate(value: unknown): string | null {
  if (isRecord(value)) {
    return normalizeDate(value.iso ?? value.date ?? value.formatted ?? value.unix);
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue * (numericValue > 9_999_999_999 ? 1 : 1000))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function getPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (Array.isArray(value)) {
      const index = Number(segment);
      return Number.isInteger(index) ? value[index] : undefined;
    }

    if (!isRecord(value)) {
      return undefined;
    }

    return value[segment];
  }, record);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
