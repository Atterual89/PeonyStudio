import type { SupabaseClient } from "@supabase/supabase-js";

type EventParticipantRecapRow = {
  id: string;
  event_id: string | null;
  ticket_tailor_event_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  participant_type: string | null;
  ticket_tailor_order_id: string | null;
  association_status: string | null;
  association_expires_at: string | null;
  checked_in: boolean | null;
  notes_admin: string | null;
};

type AdminEventRecapRow = {
  id: string;
  title: string | null;
  slug: string | null;
  ticket_tailor_event_id: string | null;
};

type AssociationMemberRecapRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: string | null;
  membership_expires_at: string | null;
  source: string | null;
};

export type ParticipantMembershipRecapRow = {
  participant_id: string;
  event_id: string | null;
  ticket_tailor_event_id: string | null;
  event_title: string | null;
  ticket_tailor_order_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  checked_in: boolean | null;
  members_book_status:
    | "valid"
    | "expired"
    | "pending"
    | "not_present"
    | "manual_review";
  members_book_expires_at: string | null;
  members_book_match_method: "email" | "name" | "multiple" | "none";
  google_form_status: "present" | "not_present" | "manual_review";
  google_form_expires_at: string | null;
  google_form_match_method: "email" | "name" | "multiple" | "none";
  suggested_final_status:
    | "verified"
    | "pending"
    | "expired"
    | "not_found"
    | "manual_review"
    | "unknown";
  suggested_expires_at: string | null;
  current_association_status: string | null;
  current_association_expires_at: string | null;
  notes_admin: string | null;
};

const PARTICIPANT_FIELDS = [
  "id",
  "event_id",
  "ticket_tailor_event_id",
  "first_name",
  "last_name",
  "email",
  "participant_type",
  "ticket_tailor_order_id",
  "association_status",
  "association_expires_at",
  "checked_in",
  "notes_admin",
].join(",");

const EVENT_FIELDS = ["id", "title", "slug", "ticket_tailor_event_id"].join(",");

const MEMBER_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "membership_status",
  "membership_expires_at",
  "source",
].join(",");

export async function buildParticipantMembershipRecap(
  supabase: SupabaseClient,
) {
  const [participants, events, members] = await Promise.all([
    loadAttendees(supabase),
    loadEvents(supabase),
    loadMembers(supabase),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const eventsByTicketTailorId = new Map(
    events
      .filter((event) => event.ticket_tailor_event_id)
      .map((event) => [event.ticket_tailor_event_id!, event]),
  );
  const officialMembers = members.filter(
    (member) => member.source === "official_members_book",
  );
  const googleMembers = members.filter((member) => member.source === "google_sheet");

  return participants.map<ParticipantMembershipRecapRow>((participant) => {
    const event =
      (participant.event_id ? eventsById.get(participant.event_id) : undefined) ??
      (participant.ticket_tailor_event_id
        ? eventsByTicketTailorId.get(participant.ticket_tailor_event_id)
        : undefined);
    const membersBookMatch = matchMemberSource(participant, officialMembers, today);
    const googleFormMatch = matchGoogleForm(participant, googleMembers);
    const suggestedExpiresAt =
      membersBookMatch.expiresAt ??
      googleFormMatch.expiresAt ??
      participant.association_expires_at;

    return {
      participant_id: participant.id,
      event_id: participant.event_id,
      ticket_tailor_event_id: participant.ticket_tailor_event_id,
      event_title: event?.title ?? event?.slug ?? null,
      ticket_tailor_order_id: participant.ticket_tailor_order_id,
      first_name: participant.first_name,
      last_name: participant.last_name,
      email: participant.email,
      checked_in: participant.checked_in,
      members_book_status: membersBookMatch.status,
      members_book_expires_at: membersBookMatch.expiresAt,
      members_book_match_method: membersBookMatch.matchMethod,
      google_form_status: googleFormMatch.status,
      google_form_expires_at: googleFormMatch.expiresAt,
      google_form_match_method: googleFormMatch.matchMethod,
      suggested_final_status: suggestFinalStatus(
        membersBookMatch.status,
        googleFormMatch.status,
      ),
      suggested_expires_at: suggestedExpiresAt,
      current_association_status: participant.association_status,
      current_association_expires_at: participant.association_expires_at,
      notes_admin: participant.notes_admin,
    };
  });
}

async function loadAttendees(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("event_participants")
    .select(PARTICIPANT_FIELDS)
    .eq("participant_type", "attendee")
    .order("ticket_tailor_event_id", { ascending: true, nullsFirst: false })
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .range(0, 9999);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(isEventParticipantRecapRow);
}

async function loadEvents(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_FIELDS)
    .range(0, 9999);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(isAdminEventRecapRow);
}

async function loadMembers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("association_members")
    .select(MEMBER_FIELDS)
    .in("source", ["official_members_book", "google_sheet"])
    .range(0, 9999);

  if (error) throw new Error(error.message);

  return (data ?? []).filter(isAssociationMemberRecapRow);
}

function matchMemberSource(
  participant: EventParticipantRecapRow,
  members: AssociationMemberRecapRow[],
  today: string,
) {
  const match = findSourceMatches(participant, members);

  if (match.members.length > 1) {
    return {
      status: "manual_review" as const,
      expiresAt: null,
      matchMethod: "multiple" as const,
    };
  }

  if (match.members.length === 0) {
    return {
      status: "not_present" as const,
      expiresAt: null,
      matchMethod: "none" as const,
    };
  }

  const member = match.members[0];
  return {
    status: getMembersBookStatus(member, today),
    expiresAt: member.membership_expires_at,
    matchMethod: match.method,
  };
}

function matchGoogleForm(
  participant: EventParticipantRecapRow,
  members: AssociationMemberRecapRow[],
) {
  const match = findSourceMatches(participant, members);

  if (match.members.length > 1) {
    return {
      status: "manual_review" as const,
      expiresAt: null,
      matchMethod: "multiple" as const,
    };
  }

  if (match.members.length === 0) {
    return {
      status: "not_present" as const,
      expiresAt: null,
      matchMethod: "none" as const,
    };
  }

  return {
    status: "present" as const,
    expiresAt: match.members[0].membership_expires_at,
    matchMethod: match.method,
  };
}

function findSourceMatches(
  participant: EventParticipantRecapRow,
  members: AssociationMemberRecapRow[],
) {
  const emailKey = normalizeEmail(participant.email);
  const emailMatches = emailKey
    ? members.filter((member) => normalizeEmail(member.email) === emailKey)
    : [];

  if (emailMatches.length > 0) {
    return { members: emailMatches, method: "email" as const };
  }

  const nameKey = normalizeNameKey(participant.first_name, participant.last_name);
  const nameMatches = nameKey
    ? members.filter(
        (member) => normalizeNameKey(member.first_name, member.last_name) === nameKey,
      )
    : [];

  return {
    members: nameMatches,
    method: nameMatches.length > 0 ? ("name" as const) : ("none" as const),
  };
}

function getMembersBookStatus(member: AssociationMemberRecapRow, today: string) {
  const status = member.membership_status?.trim() ?? "";

  if (status === "pending") return "pending" as const;
  if (status === "manual_review") return "manual_review" as const;
  if (status === "expired" || isExpired(member.membership_expires_at, today)) {
    return "expired" as const;
  }
  if (
    status === "verified" &&
    (!member.membership_expires_at || member.membership_expires_at >= today)
  ) {
    return "valid" as const;
  }

  return "manual_review" as const;
}

function suggestFinalStatus(
  membersBookStatus: ParticipantMembershipRecapRow["members_book_status"],
  googleFormStatus: ParticipantMembershipRecapRow["google_form_status"],
): ParticipantMembershipRecapRow["suggested_final_status"] {
  if (membersBookStatus === "manual_review" || googleFormStatus === "manual_review") {
    return "manual_review";
  }
  if (membersBookStatus === "valid") return "verified";
  if (membersBookStatus === "pending") return "pending";
  if (membersBookStatus === "expired") return "expired";
  if (googleFormStatus === "present") return "verified";

  return "not_found";
}

function isExpired(expiresAt: string | null, today: string) {
  return Boolean(expiresAt && expiresAt < today);
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

function isEventParticipantRecapRow(
  value: unknown,
): value is EventParticipantRecapRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function isAdminEventRecapRow(value: unknown): value is AdminEventRecapRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function isAssociationMemberRecapRow(
  value: unknown,
): value is AssociationMemberRecapRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string"
  );
}
