import { NextRequest, NextResponse } from "next/server";

import { applyOfficialMembersBookSync } from "@/lib/association/members-book-sync";
import { applyAssociationMembersSync } from "@/lib/association/members-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Keep the two sources distinct: Google Form proves registration,
    // official members book proves the current-year payment.
    const form = await applyAssociationMembersSync(supabase);
    const book = await applyOfficialMembersBookSync(supabase);

    const formErrors = Array.isArray(form.errors) ? form.errors : [];
    const bookErrors = Array.isArray(book.errors) ? book.errors : [];
    const errors = [...formErrors, ...bookErrors];

    return NextResponse.json({
      ok: errors.length === 0,
      form: {
        totalRows: form.totalRows,
        created: form.created ?? 0,
        updated: form.updated ?? 0,
        unchanged: form.unchanged,
        skippedBeforeValidFrom: form.skippedBeforeValidFrom,
      },
      book: {
        totalRows: book.totalRows,
        created: book.created ?? 0,
        updated: book.updated ?? 0,
        unchanged: book.unchanged,
        verifiedRows: book.verifiedRows,
        expiredRows: book.expiredRows,
      },
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Errore durante l'aggiornamento tesseramenti.",
      },
      { status: 500 },
    );
  }
}
