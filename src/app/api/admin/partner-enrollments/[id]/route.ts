import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PatchContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: PatchContext) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id." }, { status: 400 });
  }

  const body = (await request.json()) as {
    partner_email?: string | null;
    partner_name?: string | null;
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("user_event_enrollments")
    .update({
      partner_email: body.partner_email ?? null,
      partner_name: body.partner_name ?? null,
      partner_source: "user",
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
