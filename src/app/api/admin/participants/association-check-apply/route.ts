import { NextRequest, NextResponse } from "next/server";

import { applyParticipantAssociationCheck } from "@/lib/association/participants-association-check";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorizedResponse = validateAdminSecret(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  try {
    const report = await applyParticipantAssociationCheck(
      createSupabaseAdminClient(),
    );

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
      { ok: false, message: "ADMIN_SYNC_SECRET is not configured." },
      { status: 500 },
    );
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized request." },
      { status: 401 },
    );
  }

  return null;
}
