import { NextRequest, NextResponse } from "next/server";

import {
  CURRENT_MEMBERSHIP_EXPIRY,
  CURRENT_MEMBERSHIP_START,
  normalizeMembershipEmail,
  normalizeMembershipNameKey,
} from "@/lib/association/membership-state";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withSupabaseClockSkewRetry } from "@/lib/supabase/retry";

export const dynamic = "force-dynamic";

type ManualMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

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

  const email = normalizeMembershipEmail(body.email);
  const firstName = normalizeText(body.first_name);
  const lastName = normalizeText(body.last_name);
  const nameKey = normalizeMembershipNameKey(firstName, lastName);

  if (!email && !nameKey) {
    return NextResponse.json(
      {
        ok: false,
        message: "Inserisci un indirizzo email oppure nome e cognome.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const existingResult = await withSupabaseClockSkewRetry(
    async () =>
      await supabase
        .from("association_members")
        .select("id,first_name,last_name,email")
        .eq("source", "manual_override")
        .range(0, 9999),
    (result) => result.error,
  );

  if (existingResult.error) {
    return NextResponse.json(
      { ok: false, message: existingResult.error.message },
      { status: 500 },
    );
  }

  const existing = ((existingResult.data ?? []) as ManualMemberRow[]).find((row) => {
    const rowEmail = normalizeMembershipEmail(row.email);
    const rowNameKey = normalizeMembershipNameKey(row.first_name, row.last_name);

    return Boolean(
      (email && rowEmail === email) ||
        (nameKey && rowNameKey === nameKey),
    );
  });

  const payload = {
    first_name: firstName || null,
    last_name: lastName || null,
    email: email || null,
    membership_status: "verified",
    membership_starts_at: CURRENT_MEMBERSHIP_START,
    membership_expires_at: CURRENT_MEMBERSHIP_EXPIRY,
    source: "manual_override",
    source_row_id: makeSourceRowId(email, nameKey),
    source_hash: null,
    notes_admin: "Validazione manuale da admin",
    updated_at: new Date().toISOString(),
  };

  const saveResult = await withSupabaseClockSkewRetry(
    async () =>
      existing
        ? await supabase
            .from("association_members")
            .update(payload)
            .eq("id", existing.id)
            .select("id")
            .single()
        : await supabase
            .from("association_members")
            .insert(payload)
            .select("id")
            .single(),
    (result) => result.error,
  );

  if (saveResult.error) {
    return NextResponse.json(
      { ok: false, message: saveResult.error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: saveResult.data?.id ?? existing?.id ?? null,
    created: !existing,
    expires_at: CURRENT_MEMBERSHIP_EXPIRY,
  });
}

function normalizeText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function makeSourceRowId(email: string, nameKey: string) {
  return email ? `manual:email:${email}` : `manual:name:${nameKey}`;
}
