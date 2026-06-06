import type { SupabaseClient } from "@supabase/supabase-js";

import {
  readOfficialMembersBookFromGoogleSheet,
  type DetectedMembersBookColumns,
  type OfficialMembersBookRow,
} from "@/lib/google/members-book";

type OfficialMemberRecord = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  fiscal_code: string | null;
  birth_date: string | null;
  membership_status: string | null;
  membership_starts_at: string | null;
  membership_expires_at: string | null;
  membership_card_number: string | null;
  source: string | null;
  source_row_id: string | null;
  source_hash: string | null;
  notes_admin: string | null;
};

export type OfficialMembersBookPreviewRow = {
  rowNumber: number;
  first_name: string;
  last_name: string;
  fiscal_code: string | null;
  birth_date: string | null;
  membership_status: "verified" | "expired";
  membership_starts_at: string | null;
  membership_expires_at: string;
  membership_card_number: string | null;
  action: "create" | "update" | "unchanged" | "invalid";
  matchMethod: "fiscal_code" | "email" | "name_birth" | "name" | "none";
  existingMemberId: string | null;
  preserveManualStatus: boolean;
  errors: string[];
  notes: string[];
};

export type OfficialMembersBookSyncPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  wouldCreate: number;
  wouldUpdate: number;
  unchanged: number;
  expiredRows: number;
  verifiedRows: number;
  fallbackNameMatchCount: number;
  errors: string[];
  detectedColumns: DetectedMembersBookColumns;
  previewRows: OfficialMembersBookPreviewRow[];
  validSourceRows: OfficialMembersBookRow[];
};

const OFFICIAL_MEMBER_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "fiscal_code",
  "birth_date",
  "membership_status",
  "membership_starts_at",
  "membership_expires_at",
  "membership_card_number",
  "source",
  "source_row_id",
  "source_hash",
  "notes_admin",
].join(",");

const PRESERVED_MANUAL_STATUSES = new Set(["pending", "manual_review"]);

export async function buildOfficialMembersBookSyncPreview(
  supabase: SupabaseClient,
) {
  const [sheetResult, existingMembers] = await Promise.all([
    readOfficialMembersBookFromGoogleSheet(),
    loadExistingMembers(supabase),
  ]);

  return buildPreview(sheetResult, existingMembers);
}

export async function applyOfficialMembersBookSync(supabase: SupabaseClient) {
  const preview = await buildOfficialMembersBookSyncPreview(supabase);
  const errors = [...preview.errors];
  let created = 0;
  let updated = 0;

  for (const previewRow of preview.previewRows) {
    if (previewRow.action === "invalid" || previewRow.action === "unchanged") {
      continue;
    }

    const sourceRow = preview.validSourceRows.find(
      (row) => row.rowNumber === previewRow.rowNumber,
    );
    if (!sourceRow) {
      errors.push(`Riga ${previewRow.rowNumber}: dati normalizzati non trovati.`);
      continue;
    }

    if (previewRow.existingMemberId) {
      const { error } = await supabase
        .from("association_members")
        .update({
          ...mapBookRowToUpdatePayload(sourceRow, previewRow.preserveManualStatus),
          updated_at: new Date().toISOString(),
        })
        .eq("id", previewRow.existingMemberId);

      if (error) {
        errors.push(`Riga ${previewRow.rowNumber}: ${error.message}`);
      } else {
        updated += 1;
      }
      continue;
    }

    const { error } = await supabase
      .from("association_members")
      .insert(mapBookRowToInsertPayload(sourceRow));

    if (error) {
      errors.push(`Riga ${previewRow.rowNumber}: ${error.message}`);
    } else {
      created += 1;
    }
  }

  return {
    ...serializeOfficialMembersBookPreview(preview),
    created,
    updated,
    errors,
  };
}

export function serializeOfficialMembersBookPreview(
  preview: OfficialMembersBookSyncPreview,
) {
  return {
    totalRows: preview.totalRows,
    validRows: preview.validRows,
    invalidRows: preview.invalidRows,
    wouldCreate: preview.wouldCreate,
    wouldUpdate: preview.wouldUpdate,
    unchanged: preview.unchanged,
    expiredRows: preview.expiredRows,
    verifiedRows: preview.verifiedRows,
    fallbackNameMatchCount: preview.fallbackNameMatchCount,
    errors: preview.errors,
    detectedColumns: preview.detectedColumns,
    previewRows: preview.previewRows,
  };
}

async function loadExistingMembers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("association_members")
    .select(OFFICIAL_MEMBER_FIELDS)
    .range(0, 9999);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(isOfficialMemberRecord);
}

function buildPreview(
  sheetResult: Awaited<ReturnType<typeof readOfficialMembersBookFromGoogleSheet>>,
  existingMembers: OfficialMemberRecord[],
): OfficialMembersBookSyncPreview {
  const indexes = createExistingIndexes(existingMembers);
  const previewRows = sheetResult.rows.map<OfficialMembersBookPreviewRow>((row) => {
    if (row.errors.length > 0) {
      return {
        ...mapBasePreviewRow(row),
        action: "invalid",
        matchMethod: "none",
        existingMemberId: null,
        preserveManualStatus: false,
        errors: row.errors,
        notes: [],
      };
    }

    const match = findExistingMember(row, indexes);
    const preserveManualStatus = shouldPreserveManualStatus(
      match.member?.membership_status ?? null,
    );
    const action = !match.member
      ? "create"
      : match.member.source_hash === row.source_hash
        ? "unchanged"
        : "update";

    return {
      ...mapBasePreviewRow(row),
      action,
      matchMethod: match.method,
      existingMemberId: match.member?.id ?? null,
      preserveManualStatus,
      errors: [],
      notes: [
        ...(match.method === "name"
          ? ["Match fallback su nome/cognome normalizzati."]
          : []),
        ...(preserveManualStatus && match.member?.membership_status
          ? [`Status manuale conservato: ${match.member.membership_status}`]
          : []),
      ],
    };
  });

  const validSourceRows = sheetResult.rows.filter((row) =>
    previewRows.some(
      (previewRow) =>
        previewRow.rowNumber === row.rowNumber && previewRow.action !== "invalid",
    ),
  );

  return {
    totalRows: sheetResult.totalRows,
    validRows: previewRows.filter((row) => row.action !== "invalid").length,
    invalidRows: previewRows.filter((row) => row.action === "invalid").length,
    wouldCreate: previewRows.filter((row) => row.action === "create").length,
    wouldUpdate: previewRows.filter((row) => row.action === "update").length,
    unchanged: previewRows.filter((row) => row.action === "unchanged").length,
    expiredRows: previewRows.filter((row) => row.membership_status === "expired")
      .length,
    verifiedRows: previewRows.filter((row) => row.membership_status === "verified")
      .length,
    fallbackNameMatchCount: previewRows.filter((row) => row.matchMethod === "name")
      .length,
    errors: sheetResult.errors,
    detectedColumns: sheetResult.detectedColumns,
    previewRows,
    validSourceRows,
  };
}

function createExistingIndexes(existingMembers: OfficialMemberRecord[]) {
  const byFiscalCode = new Map<string, OfficialMemberRecord>();
  const byEmail = new Map<string, OfficialMemberRecord>();
  const byNameBirth = new Map<string, OfficialMemberRecord[]>();
  const byName = new Map<string, OfficialMemberRecord[]>();

  for (const member of existingMembers) {
    if (member.fiscal_code) {
      byFiscalCode.set(member.fiscal_code.trim().toUpperCase(), member);
    }
    if (member.email) {
      byEmail.set(member.email.trim().toLowerCase(), member);
    }

    const nameBirthKey = createNameBirthKey(
      member.first_name,
      member.last_name,
      member.birth_date,
    );
    if (nameBirthKey) {
      byNameBirth.set(nameBirthKey, [...(byNameBirth.get(nameBirthKey) ?? []), member]);
    }

    const nameKey = createNameKey(member.first_name, member.last_name);
    if (nameKey) {
      byName.set(nameKey, [...(byName.get(nameKey) ?? []), member]);
    }
  }

  return { byFiscalCode, byEmail, byNameBirth, byName };
}

function findExistingMember(
  row: OfficialMembersBookRow,
  indexes: ReturnType<typeof createExistingIndexes>,
) {
  if (row.fiscal_code) {
    const match = indexes.byFiscalCode.get(row.fiscal_code);
    if (match) return { member: match, method: "fiscal_code" as const };
  }
  if (row.email) {
    const match = indexes.byEmail.get(row.email);
    if (match) return { member: match, method: "email" as const };
  }
  if (row.match_key_name_birth) {
    const matches = indexes.byNameBirth.get(row.match_key_name_birth);
    if (matches?.length === 1) {
      return { member: matches[0], method: "name_birth" as const };
    }
  }

  const nameMatches = indexes.byName.get(row.match_key_name);
  if (nameMatches?.length === 1) {
    return { member: nameMatches[0], method: "name" as const };
  }

  return { member: null, method: "none" as const };
}

function mapBasePreviewRow(row: OfficialMembersBookRow) {
  return {
    rowNumber: row.rowNumber,
    first_name: row.first_name,
    last_name: row.last_name,
    fiscal_code: row.fiscal_code,
    birth_date: row.birth_date,
    membership_status: row.membership_status,
    membership_starts_at: row.membership_starts_at,
    membership_expires_at: row.membership_expires_at,
    membership_card_number: row.membership_card_number,
  };
}

function mapBookRowToInsertPayload(row: OfficialMembersBookRow) {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    fiscal_code: row.fiscal_code,
    birth_date: row.birth_date,
    membership_status: row.membership_status,
    membership_starts_at: row.membership_starts_at,
    membership_expires_at: row.membership_expires_at,
    membership_card_number: row.membership_card_number,
    source: row.source,
    source_row_id: row.source_row_id,
    source_hash: row.source_hash,
  };
}

function mapBookRowToUpdatePayload(
  row: OfficialMembersBookRow,
  preserveManualStatus: boolean,
) {
  const payload: Record<string, string | null> = {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    fiscal_code: row.fiscal_code,
    birth_date: row.birth_date,
    membership_starts_at: row.membership_starts_at,
    membership_expires_at: row.membership_expires_at,
    membership_card_number: row.membership_card_number,
    source: row.source,
    source_row_id: row.source_row_id,
    source_hash: row.source_hash,
  };

  if (!preserveManualStatus) {
    payload.membership_status = row.membership_status;
  }

  return payload;
}

function shouldPreserveManualStatus(status: string | null) {
  return PRESERVED_MANUAL_STATUSES.has(status?.trim() ?? "");
}

function createNameBirthKey(
  firstName: string | null,
  lastName: string | null,
  birthDate: string | null,
) {
  const nameKey = createNameKey(firstName, lastName);
  return nameKey && birthDate ? `${nameKey} ${birthDate}` : "";
}

function createNameKey(firstName: string | null, lastName: string | null) {
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

function isOfficialMemberRecord(value: unknown): value is OfficialMemberRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}
