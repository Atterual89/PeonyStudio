import type { SupabaseClient } from "@supabase/supabase-js";

import {
  readAssociationMembersFromGoogleSheet,
  type DetectedGoogleSheetColumns,
  type GoogleSheetMemberRow,
} from "@/lib/google/sheets";

export type AssociationMemberRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  contact: string | null;
  membership_status: string | null;
  membership_starts_at: string | null;
  membership_expires_at: string | null;
  source: string | null;
  source_row_id: string | null;
  source_hash: string | null;
  notes_admin: string | null;
};

export type AssociationMemberPreviewRow = {
  rowNumber: number;
  first_name: string;
  last_name: string;
  email: string | null;
  contact: string | null;
  membership_starts_at: string;
  membership_expires_at: string;
  source_row_id: string;
  matchMethod: "email" | "source_row_id" | "name" | "none";
  action: "create" | "update" | "unchanged" | "invalid" | "skipped";
  fallbackStartDate: boolean;
  errors: string[];
  notes: string[];
  existingMemberId: string | null;
  preserveManualStatus: boolean;
};

export type AssociationMembersSyncPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skippedBeforeValidFrom: number;
  wouldCreate: number;
  wouldUpdate: number;
  unchanged: number;
  fallbackStartDateCount: number;
  fallbackNameMatchCount: number;
  detectedColumns: DetectedGoogleSheetColumns;
  errors: string[];
  previewRows: AssociationMemberPreviewRow[];
  validSourceRows: GoogleSheetMemberRow[];
};

const ASSOCIATION_MEMBER_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "contact",
  "membership_status",
  "membership_starts_at",
  "membership_expires_at",
  "source",
  "source_row_id",
  "source_hash",
  "notes_admin",
].join(",");

const MANUAL_STATUS_VALUES = new Set(["pending", "manual_review", "expired"]);

export async function buildAssociationMembersSyncPreview(
  supabase: SupabaseClient,
) {
  const [sheetResult, existingMembers] = await Promise.all([
    readAssociationMembersFromGoogleSheet(),
    loadExistingAssociationMembers(supabase),
  ]);

  return buildPreview(sheetResult, existingMembers);
}

export async function applyAssociationMembersSync(supabase: SupabaseClient) {
  const preview = await buildAssociationMembersSyncPreview(supabase);
  const created: string[] = [];
  const updated: string[] = [];
  const errors = [...preview.errors];

  for (const previewRow of preview.previewRows) {
    if (
      previewRow.action === "invalid" ||
      previewRow.action === "unchanged" ||
      previewRow.action === "skipped"
    ) {
      continue;
    }

    const sourceRow = preview.validSourceRows.find(
      (row) => row.source_row_id === previewRow.source_row_id,
    );

    if (!sourceRow) {
      errors.push(`Riga ${previewRow.rowNumber}: dati normalizzati non trovati.`);
      continue;
    }

    const payload = previewRow.existingMemberId
      ? mapSheetRowToMemberUpdatePayload(sourceRow, previewRow.preserveManualStatus)
      : mapSheetRowToMemberInsertPayload(sourceRow);

    if (previewRow.existingMemberId) {
      const { error } = await supabase
        .from("association_members")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", previewRow.existingMemberId);

      if (error) {
        errors.push(`Riga ${previewRow.rowNumber}: ${error.message}`);
      } else {
        updated.push(previewRow.existingMemberId);
      }

      continue;
    }

    const { data, error } = await supabase
      .from("association_members")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      errors.push(`Riga ${previewRow.rowNumber}: ${error.message}`);
    } else if (isInsertedId(data)) {
      created.push(data.id);
    }
  }

  const removed = await removeStaleSourceRows(
    supabase,
    "google_sheet",
    new Set(preview.validSourceRows.map((row) => row.source_row_id)),
    errors,
  );

  return {
    ...serializePreview(preview),
    created: created.length,
    updated: updated.length,
    removed,
    errors,
  };
}

export function serializePreview(preview: AssociationMembersSyncPreview) {
  return {
    totalRows: preview.totalRows,
    validRows: preview.validRows,
    invalidRows: preview.invalidRows,
    skippedBeforeValidFrom: preview.skippedBeforeValidFrom,
    wouldCreate: preview.wouldCreate,
    wouldUpdate: preview.wouldUpdate,
    unchanged: preview.unchanged,
    fallbackStartDateCount: preview.fallbackStartDateCount,
    fallbackNameMatchCount: preview.fallbackNameMatchCount,
    detectedColumns: preview.detectedColumns,
    errors: preview.errors,
    previewRows: preview.previewRows,
  };
}

async function removeStaleSourceRows(
  supabase: SupabaseClient,
  source: string,
  currentSourceRowIds: Set<string>,
  errors: string[],
) {
  const existing: Array<{ id: string; source_row_id: string | null }> = [];
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("association_members")
      .select("id,source_row_id")
      .eq("source", source)
      .range(offset, offset + pageSize - 1);

    if (error) {
      errors.push(`Pulizia ${source}: ${error.message}`);
      return 0;
    }

    const page = (data ?? []) as Array<{
      id: string;
      source_row_id: string | null;
    }>;
    existing.push(...page);

    if (page.length < pageSize) break;
  }

  const staleIds = existing
    .filter(
      (row) =>
        !row.source_row_id || !currentSourceRowIds.has(row.source_row_id),
    )
    .map((row) => row.id);

  let removed = 0;
  for (let index = 0; index < staleIds.length; index += 100) {
    const ids = staleIds.slice(index, index + 100);
    const { error } = await supabase
      .from("association_members")
      .delete()
      .in("id", ids);

    if (error) {
      errors.push(`Pulizia ${source}: ${error.message}`);
    } else {
      removed += ids.length;
    }
  }

  return removed;
}

async function loadExistingAssociationMembers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("association_members")
    .select(ASSOCIATION_MEMBER_FIELDS)
    .eq("source", "google_sheet")
    .range(0, 9999);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown[]).filter(isAssociationMemberRecord);
}

function buildPreview(
  sheetResult: Awaited<ReturnType<typeof readAssociationMembersFromGoogleSheet>>,
  existingMembers: AssociationMemberRecord[],
): AssociationMembersSyncPreview {
  const existingByEmail = new Map(
    existingMembers
      .filter((member) => member.email)
      .map((member) => [member.email!.trim().toLowerCase(), member]),
  );
  const existingBySourceRowId = new Map(
    existingMembers
      .filter((member) => member.source_row_id)
      .map((member) => [member.source_row_id!, member]),
  );
  const existingByName = new Map<string, AssociationMemberRecord[]>();

  for (const member of existingMembers) {
    const key = normalizeNameKey(member.first_name, member.last_name);
    if (!key) continue;

    existingByName.set(key, [...(existingByName.get(key) ?? []), member]);
  }

  const previewRows = sheetResult.rows.map<AssociationMemberPreviewRow>((row) => {
    const rowErrors = row.errors.filter(
      (error) => !error.startsWith("Data iscrizione non valida"),
    );

    if (rowErrors.length > 0) {
      return {
        ...mapBasePreviewRow(row),
        matchMethod: "none",
        action: "invalid",
        errors: row.errors,
        notes: [],
        existingMemberId: null,
        preserveManualStatus: false,
      };
    }

    const match = findExistingMember(
      row,
      existingByEmail,
      existingBySourceRowId,
      existingByName,
    );
    const preserveManualStatus = match.member
      ? shouldPreserveManualStatus(match.member.membership_status)
      : false;
    const action = !match.member
      ? "create"
      : isAssociationMemberUpToDate(match.member, row, preserveManualStatus)
        ? "unchanged"
        : "update";

    return {
      ...mapBasePreviewRow(row),
      matchMethod: match.method,
      action,
      errors: row.errors,
      notes: match.member ? getManualStatusNotes(match.member) : [],
      existingMemberId: match.member?.id ?? null,
      preserveManualStatus,
    };
  });
  const validSourceRows = sheetResult.rows.filter((row) =>
    previewRows.some(
      (previewRow) =>
        previewRow.source_row_id === row.source_row_id &&
        previewRow.action !== "invalid" &&
        previewRow.action !== "skipped",
    ),
  );

  return {
    totalRows: sheetResult.totalRows,
    validRows: previewRows.filter((row) => row.action !== "invalid").length,
    invalidRows: previewRows.filter((row) => row.action === "invalid").length,
    skippedBeforeValidFrom: previewRows.filter((row) => row.action === "skipped")
      .length,
    wouldCreate: previewRows.filter((row) => row.action === "create").length,
    wouldUpdate: previewRows.filter((row) => row.action === "update").length,
    unchanged: previewRows.filter((row) => row.action === "unchanged").length,
    fallbackStartDateCount: sheetResult.rows.filter((row) => row.fallbackStartDate)
      .length,
    fallbackNameMatchCount: previewRows.filter((row) => row.matchMethod === "name")
      .length,
    detectedColumns: sheetResult.detectedColumns,
    errors: sheetResult.errors,
    previewRows,
    validSourceRows,
  };
}

function findExistingMember(
  row: GoogleSheetMemberRow,
  existingByEmail: Map<string, AssociationMemberRecord>,
  existingBySourceRowId: Map<string, AssociationMemberRecord>,
  existingByName: Map<string, AssociationMemberRecord[]>,
) {
  if (row.email) {
    const emailMatch = existingByEmail.get(row.email);
    if (emailMatch) return { member: emailMatch, method: "email" as const };
  }

  const sourceRowMatch = existingBySourceRowId.get(row.source_row_id);
  if (sourceRowMatch) {
    return { member: sourceRowMatch, method: "source_row_id" as const };
  }

  const nameMatches = existingByName.get(
    normalizeNameKey(row.first_name, row.last_name),
  );
  if (nameMatches?.length === 1) {
    return { member: nameMatches[0], method: "name" as const };
  }

  return { member: null, method: "none" as const };
}

function mapBasePreviewRow(row: GoogleSheetMemberRow) {
  return {
    rowNumber: row.rowNumber,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    contact: row.contact,
    membership_starts_at: row.membership_starts_at,
    membership_expires_at: row.membership_expires_at,
    source_row_id: row.source_row_id,
    fallbackStartDate: row.fallbackStartDate,
  };
}

function mapSheetRowToMemberInsertPayload(row: GoogleSheetMemberRow) {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    contact: row.contact,
    membership_status: row.membership_status,
    membership_starts_at: row.membership_starts_at,
    membership_expires_at: row.membership_expires_at,
    source: row.source,
    source_row_id: row.source_row_id,
    source_hash: row.source_hash,
  };
}

function mapSheetRowToMemberUpdatePayload(
  row: GoogleSheetMemberRow,
  preserveManualStatus: boolean,
) {
  const payload: Record<string, string | null> = {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    contact: row.contact,
    membership_starts_at: row.membership_starts_at,
    membership_expires_at: row.membership_expires_at,
    source: row.source,
    source_row_id: row.source_row_id,
    source_hash: row.source_hash,
  };

  if (!preserveManualStatus) {
    payload.membership_status = row.membership_status;
  }

  return payload;
}

function isAssociationMemberUpToDate(
  member: AssociationMemberRecord,
  row: GoogleSheetMemberRow,
  preserveManualStatus: boolean,
) {
  return (
    normalizeNullableText(member.first_name) === normalizeNullableText(row.first_name) &&
    normalizeNullableText(member.last_name) === normalizeNullableText(row.last_name) &&
    normalizeNullableEmail(member.email) === normalizeNullableEmail(row.email) &&
    normalizeNullableText(member.contact) === normalizeNullableText(row.contact) &&
    member.membership_starts_at === row.membership_starts_at &&
    member.membership_expires_at === row.membership_expires_at &&
    member.source === row.source &&
    member.source_row_id === row.source_row_id &&
    member.source_hash === row.source_hash &&
    (preserveManualStatus || member.membership_status === row.membership_status)
  );
}

function normalizeNullableText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeNullableEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function shouldPreserveManualStatus(status: string | null) {
  return MANUAL_STATUS_VALUES.has(status?.trim() ?? "");
}

function getManualStatusNotes(member: AssociationMemberRecord) {
  return shouldPreserveManualStatus(member.membership_status)
    ? [`Status manuale conservato: ${member.membership_status}`]
    : [];
}

function normalizeNameKey(firstName: string | null, lastName: string | null) {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  return first && last ? `${first} ${last}` : "";
}

function normalizeNamePart(value: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isAssociationMemberRecord(
  value: unknown,
): value is AssociationMemberRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function isInsertedId(value: unknown): value is { id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}
