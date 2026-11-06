import { NextRequest, NextResponse } from "next/server";

import { saveManualValidation } from "@/lib/association/manual-validation";

export const dynamic = "force-dynamic";

// Validazione manuale dalla pagina admin: stessa funzione del gestionale
// (src/lib/association/manual-validation.ts), periodo corrente.
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };

  const result = await saveManualValidation({ email: body.email, firstName: body.first_name, lastName: body.last_name });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    created: result.created,
    expires_at: result.expiresAt,
  });
}
