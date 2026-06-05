import { NextRequest, NextResponse } from "next/server";

import { applyAssociationMembersSync } from "@/lib/association/members-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorizedResponse = validateAdminSecret(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  try {
    const supabase = createSupabaseAdminClient();
    const report = await applyAssociationMembersSync(supabase);

    return NextResponse.json({
      ok: report.errors.length === 0,
      ...report,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Errore sconosciuto.",
      },
      { status: 500 },
    );
  }
}

function validateAdminSecret(request: NextRequest) {
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

  return null;
}
