import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TICKET_TAILOR_ISSUED_TICKETS_ENDPOINT =
  "https://api.tickettailor.com/v1/issued_tickets";
const MAX_PAGES = 100;
const PAGE_SIZE = 100;
const UPSERT_BATCH_SIZE = 200;

type TicketTailorRecord = Record<string, unknown>;

type SyncMessage = {
  level: "warning" | "error";
  ticketTailorIssuedTicketId?: string;
  message: string;
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
    const [{ records, pagesRead }, eventIdByTicketTailorId] = await Promise.all([
      fetchIssuedTickets(apiKey),
      loadEventMap(),
    ]);

    const rows: SupabaseIssuedTicketRow[] = [];
    let skipped = 0;

    for (const ticket of records) {
      const ticketId = findString(ticket, [
        "id",
        "issued_ticket_id",
        "issuedTicketId",
        "ticket_id",
        "barcode",
        "reference",
      ]);

      if (!ticketId) {
        skipped += 1;
        errors.push({
          level: "warning",
          message: "Issued ticket skipped because its id is missing.",
        });
        continue;
      }

      const orderId = findString(ticket, [
        "order_id",
        "orderId",
        "order.id",
        "order.object_id",
      ]);
      if (!orderId) {
        skipped += 1;
        errors.push({
          level: "warning",
          ticketTailorIssuedTicketId: ticketId,
          message: "Issued ticket skipped because its order id is missing.",
        });
        continue;
      }

      const ticketTailorEventId = findString(ticket, [
        "event_id",
        "eventId",
        "event.id",
        "event.event_id",
        "ticket_tailor_event_id",
      ]);

      rows.push({
        ticket_tailor_issued_ticket_id: ticketId,
        ticket_tailor_order_id: orderId,
        ticket_tailor_event_id: ticketTailorEventId,
        event_id: ticketTailorEventId
          ? eventIdByTicketTailorId.get(ticketTailorEventId) ?? null
          : null,
        ticket_type_name: findString(ticket, [
          "ticket_type_name",
          "ticket_type",
          "ticket_type.name",
          "ticket_type.description",
          "ticket_group_name",
        ]),
        holder_first_name: findString(ticket, [
          "first_name",
          "holder_first_name",
          "attendee_first_name",
          "ticket_holder.first_name",
          "holder.first_name",
        ]),
        holder_last_name: findString(ticket, [
          "last_name",
          "holder_last_name",
          "attendee_last_name",
          "ticket_holder.last_name",
          "holder.last_name",
        ]),
        holder_email: normalizeEmail(
          findString(ticket, [
            "email",
            "holder_email",
            "attendee_email",
            "ticket_holder.email",
            "holder.email",
          ]),
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

    let upserted = 0;

    for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
      const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
      const { error } = await supabase
        .from("ticket_tailor_issued_tickets")
        .upsert(batch, { onConflict: "ticket_tailor_issued_ticket_id" });

      if (error) {
        errors.push({ level: "error", message: error.message });
        continue;
      }

      upserted += batch.length;
    }

    return NextResponse.json({
      ok: !errors.some((error) => error.level === "error"),
      fetched: records.length,
      pagesRead,
      upserted,
      skipped,
      errors,
    });

    async function loadEventMap() {
      const { data, error } = await supabase
        .from("events")
        .select("id,ticket_tailor_event_id")
        .not("ticket_tailor_event_id", "is", null);

      if (error) {
        throw new Error(error.message);
      }

      return new Map(
        (data ?? [])
          .filter(
            (event): event is { id: string; ticket_tailor_event_id: string } =>
              typeof event.id === "string" &&
              typeof event.ticket_tailor_event_id === "string",
          )
          .map((event) => [event.ticket_tailor_event_id, event.id]),
      );
    }
  } catch (error) {
    console.error("[ticket-tailor sync] Direct issued-ticket sync failed", error);

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unexpected issued-ticket sync error.",
      },
      { status: 500 },
    );
  }
}

async function fetchIssuedTickets(apiKey: string) {
  const records: TicketTailorRecord[] = [];
  let pagesRead = 0;
  let nextUrl: string | null =
    `${TICKET_TAILOR_ISSUED_TICKETS_ENDPOINT}?limit=${PAGE_SIZE}`;

  while (nextUrl && pagesRead < MAX_PAGES) {
    const response = await fetch(nextUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
      cache: "no-store",
    });

    pagesRead += 1;

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Ticket Tailor issued_tickets returned ${response.status}: ${body.slice(0, 240)}`,
      );
    }

    const payload = (await response.json()) as unknown;
    records.push(...extractRecords(payload));
    nextUrl = normalizeNextUrl(findNextPageUrl(payload));
  }

  return { records, pagesRead };
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
    payload.issued_tickets,
    payload.items,
    payload.results,
  ];
  const array = candidates.find(Array.isArray);

  return Array.isArray(array) ? array.filter(isRecord) : [];
}

function findNextPageUrl(payload: unknown) {
  if (!isRecord(payload)) return null;

  return (
    getString(getPath(payload, "links.next")) ??
    getString(getPath(payload, "links.next.href")) ??
    getString(getPath(payload, "pagination.next")) ??
    null
  );
}

function normalizeNextUrl(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value, TICKET_TAILOR_ISSUED_TICKETS_ENDPOINT).toString();
  } catch {
    return null;
  }
}

function findString(record: TicketTailorRecord, paths: string[]) {
  for (const path of paths) {
    const value = getString(getPath(record, path));
    if (value) return value;
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

function getPath(record: TicketTailorRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!isRecord(value)) return undefined;
    return value[segment];
  }, record);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() || null;
}

function isRecord(value: unknown): value is TicketTailorRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
