import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PARTICIPANT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "participant_type",
  "ticket_tailor_order_id",
  "ticket_tailor_event_id",
  "association_status",
  "association_expires_at",
  "notes_admin",
].join(",");

type AssociationImportInputRow = {
  first_name: string;
  last_name: string;
};

type AssociationImportInvalidRow = {
  index: number;
  reason: string;
};

type EventParticipantMatch = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  participant_type: string | null;
  ticket_tailor_order_id: string | null;
  ticket_tailor_event_id: string | null;
  association_status: string | null;
  association_expires_at: string | null;
  notes_admin: string | null;
};

type AssociationImportResult = {
  input: AssociationImportInputRow;
  normalized_key: string;
  match_status: "unique" | "multiple" | "not_found";
  matches: EventParticipantMatch[];
};

type EventParticipantCandidate = EventParticipantMatch & {
  normalized_key: string;
};

export async function POST(request: NextRequest) {
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid JSON payload.",
      },
      { status: 400 },
    );
  }

  const rows = parseInputRows(payload);
  const validRows = rows.filter(
    (row): row is AssociationImportInputRow => !("reason" in row),
  );
  const invalidRows = rows.filter(
    (row): row is AssociationImportInvalidRow => "reason" in row,
  );

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("event_participants")
    .select(PARTICIPANT_FIELDS)
    .range(0, 9999);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Could not load event_participants.",
        error: error.message,
      },
      { status: 500 },
    );
  }

  const rawParticipants = (data ?? []) as unknown[];
  const candidates = rawParticipants
    .filter(isEventParticipantMatch)
    .map<EventParticipantCandidate>((participant) => ({
      id: participant.id,
      first_name: participant.first_name,
      last_name: participant.last_name,
      email: participant.email,
      participant_type: participant.participant_type,
      ticket_tailor_order_id: participant.ticket_tailor_order_id,
      ticket_tailor_event_id: participant.ticket_tailor_event_id,
      association_status: participant.association_status,
      association_expires_at: participant.association_expires_at,
      notes_admin: participant.notes_admin,
      normalized_key: createNameKey(
        participant.first_name ?? "",
        participant.last_name ?? "",
      ),
    }));
  const candidatesByKey = new Map<string, EventParticipantMatch[]>();

  for (const candidate of candidates) {
    if (!candidate.normalized_key) {
      continue;
    }

    const current = candidatesByKey.get(candidate.normalized_key) ?? [];
    current.push(stripNormalizedKey(candidate));
    candidatesByKey.set(candidate.normalized_key, current);
  }

  const results = validRows.map<AssociationImportResult>((row) => {
    const normalizedKey = createNameKey(row.first_name, row.last_name);
    const matches = candidatesByKey.get(normalizedKey) ?? [];

    return {
      input: row,
      normalized_key: normalizedKey,
      match_status:
        matches.length === 1
          ? "unique"
          : matches.length > 1
            ? "multiple"
            : "not_found",
      matches,
    };
  });

  return NextResponse.json({
    ok: true,
    totalInput: Array.isArray((payload as { rows?: unknown }).rows)
      ? (payload as { rows: unknown[] }).rows.length
      : 0,
    uniqueMatches: results.filter((result) => result.match_status === "unique")
      .length,
    multipleMatches: results.filter(
      (result) => result.match_status === "multiple",
    ).length,
    notFound: results.filter((result) => result.match_status === "not_found")
      .length,
    invalidRows: invalidRows.length,
    results,
  });
}

function parseInputRows(
  payload: unknown,
): Array<AssociationImportInputRow | AssociationImportInvalidRow> {
  if (!isRowsPayload(payload)) {
    return [
      {
        index: 0,
        reason: "Payload rows must be an array.",
      },
    ];
  }

  return payload.rows.map((row, index) => {
    if (!isInputRow(row)) {
      return {
        index,
        reason: "Row must include first_name and last_name.",
      };
    }

    const firstName = row.first_name.trim().replace(/\s+/g, " ");
    const lastName = row.last_name.trim().replace(/\s+/g, " ");

    if (!firstName || !lastName) {
      return {
        index,
        reason: "Row must include first_name and last_name.",
      };
    }

    return {
      first_name: firstName,
      last_name: lastName,
    };
  });
}

function isRowsPayload(payload: unknown): payload is { rows: unknown[] } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "rows" in payload &&
    Array.isArray((payload as { rows?: unknown }).rows)
  );
}

function isInputRow(row: unknown): row is AssociationImportInputRow {
  return (
    typeof row === "object" &&
    row !== null &&
    "first_name" in row &&
    "last_name" in row &&
    typeof (row as { first_name?: unknown }).first_name === "string" &&
    typeof (row as { last_name?: unknown }).last_name === "string"
  );
}

function isEventParticipantMatch(
  participant: unknown,
): participant is EventParticipantMatch {
  return (
    typeof participant === "object" &&
    participant !== null &&
    typeof (participant as { id?: unknown }).id === "string"
  );
}

function createNameKey(firstName: string, lastName: string) {
  return `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.trim();
}

function normalizeNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function stripNormalizedKey(
  candidate: EventParticipantCandidate,
): EventParticipantMatch {
  return {
    id: candidate.id,
    first_name: candidate.first_name,
    last_name: candidate.last_name,
    email: candidate.email,
    participant_type: candidate.participant_type,
    ticket_tailor_order_id: candidate.ticket_tailor_order_id,
    ticket_tailor_event_id: candidate.ticket_tailor_event_id,
    association_status: candidate.association_status,
    association_expires_at: candidate.association_expires_at,
    notes_admin: candidate.notes_admin,
  };
}
