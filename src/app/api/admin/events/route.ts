import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const EVENT_FIELDS = [
  "id",
  "slug",
  "title",
  "category",
  "source",
  "ticket_tailor_event_id",
  "starts_at",
  "ends_at",
  "is_public",
  "booking_url",
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

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_FIELDS)
    .order("starts_at", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        count: 0,
        events: [],
        error: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    count: data?.length ?? 0,
    events: data ?? [],
  });
}
