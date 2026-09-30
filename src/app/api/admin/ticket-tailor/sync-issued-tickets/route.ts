import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TICKET_TAILOR_ORDERS_ENDPOINT = "https://api.tickettailor.com/v1/orders";
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const UPSERT_BATCH_SIZE = 200;

type TicketTailorRecord = Record<string, unknown>;

type SyncMessage = {
  level: "warning" | "error";
  ticketTailorOrderId?: string;
  ticketTailorIssuedTicketId?: string;
  message: string;
};

type TargetEvent = {
  id: string;
  ticket_tailor_event_id: string;
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
  raw_payload: TicketTailorRecord;
  last_synced_at: string;
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
  raw_payload: TicketTailorRecord;
  last_synced_at: string;
};

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");
  const apiKey = process.env.TICKET_TAILOR_API_KEY;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized sync request." },
      { status: 401 },
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "TICKET_TAILOR_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const errors: SyncMessage[] = [];

  try {
    const [targetEvents, orderResult] = await Promise.all([
      loadTargetEvents(),
      fetchOrders(apiKey),
    ]);

    const eventIdByTicketTailorId = new Map(
      targetEvents.map((event) => [event.ticket_tailor_event_id, event.id]),
    );

    const orderRows: SupabaseOrderRow[] = [];
    const ticketRows: SupabaseIssuedTicketRow[] = [];
    let ignoredOrders = 0;
    let skippedTickets = 0;

    for (const order of orderResult.records) {
      const orderId = findString(order, [
        "id",
        "order_id",
        "orderId",
        "object_id",
      ]);

      if (!orderId) {
        ignoredOrders += 1;
        continue;
      }

      const issuedTickets = getIssuedTickets(order);
      const orderEventId = findString(order, [
        "ticket_tailor_event_id",
        "event_id",
        "eventId",
        "event_summary.id",
        "event_summary.event_id",
        "event_summary.eventId",
        "event.id",
        "event.event_id",
        "event.object_id",
      ]);

      const matchesTarget =
        (orderEventId ? eventIdByTicketTailorId.has(orderEventId) : false) ||
        issuedTickets.some((ticket) => {
          const ticketEventId = findString(ticket, [
            "ticket_tailor_event_id",
            "event_id",
            "eventId",
            "event.id",
            "event.event_id",
          ]);
          return ticketEventId
            ? eventIdByTicketTailorId.has(ticketEventId)
            : false;
        });

      if (!matchesTarget) {
        ignoredOrders += 1;
        continue;
      }

      const localEventId = orderEventId
        ? eventIdByTicketTailorId.get(orderEventId) ?? null
        : null;

      orderRows.push({
        ticket_tailor_order_id: orderId,
        buyer_email: normalizeEmail(
          findString(order, [
            "buyer_email",
            "email",
            "customer_email",
            "purchaser_email",
            "buyer.email",
            "customer.email",
            "buyer_details.email",
            "order.email",
          ]),
        ),
        buyer_first_name: findString(order, [
          "buyer_first_name",
          "first_name",
          "customer_first_name",
          "purchaser_first_name",
          "buyer.first_name",
          "customer.first_name",
          "buyer_details.first_name",
          "order.first_name",
        ]),
        buyer_last_name: findString(order, [
          "buyer_last_name",
          "last_name",
          "customer_last_name",
          "purchaser_last_name",
          "buyer.last_name",
          "customer.last_name",
          "buyer_details.last_name",
          "order.last_name",
        ]),
        ticket_tailor_event_id: orderEventId,
        event_id: localEventId,
        payment_status: findString(order, [
          "payment_status",
          "paymentStatus",
          "payment_state",
          "payment.status",
          "payment.state",
        ]),
        order_status: findString(order, ["order_status", "status", "state"]),
        total_tickets:
          findNumber(order, [
            "total_tickets",
            "ticket_quantity",
            "quantity",
            "num_tickets",
            "number_of_tickets",
            "total_issued_tickets",
          ]) ?? issuedTickets.length,
        raw_payload: order,
        last_synced_at: new Date().toISOString(),
      });

      for (const ticket of issuedTickets) {
        const ticketId = findString(ticket, [
          "id",
          "issued_ticket_id",
          "issuedTicketId",
          "ticket_id",
          "barcode",
          "reference",
        ]);

        if (!ticketId) {
          skippedTickets += 1;
          errors.push({
            level: "warning",
            ticketTailorOrderId: orderId,
            message: "Issued ticket skipped because its id is missing.",
          });
          continue;
        }

        const ticketEventId =
          findString(ticket, [
            "ticket_tailor_event_id",
            "event_id",
            "eventId",
            "event.id",
            "event.event_id",
          ]) ?? orderEventId;

        if (
          ticketEventId &&
          !eventIdByTicketTailorId.has(ticketEventId)
        ) {
          continue;
        }

        ticketRows.push({
          ticket_tailor_issued_ticket_id: ticketId,
          ticket_tailor_order_id: orderId,
          ticket_tailor_event_id: ticketEventId,
          event_id: ticketEventId
            ? eventIdByTicketTailorId.get(ticketEventId) ?? localEventId
            : localEventId,
          ticket_type_name: findString(ticket, [
            "ticket_type_name",
            "ticket_type",
            "ticket_type.name",
            "ticket_type.description",
            "ticket_group_name",
            "name",
          ]),
          holder_first_name:
            findString(ticket, [
              "holder_first_name",
              "first_name",
              "attendee_first_name",
              "ticket_holder.first_name",
              "holder.first_name",
            ]) ??
            findString(order, ["buyer_details.first_name", "buyer.first_name"]),
          holder_last_name:
            findString(ticket, [
              "holder_last_name",
              "last_name",
              "attendee_last_name",
              "ticket_holder.last_name",
              "holder.last_name",
            ]) ??
            findString(order, ["buyer_details.last_name", "buyer.last_name"]),
          holder_email: normalizeEmail(
            findString(ticket, [
              "holder_email",
              "email",
              "attendee_email",
              "ticket_holder.email",
              "holder.email",
            ]) ??
              findString(order, ["buyer_details.email", "buyer.email", "email"]),
          ),
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
          status: findString(ticket, ["status", "state"]),
          raw_payload: ticket,
          last_synced_at: new Date().toISOString(),
        });
      }
    }

    const orderUpserts = await upsertInBatches(
      "ticket_tailor_orders",
      orderRows,
      "ticket_tailor_order_id",
    );
    const ticketUpserts = await upsertInBatches(
      "ticket_tailor_issued_tickets",
      ticketRows,
      "ticket_tailor_issued_ticket_id",
    );

    return NextResponse.json({
      ok: !errors.some((error) => error.level === "error"),
      pagesRead: orderResult.pagesRead,
      fetched: orderResult.records.length,
      targetEvents: targetEvents.length,
      matchedOrders: orderRows.length,
      ordersUpserted: orderUpserts,
      ticketsFound: ticketRows.length,
      upserted: ticketUpserts,
      skipped: skippedTickets,
      ignoredOrders,
      errors,
    });

    async function loadTargetEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("id,ticket_tailor_event_id")
        .not("ticket_tailor_event_id", "is", null)
        .range(0, 999);

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).filter(
        (event): event is TargetEvent =>
          typeof event.id === "string" &&
          typeof event.ticket_tailor_event_id === "string" &&
          event.ticket_tailor_event_id.trim().length > 0,
      );
    }

    async function upsertInBatches<T extends Record<string, unknown>>(
      table: string,
      rows: T[],
      onConflict: string,
    ) {
      let upserted = 0;

      for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
        const { error } = await supabase
          .from(table)
          .upsert(batch, { onConflict });

        if (error) {
          errors.push({
            level: "error",
            message: `${table}: ${error.message}`,
          });
          continue;
        }

        upserted += batch.length;
      }

      return upserted;
    }
  } catch (error) {
    console.error("[ticket-tailor sync] Order-based ticket sync failed", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected order-based ticket sync error.",
      },
      { status: 500 },
    );
  }
}

async function fetchOrders(apiKey: string) {
  const records: TicketTailorRecord[] = [];
  let pagesRead = 0;
  let startingAfter: string | null = null;

  while (pagesRead < MAX_PAGES) {
    const url = new URL(TICKET_TAILOR_ORDERS_ENDPOINT);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (startingAfter) {
      url.searchParams.set("starting_after", startingAfter);
    }

    const response = await fetch(url.toString(), {
      headers: getTicketTailorHeaders(apiKey),
      cache: "no-store",
    });

    pagesRead += 1;

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Ticket Tailor orders returned ${response.status}: ${body.slice(0, 240)}`,
      );
    }

    const payload = (await response.json()) as unknown;
    const page = extractRecords(payload);
    records.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    const lastOrderId = findString(page[page.length - 1], [
      "id",
      "order_id",
      "orderId",
      "object_id",
    ]);

    if (!lastOrderId || lastOrderId === startingAfter) {
      break;
    }

    startingAfter = lastOrderId;
  }

  return { records, pagesRead };
}

function getIssuedTickets(order: TicketTailorRecord) {
  const candidates = [
    getPath(order, "issued_tickets"),
    getPath(order, "tickets"),
    getPath(order, "order.issued_tickets"),
  ];

  const tickets = candidates.find(Array.isArray);
  return Array.isArray(tickets) ? tickets.filter(isRecord) : [];
}

function extractRecords(payload: unknown): TicketTailorRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  const candidates = [
    payload.data,
    payload.orders,
    payload.items,
    payload.results,
  ];
  const records = candidates.find(Array.isArray);

  return Array.isArray(records) ? records.filter(isRecord) : [];
}

function getTicketTailorHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
  };
}

function findString(record: TicketTailorRecord, paths: string[]) {
  for (const path of paths) {
    const value = getString(getPath(record, path));
    if (value) return value;
  }

  return null;
}

function findNumber(record: TicketTailorRecord, paths: string[]) {
  for (const path of paths) {
    const value = getPath(record, path);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function findBoolean(record: TicketTailorRecord, paths: string[]) {
  for (const path of paths) {
    const value = getPath(record, path);

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "checked_in"].includes(normalized)) return true;
      if (["false", "0", "no", "not_checked_in"].includes(normalized)) {
        return false;
      }
    }
  }

  return null;
}

function findIsoTimestamp(record: TicketTailorRecord, paths: string[]) {
  for (const path of paths) {
    const value = getPath(record, path);
    const timestamp = normalizeTimestamp(value);
    if (timestamp) return timestamp;
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

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() || null;
}

function getPath(record: TicketTailorRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!isRecord(value)) return undefined;
    return value[segment];
  }, record);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is TicketTailorRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
