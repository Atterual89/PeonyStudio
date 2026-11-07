import { NextRequest, NextResponse } from "next/server";


import { applyAssociationMembersSync } from "@/lib/association/members-sync";
import { applyOfficialMembersBookSync } from "@/lib/association/members-book-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withSupabaseClockSkewReportRetry } from "@/lib/supabase/retry";

export const dynamic = "force-dynamic";

import { MAX_BOOK_FILE_SIZE, parseWorkbook, replaceMembersBook, validateMembersBook } from "@/lib/association/book-upload";

export async function POST(request: NextRequest) {
  const unauthorized = validateAdminSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Seleziona un file Excel .xlsx." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { ok: false, message: "Sono supportati solo file .xlsx." },
        { status: 400 },
      );
    }

    if (file.size <= 0 || file.size > MAX_BOOK_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, message: "Il file è vuoto o supera il limite di 12 MB." },
        { status: 400 },
      );
    }

    const values = parseWorkbook(Buffer.from(await file.arrayBuffer()));
    validateMembersBook(values);

    const upload = await replaceMembersBook(values);

    const supabase = createSupabaseAdminClient();
    const formReport = await withSupabaseClockSkewReportRetry(() =>
      applyAssociationMembersSync(supabase, { removeStaleRows: false }),
    );
    const bookReport = await withSupabaseClockSkewReportRetry(() =>
      applyOfficialMembersBookSync(supabase, { removeStaleRows: false }),
    );

    const errors = [...formReport.errors, ...bookReport.errors];

    return NextResponse.json({
      ok: errors.length === 0,
      backupTitle: upload.backupTitle,
      importedRows: upload.importedRows,
      formSync: summarize(formReport),
      bookSync: summarize(bookReport),
      errors,
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

function summarize(report: {
  created: number;
  updated: number;
  unchanged: number;
  removed?: number;
  invalidRows: number;
}) {
  return {
    created: report.created,
    updated: report.updated,
    unchanged: report.unchanged,
    removed: report.removed ?? 0,
    invalidRows: report.invalidRows,
  };
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
