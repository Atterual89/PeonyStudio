import { NextRequest, NextResponse } from "next/server";

import { revokeManualValidation } from "@/lib/association/manual-validation";

export const dynamic = "force-dynamic";

// "Annulla validazione manuale" dalla pagina admin: le righe manual_override
// della persona (periodo corrente) passano a 'revoked'. Nessun'altra riga cambia.
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

  const result = await revokeManualValidation({ email: body.email, firstName: body.first_name, lastName: body.last_name });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true, revoked: result.revoked });
}
