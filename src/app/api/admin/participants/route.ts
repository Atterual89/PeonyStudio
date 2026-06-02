import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PARTICIPANT_FIELDS = [
  "id",
  "event_id",
  "ticket_tailor_event_id",
  "first_name",
  "last_name",
  "email",
  "participant_type",
  "ticket_tailor_order_id",
  "ticket_tailor_issued_ticket_id",
  "association_status",
  "association_expires_at",
  "checked_in",
  "checked_in_source",
  "partner_status",
  "notes_admin",
].join(",");

export async function GET(request: NextRequest) {
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
        message: "Unauthorized request.",
      },
      { status: 401 },
    );
  }

  const params = request.nextUrl.searchParams;
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("event_participants")
    .select(PARTICIPANT_FIELDS)
    .order("ticket_tailor_event_id", { ascending: true, nullsFirst: false })
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .order("participant_type", { ascending: true, nullsFirst: false });

  query = applyStringFilter(query, "event_id", params.get("event_id"));
  query = applyStringFilter(
    query,
    "ticket_tailor_event_id",
    params.get("ticket_tailor_event_id"),
  );
  query = applyStringFilter(
    query,
    "participant_type",
    params.get("participant_type"),
  );
  query = applyStringFilter(
    query,
    "association_status",
    params.get("association_status"),
  );

  const checkedIn = parseBooleanParam(params.get("checked_in"));
  if (checkedIn !== null) {
    query = query.eq("checked_in", checkedIn);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        count: 0,
        participants: [],
        error: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    participants: data ?? [],
  });
}

function applyStringFilter<T>(
  query: T,
  column: string,
  value: string | null,
): T {
  if (!value?.trim()) {
    return query;
  }

  return (query as { eq: (column: string, value: string) => T }).eq(
    column,
    value.trim(),
  );
}

function parseBooleanParam(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;

  return null;
}
