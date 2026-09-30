import type { SupabaseClient } from "@supabase/supabase-js";

import {
  readLegacyMembers2025FromGoogleSheet,
  type LegacyMember2025Row,
} from "@/lib/google/legacy-members-2025";

type ExistingLegacyMember = {
  id: string;
  source_row_id: string | null;
  source_hash: string | null;
};

export async function applyLegacyMembers2025Sync(supabase: SupabaseClient) {
  const [sourceRows, existingRowsResult] = await Promise.all([
    readLegacyMembers2025FromGoogleSheet(),
    supabase
      .from("association_members")
      .select("id,source_row_id,source_hash")
      .eq("source", "legacy_members_2025")
      .range(0, 9999),
  ]);

  if (existingRowsResult.error) {
    throw new Error(existingRowsResult.error.message);
  }

  const existingBySourceRowId = new Map(
    ((existingRowsResult.data ?? []) as ExistingLegacyMember[])
      .filter((row) => row.source_row_id)
      .map((row) => [row.source_row_id as string, row]),
  );

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const errors: string[] = [];

  for (const row of sourceRows) {
    const existing = existingBySourceRowId.get(row.source_row_id);

    if (existing?.source_hash === row.source_hash) {
      unchanged += 1;
      continue;
    }

    const payload = mapPayload(row);

    if (existing) {
      const { error } = await supabase
        .from("association_members")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        errors.push(`Riga ${row.rowNumber}: ${error.message}`);
      } else {
        updated += 1;
      }
      continue;
    }

    const { error } = await supabase
      .from("association_members")
      .insert(payload);

    if (error) {
      errors.push(`Riga ${row.rowNumber}: ${error.message}`);
    } else {
      created += 1;
    }
  }

  return {
    totalRows: sourceRows.length,
    created,
    updated,
    unchanged,
    errors,
  };
}

function mapPayload(row: LegacyMember2025Row) {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    membership_status: "legacy_identity",
    membership_starts_at: null,
    membership_expires_at: null,
    source: row.source,
    source_row_id: row.source_row_id,
    source_hash: row.source_hash,
  };
}
