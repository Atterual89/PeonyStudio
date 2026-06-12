import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_ASSOCIATION_STATUSES = [
  "unknown",
  "missing",
  "pending",
  "verified",
  "expired",
  "archived",
  "manual_review",
  "not_found",
  "not_required",
] as const;

const ALLOWED_BODY_KEYS = new Set([
  "association_status",
  "association_expires_at",
  "notes_admin",
]);

type AssociationStatus = (typeof ALLOWED_ASSOCIATION_STATUSES)[number];

type PatchContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: PatchContext) {
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

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Participant id is required.",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Body must be a JSON object.",
      },
      { status: 400 },
    );
  }

  const unsupportedKeys = Object.keys(body).filter(
    (key) => !ALLOWED_BODY_KEYS.has(key),
  );

  if (unsupportedKeys.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unsupported fields in body.",
        unsupportedKeys,
      },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, string | null> = {};

  if ("association_status" in body) {
    const status = normalizeAssociationStatus(body.association_status);
    if (!status) {
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid association_status.",
          allowedValues: ALLOWED_ASSOCIATION_STATUSES,
        },
        { status: 400 },
      );
    }

    updatePayload.association_status = status;
  }

  if ("association_expires_at" in body) {
    const expiresAt = normalizeDateOrNull(body.association_expires_at);
    if (expiresAt === undefined) {
      return NextResponse.json(
        {
          ok: false,
          message: "association_expires_at must be YYYY-MM-DD or null.",
        },
        { status: 400 },
      );
    }

    updatePayload.association_expires_at = expiresAt;
  }

  if ("notes_admin" in body) {
    const notes = normalizeTextOrNull(body.notes_admin);
    if (notes === undefined) {
      return NextResponse.json(
        {
          ok: false,
          message: "notes_admin must be a string or null.",
        },
        { status: 400 },
      );
    }

    updatePayload.notes_admin = notes;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "No allowed fields to update.",
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const payloadWithUpdatedAt = {
    ...updatePayload,
    updated_at: new Date().toISOString(),
  };

  const initialResult = await supabase
    .from("event_participants")
    .update(payloadWithUpdatedAt)
    .eq("id", id.trim())
    .select(
      "id,association_status,association_expires_at,notes_admin,updated_at",
    )
    .single();
  let data: Record<string, unknown> | null = initialResult.data;
  let error = initialResult.error;

  if (error && mentionsMissingUpdatedAt(error.message)) {
    const retry = await supabase
      .from("event_participants")
      .update(updatePayload)
      .eq("id", id.trim())
      .select("id,association_status,association_expires_at,notes_admin")
      .single();

    data = retry.data;
    error = retry.error;
  }

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
    participant: data,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAssociationStatus(value: unknown): AssociationStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return ALLOWED_ASSOCIATION_STATUSES.includes(
    normalized as AssociationStatus,
  )
    ? (normalized as AssociationStatus)
    : null;
}

function normalizeDateOrNull(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    return undefined;
  }

  return normalized;
}

function normalizeTextOrNull(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 1000) : null;
}

function mentionsMissingUpdatedAt(message: string) {
  return message.toLowerCase().includes("updated_at");
}
