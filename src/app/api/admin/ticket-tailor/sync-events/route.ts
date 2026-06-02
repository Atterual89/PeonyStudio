import { NextRequest, NextResponse } from "next/server";

import type { PeonyEvent } from "@/lib/events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTicketTailorEvents } from "@/lib/ticketTailor";

export const dynamic = "force-dynamic";

type SyncError = {
  ticketTailorEventId?: string;
  title?: string;
  message: string;
};

type SupabaseEventRow = {
  slug: string;
  title: string;
  category: string;
  source: "ticket_tailor";
  ticket_tailor_event_id: string;
  starts_at: string;
  ends_at: string | null;
  booking_url: string | null;
  image_url: string | null;
  is_public: boolean;
  raw_payload: {
    normalized: PeonyEvent;
    ticket_tailor_original?: Record<string, unknown>;
  };
};

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized sync request.",
      },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const events = await getTicketTailorEvents();
  const errors: SyncError[] = [];
  let upserted = 0;
  let skipped = 0;

  for (const event of events) {
    const row = mapTicketTailorEventToSupabaseRow(event);

    if (!row) {
      skipped += 1;
      errors.push({
        ticketTailorEventId: event.ticketTailorId,
        title: event.title,
        message: "Missing Ticket Tailor id or start date.",
      });
      continue;
    }

    const { error } = await supabase
      .from("events")
      .upsert(row, { onConflict: "ticket_tailor_event_id" });

    if (error) {
      console.error("[ticket-tailor sync] Event upsert failed", {
        ticketTailorEventId: row.ticket_tailor_event_id,
        title: row.title,
        message: error.message,
      });

      errors.push({
        ticketTailorEventId: row.ticket_tailor_event_id,
        title: row.title,
        message: error.message,
      });
      continue;
    }

    upserted += 1;
  }

  return NextResponse.json({
    ok: errors.length === 0,
    fetched: events.length,
    upserted,
    skipped,
    errors,
  });
}

function mapTicketTailorEventToSupabaseRow(
  event: PeonyEvent,
): SupabaseEventRow | null {
  if (!event.ticketTailorId || !event.date) {
    return null;
  }

  return {
    slug: event.slug || `ticket-tailor-${event.ticketTailorId}`,
    title: event.title,
    category: event.category,
    source: "ticket_tailor",
    ticket_tailor_event_id: event.ticketTailorId,
    starts_at: buildTimestamp(event.date, event.startTime),
    ends_at: event.endDate ? buildTimestamp(event.endDate, event.endTime) : null,
    booking_url: event.bookingUrl ?? event.sourceUrl ?? null,
    image_url: event.imageUrl ?? null,
    is_public: event.isPublic,
    raw_payload: {
      normalized: event,
      ticket_tailor_original: event.rawTicketTailorPayload,
    },
  };
}

function buildTimestamp(date: string, time?: string) {
  const safeTime = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";

  return `${date}T${safeTime}:00+01:00`;
}
