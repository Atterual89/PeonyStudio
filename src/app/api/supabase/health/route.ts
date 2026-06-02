import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing Supabase environment variables.",
      },
      { status: 500 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("events").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    checkedTable: "events",
    hasRows: Boolean(data?.length),
  });
}
