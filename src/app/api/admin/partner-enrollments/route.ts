import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id,title,starts_at")
    .eq("requires_partner", true);

  if (eventsError) {
    return NextResponse.json(
      { ok: false, message: eventsError.message },
      { status: 500 },
    );
  }

  const eventIds = (events ?? []).map((e) => e.id);
  if (eventIds.length === 0) {
    return NextResponse.json({ ok: true, rows: [] });
  }

  const eventsById = new Map((events ?? []).map((e) => [e.id, e]));

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("user_event_enrollments")
    .select(
      "id,ticket_tailor_order_id,partner_email,partner_name,partner_source,enrollment_status,event_id,profile_id",
    )
    .in("event_id", eventIds)
    .range(0, 999);

  if (enrollmentsError) {
    return NextResponse.json(
      { ok: false, message: enrollmentsError.message },
      { status: 500 },
    );
  }

  const enrollmentRows = enrollments ?? [];
  const profileIds = [
    ...new Set(
      enrollmentRows
        .map((e) => e.profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const profilesById = new Map<
    string,
    {
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      nickname: string | null;
    }
  >();

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email,first_name,last_name,nickname")
      .in("id", profileIds);

    for (const p of profiles ?? []) {
      profilesById.set(p.id as string, p as {
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        nickname: string | null;
      });
    }
  }

  const rows = enrollmentRows.map((e) => {
    const profile = e.profile_id ? profilesById.get(e.profile_id as string) : null;
    const event = e.event_id ? eventsById.get(e.event_id as string) : null;
    return {
      id: e.id,
      ticket_tailor_order_id: e.ticket_tailor_order_id,
      partner_email: e.partner_email,
      partner_name: e.partner_name,
      partner_source: e.partner_source,
      enrollment_status: e.enrollment_status,
      buyer_email: profile?.email ?? null,
      buyer_first_name: profile?.first_name ?? null,
      buyer_last_name: profile?.last_name ?? null,
      buyer_nickname: profile?.nickname ?? null,
      event_title: event?.title ?? null,
      event_starts_at: event?.starts_at ?? null,
    };
  });

  const sourceOrder: Record<string, number> = { ticket_tailor: 0, user: 1 };
  rows.sort((a, b) => {
    const aO = a.partner_source ? (sourceOrder[a.partner_source] ?? 2) : 3;
    const bO = b.partner_source ? (sourceOrder[b.partner_source] ?? 2) : 3;
    return aO - bO;
  });

  return NextResponse.json({ ok: true, rows });
}
