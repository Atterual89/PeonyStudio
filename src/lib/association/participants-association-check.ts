import type { SupabaseClient } from "@supabase/supabase-js";

type EventParticipantAssociationRow = {
  id: string;
  event_id: string | null;
  ticket_tailor_event_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  participant_type: string | null;
  association_status: string | null;
  association_expires_at: string | null;
};

type AssociationMemberMatchRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: string | null;
  membership_expires_at: string | null;
};

export type ParticipantAssociationCheckPreviewRow = {
  participant_id: string;
  participant_name: string;
  participant_email: string | null;
  event_id: string | null;
  ticket_tailor_event_id: string | null;
  current_association_status: string | null;
  suggested_association_status:
    | "verified"
    | "pending"
    | "expired"
    | "not_found"
    | "manual_review";
  matched_member_id: string | null;
  matched_member_expires_at: string | null;
  match_method: "email" | "name" | "multiple" | "none";
  reason: string;
};

export type ParticipantAssociationCheckPreview = {
  totalAttendees: number;
  verified: number;
  pending: number;
  expired: number;
  notFound: number;
  manualReview: number;
  multipleMatches: number;
  previewRows: ParticipantAssociationCheckPreviewRow[];
};

const PARTICIPANT_FIELDS = [
  "id",
  "event_id",
  "ticket_tailor_event_id",
  "first_name",
  "last_name",
  "email",
  "participant_type",
  "association_status",
  "association_expires_at",
].join(",");

const MEMBER_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "membership_status",
  "membership_expires_at",
].join(",");

export async function buildParticipantAssociationCheckPreview(
  supabase: SupabaseClient,
) {
  const [participants, members] = await Promise.all([
    loadAttendees(supabase),
    loadAssociationMembers(supabase),
  ]);
  const membersByEmail = new Map<string, AssociationMemberMatchRow[]>();
  const membersByName = new Map<string, AssociationMemberMatchRow[]>();

  for (const member of members) {
    const emailKey = normalizeEmail(member.email);
    if (emailKey) {
      membersByEmail.set(emailKey, [...(membersByEmail.get(emailKey) ?? []), member]);
    }

    const nameKey = normalizeNameKey(member.first_name, member.last_name);
    if (nameKey) {
      membersByName.set(nameKey, [...(membersByName.get(nameKey) ?? []), member]);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const previewRows = participants.map<ParticipantAssociationCheckPreviewRow>(
    (participant) =>
      buildPreviewRow({
        participant,
        today,
        membersByEmail,
        membersByName,
      }),
  );

  return {
    totalAttendees: previewRows.length,
    verified: countByStatus(previewRows, "verified"),
    pending: countByStatus(previewRows, "pending"),
    expired: countByStatus(previewRows, "expired"),
    notFound: countByStatus(previewRows, "not_found"),
    manualReview: countByStatus(previewRows, "manual_review"),
    multipleMatches: previewRows.filter((row) => row.match_method === "multiple")
      .length,
    previewRows,
  };
}

export async function applyParticipantAssociationCheck(supabase: SupabaseClient) {
  const preview = await buildParticipantAssociationCheckPreview(supabase);
  let updated = 0;
  const errors: string[] = [];

  for (const row of preview.previewRows) {
    const updatePayload: Record<string, string | null> = {
      association_status: row.suggested_association_status,
    };

    if (row.matched_member_expires_at) {
      updatePayload.association_expires_at = row.matched_member_expires_at;
    }

    const { error } = await supabase
      .from("event_participants")
      .update(updatePayload)
      .eq("id", row.participant_id)
      .eq("participant_type", "attendee");

    if (error) {
      errors.push(`${row.participant_name}: ${error.message}`);
    } else {
      updated += 1;
    }
  }

  return {
    ...preview,
    updated,
    errors,
  };
}

async function loadAttendees(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("event_participants")
    .select(PARTICIPANT_FIELDS)
    .eq("participant_type", "attendee")
    .range(0, 9999);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(isEventParticipantAssociationRow);
}

async function loadAssociationMembers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("association_members")
    .select(MEMBER_FIELDS)
    .range(0, 9999);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(isAssociationMemberMatchRow);
}

function buildPreviewRow({
  participant,
  today,
  membersByEmail,
  membersByName,
}: {
  participant: EventParticipantAssociationRow;
  today: string;
  membersByEmail: Map<string, AssociationMemberMatchRow[]>;
  membersByName: Map<string, AssociationMemberMatchRow[]>;
}): ParticipantAssociationCheckPreviewRow {
  const participantName = `${participant.first_name ?? ""} ${
    participant.last_name ?? ""
  }`.trim();
  const emailKey = normalizeEmail(participant.email);
  const emailMatches = emailKey ? membersByEmail.get(emailKey) ?? [] : [];

  if (emailMatches.length > 1) {
    return createMultipleMatchRow(participant, participantName, "email");
  }

  if (emailMatches.length === 1) {
    return createMatchedRow({
      participant,
      participantName,
      member: emailMatches[0],
      matchMethod: "email",
      today,
    });
  }

  const nameMatches =
    membersByName.get(normalizeNameKey(participant.first_name, participant.last_name)) ??
    [];

  if (nameMatches.length > 1) {
    return createMultipleMatchRow(participant, participantName, "nome/cognome");
  }

  if (nameMatches.length === 1) {
    return createMatchedRow({
      participant,
      participantName,
      member: nameMatches[0],
      matchMethod: "name",
      today,
    });
  }

  return {
    participant_id: participant.id,
    participant_name: participantName || "-",
    participant_email: participant.email,
    event_id: participant.event_id,
    ticket_tailor_event_id: participant.ticket_tailor_event_id,
    current_association_status: participant.association_status,
    suggested_association_status: "not_found",
    matched_member_id: null,
    matched_member_expires_at: null,
    match_method: "none",
    reason: "Nessun socio trovato in association_members.",
  };
}

function createMatchedRow({
  participant,
  participantName,
  member,
  matchMethod,
  today,
}: {
  participant: EventParticipantAssociationRow;
  participantName: string;
  member: AssociationMemberMatchRow;
  matchMethod: "email" | "name";
  today: string;
}): ParticipantAssociationCheckPreviewRow {
  const suggestion = getSuggestedStatus(member, today);

  return {
    participant_id: participant.id,
    participant_name: participantName || "-",
    participant_email: participant.email,
    event_id: participant.event_id,
    ticket_tailor_event_id: participant.ticket_tailor_event_id,
    current_association_status: participant.association_status,
    suggested_association_status: suggestion.status,
    matched_member_id: member.id,
    matched_member_expires_at: member.membership_expires_at,
    match_method: matchMethod,
    reason: suggestion.reason,
  };
}

function createMultipleMatchRow(
  participant: EventParticipantAssociationRow,
  participantName: string,
  matchLabel: string,
): ParticipantAssociationCheckPreviewRow {
  return {
    participant_id: participant.id,
    participant_name: participantName || "-",
    participant_email: participant.email,
    event_id: participant.event_id,
    ticket_tailor_event_id: participant.ticket_tailor_event_id,
    current_association_status: participant.association_status,
    suggested_association_status: "manual_review",
    matched_member_id: null,
    matched_member_expires_at: null,
    match_method: "multiple",
    reason: `Trovati piu soci compatibili via ${matchLabel}. Verifica manuale richiesta.`,
  };
}

function getSuggestedStatus(member: AssociationMemberMatchRow, today: string) {
  const status = member.membership_status?.trim() ?? "";

  if (status === "pending") {
    return { status: "pending" as const, reason: "Socio trovato con stato pending." };
  }
  if (status === "manual_review") {
    return {
      status: "manual_review" as const,
      reason: "Socio trovato con stato manual_review.",
    };
  }
  if (status === "expired" || isExpired(member.membership_expires_at, today)) {
    return {
      status: "expired" as const,
      reason: "Socio scaduto o con scadenza precedente a oggi.",
    };
  }
  if (
    status === "verified" &&
    member.membership_expires_at &&
    member.membership_expires_at >= today
  ) {
    return {
      status: "verified" as const,
      reason: "Socio verificato e tessera non scaduta.",
    };
  }

  return {
    status: "manual_review" as const,
    reason: "Socio trovato ma stato/scadenza non sufficienti per verifica automatica.",
  };
}

function isExpired(expiresAt: string | null, today: string) {
  return Boolean(expiresAt && expiresAt < today);
}

function countByStatus(
  rows: ParticipantAssociationCheckPreviewRow[],
  status: ParticipantAssociationCheckPreviewRow["suggested_association_status"],
) {
  return rows.filter((row) => row.suggested_association_status === status).length;
}

function normalizeEmail(value: string | null) {
  return value?.trim().toLowerCase() || "";
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

function isEventParticipantAssociationRow(
  value: unknown,
): value is EventParticipantAssociationRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function isAssociationMemberMatchRow(
  value: unknown,
): value is AssociationMemberMatchRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}
