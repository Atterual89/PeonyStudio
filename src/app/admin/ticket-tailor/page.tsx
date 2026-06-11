"use client";

import { FormEvent, useState } from "react";

type SyncStep = {
  label: string;
  endpoint: string;
};

type SyncResult = {
  label: string;
  ok: boolean;
  summary: string;
};

type Participant = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  participant_type: string | null;
  ticket_tailor_event_id: string | null;
  association_status: string | null;
  association_expires_at: string | null;
  checked_in: boolean | null;
  checked_in_source: string | null;
  ticket_tailor_order_id: string | null;
  notes_admin: string | null;
};

type AdminEvent = {
  id: string;
  slug: string | null;
  title: string | null;
  category: string | null;
  source: string | null;
  ticket_tailor_event_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_public: boolean | null;
  booking_url: string | null;
};

type AssociationDraft = {
  association_status: string;
  association_expires_at: string;
  notes_admin: string;
};

type ParticipantFilters = {
  ticket_tailor_event_id: string;
  participant_type: string;
  checked_in: string;
  association_status: string;
};

type ParticipantListFilters = {
  search: string;
  associationStatus: string;
  checkedIn: string;
  participantType: string;
};

type BookSyncPreviewFilters = {
  search: string;
  status: "all" | "verified" | "expired" | "invalid";
  action: "all" | "create" | "update" | "unchanged" | "invalid";
};

type QuickFilterMode = "none" | "association_to_verify";

type ParticipantOrderGroup = {
  key: string;
  orderId: string | null;
  buyers: Participant[];
  attendees: Participant[];
  hiddenRows: number;
};

type ImportSociRow = {
  lineNumber: number;
  firstName: string;
  lastName: string;
};

type ImportSociInvalidRow = {
  lineNumber: number;
  raw: string;
  reason: string;
};

type ImportSociPreview = {
  validRows: ImportSociRow[];
  invalidRows: ImportSociInvalidRow[];
};

type ImportSociMatchParticipant = {
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

type ImportSociMatchResult = {
  input: {
    first_name: string;
    last_name: string;
  };
  normalized_key: string;
  match_status: "unique" | "multiple" | "not_found";
  matches: ImportSociMatchParticipant[];
};

type ImportSociMatchPreview = {
  ok: boolean;
  totalInput: number;
  uniqueMatches: number;
  multipleMatches: number;
  notFound: number;
  invalidRows: number;
  results: ImportSociMatchResult[];
  message?: string;
  error?: string;
};

type AssociationMembersSyncPreviewRow = {
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
};

type DetectedSheetColumn = {
  index: number | null;
  header: string | null;
  normalizedHeader: string | null;
};

type AssociationMembersSyncReport = {
  ok?: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skippedBeforeValidFrom: number;
  wouldCreate: number;
  wouldUpdate: number;
  unchanged: number;
  fallbackStartDateCount: number;
  fallbackNameMatchCount: number;
  detectedColumns?: {
    first_name: DetectedSheetColumn;
    last_name: DetectedSheetColumn;
    email: DetectedSheetColumn;
    contact: DetectedSheetColumn;
    membership_starts_at: DetectedSheetColumn;
    availableHeaders: string[];
  };
  errors: string[];
  previewRows: AssociationMembersSyncPreviewRow[];
  created?: number;
  updated?: number;
  message?: string;
};

type OfficialMembersBookPreviewRow = {
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
  notes: string[];
  errors: string[];
};

type OfficialMembersBookSyncReport = {
  ok?: boolean;
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
  detectedColumns?: {
    first_name: DetectedSheetColumn;
    last_name: DetectedSheetColumn;
    fiscal_code: DetectedSheetColumn;
    birth_date: DetectedSheetColumn;
    email: DetectedSheetColumn;
    accepted_at: DetectedSheetColumn;
    ceased_at: DetectedSheetColumn;
    current_year_quota: DetectedSheetColumn;
    current_year_card_number: DetectedSheetColumn;
    availableHeaders: string[];
  };
  previewRows: OfficialMembersBookPreviewRow[];
  created?: number;
  updated?: number;
  message?: string;
};

type ParticipantAssociationCheckPreviewRow = {
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

type ParticipantAssociationCheckReport = {
  ok?: boolean;
  totalAttendees: number;
  verified: number;
  pending: number;
  expired: number;
  notFound: number;
  manualReview: number;
  multipleMatches: number;
  previewRows: ParticipantAssociationCheckPreviewRow[];
  updated?: number;
  errors?: string[];
  message?: string;
};

type MembershipRecapRow = {
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

type MembershipRecapDraft = {
  association_status: string;
  association_expires_at: string;
  notes_admin: string;
};

type MembershipRecapFilters = {
  search: string;
  associationStatus: string;
  membersBookStatus: string;
  googleFormStatus: string;
  checkedIn: string;
};

type MembershipRecapResponse = {
  ok?: boolean;
  total: number;
  rows: MembershipRecapRow[];
  message?: string;
};

type ParticipantCheckStatusFilter =
  | "all"
  | "verified"
  | "pending"
  | "expired"
  | "not_found"
  | "manual_review"
  | "multiple";

type ParticipantCheckMatchFilter =
  | "all"
  | "email"
  | "name"
  | "none"
  | "multiple";

type MembersSyncPreviewFilter =
  | "all"
  | "create"
  | "update"
  | "unchanged"
  | "invalid";

type PartnerEnrollmentRow = {
  id: string;
  ticket_tailor_order_id: string | null;
  partner_email: string | null;
  partner_name: string | null;
  partner_source: string | null;
  enrollment_status: string | null;
  buyer_email: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_nickname: string | null;
  event_title: string | null;
  event_starts_at: string | null;
};

const associationStatuses = [
  "unknown",
  "missing",
  "pending",
  "verified",
  "expired",
  "manual_review",
  "not_found",
  "not_required",
];

const associationStatusesForEditing = [
  "verified",
  "pending",
  "expired",
  "not_found",
  "manual_review",
  "unknown",
];

const associationStatusesToVerify = new Set([
  "unknown",
  "missing",
  "pending",
  "expired",
  "manual_review",
  "not_found",
]);

const membersSyncPreviewPageSize = 50;
const membershipValidFrom = "2025-09-01";

const processSummaryRows = [
  {
    phase: "1. Libro soci ufficiale",
    updates: "Stato ufficiale delle tessere",
    source: "Tab Google Sheet 'libro soci'",
    action: "Controlla libro soci → Conferma aggiornamento",
    result: "Soci validi, scaduti o da controllare aggiornati",
  },
  {
    phase: "2. Nuove iscrizioni",
    updates: "Persone che hanno compilato il form associativo",
    source: "Google Form / tab risposte",
    action: "Controlla nuove iscrizioni → Conferma nuove iscrizioni",
    result: "Nuovi soci importati dal 01/09/2025 in poi",
  },
  {
    phase: "3. Biglietti Ticket Tailor",
    updates: "Eventi, ordini, biglietti, acquirenti, partecipanti e check-in",
    source: "Ticket Tailor",
    action: "Aggiorna dati Ticket Tailor",
    result: "Partecipanti evento aggiornati",
  },
  {
    phase: "4. Verifica tessere",
    updates: "Stato tessera dei partecipanti",
    source: "Soci + partecipanti Ticket Tailor",
    action: "Controlla tessere partecipanti → Conferma verifica tessere",
    result: "Tessera valida, scaduta, non trovata o da controllare",
  },
  {
    phase: "5. Partecipanti evento",
    updates: "Vista finale operativa",
    source: "Ticket Tailor + verifica tessere",
    action: "Carica partecipanti",
    result: "Lista acquirenti e partecipanti con check-in e stato tessera",
  },
  {
    phase: "6. Recap tessere partecipanti",
    updates: "Correzioni manuali finali sulle tessere",
    source: "Partecipanti + libro soci + Google Form",
    action: "Carica recap tessere -> Salva le singole righe",
    result: "Stato tessera finale aggiornato sui partecipanti effettivi",
  },
];

const syncSteps: SyncStep[] = [
  {
    label: "Eventi",
    endpoint: "/api/admin/ticket-tailor/sync-events",
  },
  {
    label: "Ordini",
    endpoint: "/api/admin/ticket-tailor/sync-orders",
  },
  {
    label: "Ticket emessi",
    endpoint: "/api/admin/ticket-tailor/sync-issued-tickets",
  },
  {
    label: "Partecipanti",
    endpoint: "/api/admin/ticket-tailor/sync-participants",
  },
];

export default function TicketTailorAdminPage() {
  const [secret, setSecret] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncingProfiles, setSyncingProfiles] = useState(false);
  const [profilesSyncResult, setProfilesSyncResult] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<"tessere" | "partner">("tessere");
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partnerRows, setPartnerRows] = useState<PartnerEnrollmentRow[]>([]);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [savingPartnerId, setSavingPartnerId] = useState<string | null>(null);
  const [partnerDrafts, setPartnerDrafts] = useState<
    Record<string, { partner_email: string; partner_name: string }>
  >({});
  const [partnerSavedIds, setPartnerSavedIds] = useState<Record<string, boolean>>({});
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerEventFilter, setPartnerEventFilter] = useState("");
  const [partnerSourceFilter, setPartnerSourceFilter] = useState("");
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantDrafts, setParticipantDrafts] = useState<
    Record<string, AssociationDraft>
  >({});
  const [savingParticipantId, setSavingParticipantId] = useState<string | null>(
    null,
  );
  const [editingParticipantId, setEditingParticipantId] = useState<
    string | null
  >(null);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [quickFilterMode, setQuickFilterMode] =
    useState<QuickFilterMode>("none");
  const [importSociText, setImportSociText] = useState("");
  const [importSociPreview, setImportSociPreview] =
    useState<ImportSociPreview | null>(null);
  const [importSociMatchPreview, setImportSociMatchPreview] =
    useState<ImportSociMatchPreview | null>(null);
  const [importSociMatchError, setImportSociMatchError] = useState<
    string | null
  >(null);
  const [matchingImportSoci, setMatchingImportSoci] = useState(false);
  const [membersSyncPreview, setMembersSyncPreview] =
    useState<AssociationMembersSyncReport | null>(null);
  const [membersSyncApplyReport, setMembersSyncApplyReport] =
    useState<AssociationMembersSyncReport | null>(null);
  const [membersSyncError, setMembersSyncError] = useState<string | null>(null);
  const [previewingMembersSync, setPreviewingMembersSync] = useState(false);
  const [applyingMembersSync, setApplyingMembersSync] = useState(false);
  const [membersSyncPreviewFilter, setMembersSyncPreviewFilter] =
    useState<MembersSyncPreviewFilter>("all");
  const [membersSyncPreviewPage, setMembersSyncPreviewPage] = useState(1);
  const [bookSyncPreview, setBookSyncPreview] =
    useState<OfficialMembersBookSyncReport | null>(null);
  const [bookSyncApplyReport, setBookSyncApplyReport] =
    useState<OfficialMembersBookSyncReport | null>(null);
  const [bookSyncError, setBookSyncError] = useState<string | null>(null);
  const [previewingBookSync, setPreviewingBookSync] = useState(false);
  const [applyingBookSync, setApplyingBookSync] = useState(false);
  const [bookSyncPreviewPage, setBookSyncPreviewPage] = useState(1);
  const [bookSyncPreviewFilters, setBookSyncPreviewFilters] =
    useState<BookSyncPreviewFilters>({
      search: "",
      status: "all",
      action: "all",
    });
  const [participantCheckPreview, setParticipantCheckPreview] =
    useState<ParticipantAssociationCheckReport | null>(null);
  const [participantCheckApplyReport, setParticipantCheckApplyReport] =
    useState<ParticipantAssociationCheckReport | null>(null);
  const [participantCheckError, setParticipantCheckError] = useState<string | null>(
    null,
  );
  const [previewingParticipantCheck, setPreviewingParticipantCheck] =
    useState(false);
  const [applyingParticipantCheck, setApplyingParticipantCheck] = useState(false);
  const [participantCheckPage, setParticipantCheckPage] = useState(1);
  const [participantCheckStatusFilter, setParticipantCheckStatusFilter] =
    useState<ParticipantCheckStatusFilter>("all");
  const [participantCheckMatchFilter, setParticipantCheckMatchFilter] =
    useState<ParticipantCheckMatchFilter>("all");
  const [participantCheckSearch, setParticipantCheckSearch] = useState("");
  const [showParticipantCheckAdvancedFilters, setShowParticipantCheckAdvancedFilters] =
    useState(false);
  const [filters, setFilters] = useState<ParticipantFilters>({
    ticket_tailor_event_id: "",
    participant_type: "attendee",
    checked_in: "",
    association_status: "",
  });
  const [participantListFilters, setParticipantListFilters] =
    useState<ParticipantListFilters>({
      search: "",
      associationStatus: "",
      checkedIn: "",
      participantType: "",
    });
  const [membershipRecapRows, setMembershipRecapRows] = useState<
    MembershipRecapRow[]
  >([]);
  const [membershipRecapDrafts, setMembershipRecapDrafts] = useState<
    Record<string, MembershipRecapDraft>
  >({});
  const [membershipRecapFilters, setMembershipRecapFilters] =
    useState<MembershipRecapFilters>({
      search: "",
      associationStatus: "",
      membersBookStatus: "",
      googleFormStatus: "",
      checkedIn: "",
    });
  const [membershipRecapPage, setMembershipRecapPage] = useState(1);
  const [loadingMembershipRecap, setLoadingMembershipRecap] = useState(false);
  const [membershipRecapError, setMembershipRecapError] = useState<string | null>(
    null,
  );
  const [savingMembershipRecapId, setSavingMembershipRecapId] = useState<
    string | null
  >(null);
  const [membershipRecapSavedIds, setMembershipRecapSavedIds] = useState<
    Record<string, boolean>
  >({});
  const quickFilteredParticipants = applyQuickFilter(participants, quickFilterMode);
  const displayedParticipants = applyParticipantListFilters(
    quickFilteredParticipants,
    participantListFilters,
    events,
  );
  const participantOrderGroups = groupParticipantsByOrder(
    displayedParticipants,
    quickFilteredParticipants,
  );
  const editingParticipant = editingParticipantId
    ? participants.find((participant) => participant.id === editingParticipantId) ??
      null
    : null;
  const participantSummary = getParticipantSummary(displayedParticipants);
  const partnerUniqueEvents = [
    ...new Set(
      partnerRows.map((r) => r.event_title).filter((t): t is string => Boolean(t)),
    ),
  ];
  const normalizedPartnerSearch = partnerSearch.trim().toLowerCase();
  const filteredPartnerRows = partnerRows.filter((r) => {
    if (
      normalizedPartnerSearch &&
      ![r.buyer_nickname, r.buyer_first_name, r.buyer_email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(normalizedPartnerSearch))
    )
      return false;
    if (partnerEventFilter && r.event_title !== partnerEventFilter) return false;
    if (partnerSourceFilter === "none" && r.partner_source) return false;
    if (
      partnerSourceFilter &&
      partnerSourceFilter !== "none" &&
      r.partner_source !== partnerSourceFilter
    )
      return false;
    return true;
  });
  const filteredMembershipRecapRows = membershipRecapRows.filter((row) =>
    matchesMembershipRecapFilters(row, membershipRecapFilters, membershipRecapDrafts),
  );
  const membershipRecapTotalPages = Math.max(
    1,
    Math.ceil(filteredMembershipRecapRows.length / membersSyncPreviewPageSize),
  );
  const safeMembershipRecapPage = Math.min(
    membershipRecapPage,
    membershipRecapTotalPages,
  );
  const membershipRecapPageStart =
    (safeMembershipRecapPage - 1) * membersSyncPreviewPageSize;
  const pagedMembershipRecapRows = filteredMembershipRecapRows.slice(
    membershipRecapPageStart,
    membershipRecapPageStart + membersSyncPreviewPageSize,
  );
  const membershipRecapDisplayStart =
    filteredMembershipRecapRows.length > 0 ? membershipRecapPageStart + 1 : 0;
  const membershipRecapDisplayEnd = Math.min(
    membershipRecapPageStart + pagedMembershipRecapRows.length,
    filteredMembershipRecapRows.length,
  );
  const uniqueImportSociMatches =
    importSociMatchPreview?.results.filter(
      (result) => result.match_status === "unique",
    ) ?? [];
  const multipleImportSociMatches =
    importSociMatchPreview?.results.filter(
      (result) => result.match_status === "multiple",
    ) ?? [];
  const notFoundImportSociMatches =
    importSociMatchPreview?.results.filter(
      (result) => result.match_status === "not_found",
    ) ?? [];
  const currentSeasonMembersSyncRows =
    membersSyncPreview?.previewRows.filter(
      (row) =>
        row.action !== "skipped" &&
        row.membership_starts_at >= membershipValidFrom,
    ) ?? [];
  const filteredMembersSyncRows =
    membersSyncPreviewFilter === "all"
      ? currentSeasonMembersSyncRows
      : currentSeasonMembersSyncRows.filter(
          (row) => row.action === membersSyncPreviewFilter,
        );
  const membersSyncTotalPages = Math.max(
    1,
    Math.ceil(filteredMembersSyncRows.length / membersSyncPreviewPageSize),
  );
  const safeMembersSyncPreviewPage = Math.min(
    membersSyncPreviewPage,
    membersSyncTotalPages,
  );
  const membersSyncPageStart =
    (safeMembersSyncPreviewPage - 1) * membersSyncPreviewPageSize;
  const pagedMembersSyncRows = filteredMembersSyncRows.slice(
    membersSyncPageStart,
    membersSyncPageStart + membersSyncPreviewPageSize,
  );
  const membersSyncDisplayStart =
    filteredMembersSyncRows.length > 0 ? membersSyncPageStart + 1 : 0;
  const membersSyncDisplayEnd = Math.min(
    membersSyncPageStart + pagedMembersSyncRows.length,
    filteredMembersSyncRows.length,
  );
  const filteredBookSyncRows =
    bookSyncPreview?.previewRows.filter((row) =>
      matchesBookSyncPreviewFilters(row, bookSyncPreviewFilters),
    ) ?? [];
  const bookSyncTotalPages = Math.max(
    1,
    Math.ceil(filteredBookSyncRows.length / membersSyncPreviewPageSize),
  );
  const safeBookSyncPreviewPage = Math.min(
    bookSyncPreviewPage,
    bookSyncTotalPages,
  );
  const bookSyncPageStart =
    (safeBookSyncPreviewPage - 1) * membersSyncPreviewPageSize;
  const pagedBookSyncRows = filteredBookSyncRows.slice(
    bookSyncPageStart,
    bookSyncPageStart + membersSyncPreviewPageSize,
  );
  const bookSyncDisplayStart =
    filteredBookSyncRows.length > 0 ? bookSyncPageStart + 1 : 0;
  const bookSyncDisplayEnd = Math.min(
    bookSyncPageStart + pagedBookSyncRows.length,
    filteredBookSyncRows.length,
  );
  const normalizedParticipantCheckSearch = participantCheckSearch
    .trim()
    .toLowerCase();
  const filteredParticipantCheckRows =
    participantCheckPreview?.previewRows.filter((row) => {
      const statusMatches =
        participantCheckStatusFilter === "all"
          ? true
          : participantCheckStatusFilter === "multiple"
            ? row.match_method === "multiple"
            : row.suggested_association_status === participantCheckStatusFilter;
      const matchMethodMatches =
        participantCheckMatchFilter === "all"
          ? true
          : row.match_method === participantCheckMatchFilter;
      const searchMatches = normalizedParticipantCheckSearch
        ? [
            row.participant_name,
            row.participant_email ?? "",
            row.event_id ?? "",
            row.ticket_tailor_event_id ?? "",
            row.reason,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedParticipantCheckSearch)
        : true;

      return statusMatches && matchMethodMatches && searchMatches;
    }) ?? [];
  const participantCheckTotalPages = Math.max(
    1,
    Math.ceil(filteredParticipantCheckRows.length / membersSyncPreviewPageSize),
  );
  const safeParticipantCheckPage = Math.min(
    participantCheckPage,
    participantCheckTotalPages,
  );
  const participantCheckPageStart =
    (safeParticipantCheckPage - 1) * membersSyncPreviewPageSize;
  const pagedParticipantCheckRows =
    filteredParticipantCheckRows.slice(
    participantCheckPageStart,
    participantCheckPageStart + membersSyncPreviewPageSize,
  );
  const participantCheckDisplayStart =
    filteredParticipantCheckRows.length > 0
      ? participantCheckPageStart + 1
      : 0;
  const participantCheckDisplayEnd = Math.min(
    participantCheckPageStart + pagedParticipantCheckRows.length,
    filteredParticipantCheckRows.length,
  );

  async function handleSync() {
    if (!secret.trim()) {
      setSyncResults([
        {
          label: "Errore",
          ok: false,
          summary: "Inserisci il codice admin.",
        },
      ]);
      return;
    }

    setSyncing(true);
    setSyncResults([]);

    const results: SyncResult[] = [];

    for (const step of syncSteps) {
      try {
        const response = await fetch(step.endpoint, {
          method: "POST",
          headers: {
            "x-admin-sync-secret": secret,
          },
        });
        const payload = (await response.json()) as Record<string, unknown>;

        results.push({
          label: step.label,
          ok: response.ok && payload.ok !== false,
          summary: summarizePayload(payload),
        });
      } catch (error) {
        results.push({
          label: step.label,
          ok: false,
          summary: error instanceof Error ? error.message : "Errore sconosciuto.",
        });
      }

      setSyncResults([...results]);
    }

    setSyncing(false);
    await loadEvents();
    await loadParticipants();
  }

  async function handleSyncProfiles() {
    if (!secret.trim()) {
      setProfilesSyncResult({ ok: false, message: "Inserisci il codice admin." });
      return;
    }

    setSyncingProfiles(true);
    setProfilesSyncResult(null);

    try {
      const response = await fetch("/api/admin/ticket-tailor/sync-profiles", {
        method: "POST",
        headers: { "x-admin-sync-secret": secret },
      });
      const payload = (await response.json()) as Record<string, unknown>;
      setProfilesSyncResult(payload);
    } catch (error) {
      setProfilesSyncResult({
        ok: false,
        message: error instanceof Error ? error.message : "Errore sconosciuto.",
      });
    } finally {
      setSyncingProfiles(false);
    }
  }

  async function loadPartners() {
    if (!secret.trim()) {
      setPartnerError("Inserisci il codice admin.");
      return;
    }

    setLoadingPartners(true);
    setPartnerError(null);

    try {
      const response = await fetch("/api/admin/partner-enrollments", {
        headers: { "x-admin-sync-secret": secret },
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        rows?: PartnerEnrollmentRow[];
        message?: string;
      };

      if (!response.ok || payload.ok === false) {
        setPartnerError(payload.message ?? "Errore caricamento partner.");
        return;
      }

      const rows = payload.rows ?? [];
      setPartnerRows(rows);
      setPartnerDrafts(
        Object.fromEntries(
          rows.map((r) => [
            r.id,
            {
              partner_email: r.partner_email ?? "",
              partner_name: r.partner_name ?? "",
            },
          ]),
        ),
      );
      setPartnerSavedIds({});
    } catch (error) {
      setPartnerError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setLoadingPartners(false);
    }
  }

  async function savePartnerRow(id: string) {
    if (!secret.trim()) return;

    const draft = partnerDrafts[id];
    if (!draft) return;

    setSavingPartnerId(id);
    setPartnerError(null);

    try {
      const response = await fetch(`/api/admin/partner-enrollments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-sync-secret": secret,
        },
        body: JSON.stringify({
          partner_email: draft.partner_email.trim() || null,
          partner_name: draft.partner_name.trim() || null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || payload.ok === false) {
        setPartnerError(payload.message ?? "Errore salvataggio partner.");
        return;
      }

      setPartnerRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                partner_email: draft.partner_email.trim() || null,
                partner_name: draft.partner_name.trim() || null,
                partner_source: "user",
              }
            : r,
        ),
      );
      setPartnerSavedIds((prev) => ({ ...prev, [id]: true }));
    } catch (error) {
      setPartnerError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setSavingPartnerId(null);
    }
  }

  async function loadEvents() {
    if (!secret.trim()) {
      setEventsError("Inserisci il codice admin.");
      return [];
    }

    setEventsError(null);

    try {
      const response = await fetch("/api/admin/events", {
        headers: {
          "x-admin-sync-secret": secret,
        },
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        events?: AdminEvent[];
        error?: string;
        message?: string;
      };

      if (!response.ok || payload.ok === false) {
        setEvents([]);
        setEventsError(
          payload.error ?? payload.message ?? "Errore caricamento eventi.",
        );
        return [];
      }

      const nextEvents = payload.events ?? [];
      setEvents(nextEvents);
      return nextEvents;
    } catch (error) {
      setEvents([]);
      setEventsError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
      return [];
    }
  }

  async function loadParticipants(
    event?: FormEvent<HTMLFormElement>,
    nextFilters = filters,
  ) {
    event?.preventDefault();
    setQuickFilterMode("none");
    await fetchParticipants(nextFilters);
  }

  async function fetchParticipants(nextFilters = filters) {
    if (!secret.trim()) {
      setParticipantError("Inserisci il codice admin.");
      return;
    }

    setLoadingParticipants(true);
    setParticipantError(null);

    if (events.length === 0) {
      await loadEvents();
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(nextFilters)) {
      if (value.trim()) {
        params.set(key, value.trim());
      }
    }

    try {
      const response = await fetch(`/api/admin/participants?${params}`, {
        headers: {
          "x-admin-sync-secret": secret,
        },
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        participants?: Participant[];
        error?: string;
        message?: string;
      };

      if (!response.ok || payload.ok === false) {
        setParticipants([]);
        setParticipantDrafts({});
        setParticipantError(
          payload.error ?? payload.message ?? "Errore caricamento partecipanti.",
        );
      } else {
        const nextParticipants = payload.participants ?? [];
        setParticipants(nextParticipants);
        setParticipantDrafts(createParticipantDrafts(nextParticipants));
      }
    } catch (error) {
      setParticipants([]);
      setParticipantDrafts({});
      setParticipantError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setLoadingParticipants(false);
    }
  }

  function updateParticipantDraft(
    participantId: string,
    field: keyof AssociationDraft,
    value: string,
  ) {
    setParticipantDrafts((current) => {
      const currentDraft =
        current[participantId] ?? {
          association_status: "unknown",
          association_expires_at: "",
          notes_admin: "",
        };
      const nextDraft = {
        ...currentDraft,
        [field]: value,
      };

      if (
        field === "association_status" &&
        value === "verified" &&
        currentDraft.association_status !== "verified"
      ) {
        nextDraft.association_expires_at = getDefaultAssociationExpiryDate();
      }

      return {
        ...current,
        [participantId]: nextDraft,
      };
    });
  }

  async function saveParticipantAssociation(participantId: string) {
    if (!secret.trim()) {
      setParticipantError("Inserisci il codice admin.");
      return false;
    }

    const draft = participantDrafts[participantId];
    if (!draft) {
      setParticipantError("Dati associazione non trovati per questa riga.");
      return false;
    }

    setSavingParticipantId(participantId);
    setParticipantError(null);

    try {
      const response = await fetch(`/api/admin/participants/${participantId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-sync-secret": secret,
        },
        body: JSON.stringify({
          association_status: draft.association_status,
          association_expires_at: draft.association_expires_at || null,
          notes_admin: draft.notes_admin || null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || payload.ok === false) {
        setParticipantError(
          payload.message ?? "Errore salvataggio associazione.",
        );
        return false;
      }

      await loadParticipants();
      return true;
    } catch (error) {
      setParticipantError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
      return false;
    } finally {
      setSavingParticipantId(null);
    }
  }

  async function saveEditingParticipantAssociation() {
    if (!editingParticipantId) {
      return;
    }

    const saved = await saveParticipantAssociation(editingParticipantId);
    if (saved) {
      setEditingParticipantId(null);
    }
  }

  function handlePreviewImportSoci() {
    setImportSociPreview(parseImportSociText(importSociText));
    setImportSociMatchPreview(null);
    setImportSociMatchError(null);
  }

  async function handleSearchImportSociMatches() {
    if (!secret.trim()) {
      setImportSociMatchError("Inserisci il codice admin.");
      return;
    }

    const preview = importSociPreview ?? parseImportSociText(importSociText);
    setImportSociPreview(preview);
    setImportSociMatchPreview(null);
    setImportSociMatchError(null);

    if (preview.validRows.length === 0) {
      setImportSociMatchError("Nessuna riga valida da cercare.");
      return;
    }

    setMatchingImportSoci(true);

    try {
      const response = await fetch("/api/admin/association-import/preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-sync-secret": secret,
        },
        body: JSON.stringify({
          rows: preview.validRows.map((row) => ({
            first_name: row.firstName,
            last_name: row.lastName,
          })),
        }),
      });
      const payload = (await response.json()) as ImportSociMatchPreview;

      if (!response.ok || payload.ok === false) {
        setImportSociMatchError(
          payload.message ?? payload.error ?? "Errore ricerca corrispondenze.",
        );
        return;
      }

      setImportSociMatchPreview(payload);
    } catch (error) {
      setImportSociMatchError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setMatchingImportSoci(false);
    }
  }

  async function handlePreviewMembersSync() {
    if (!secret.trim()) {
      setMembersSyncError("Inserisci il codice admin.");
      return;
    }

    setPreviewingMembersSync(true);
    setMembersSyncError(null);
    setMembersSyncPreview(null);
    setMembersSyncApplyReport(null);

    try {
      const response = await fetch("/api/admin/association-members/sync-preview", {
        method: "POST",
        headers: {
          "x-admin-sync-secret": secret,
        },
      });
      const payload = (await response.json()) as AssociationMembersSyncReport;

      if (!response.ok || payload.ok === false) {
        setMembersSyncError(payload.message ?? "Errore controllo nuove iscrizioni.");
        return;
      }

      setMembersSyncPreview(payload);
      setMembersSyncPreviewFilter("all");
      setMembersSyncPreviewPage(1);
    } catch (error) {
      setMembersSyncError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setPreviewingMembersSync(false);
    }
  }

  async function handleApplyMembersSync() {
    if (!secret.trim()) {
      setMembersSyncError("Inserisci il codice admin.");
      return;
    }

    if (!membersSyncPreview) {
      setMembersSyncError("Esegui prima il controllo delle nuove iscrizioni.");
      return;
    }

    setApplyingMembersSync(true);
    setMembersSyncError(null);

    try {
      const response = await fetch("/api/admin/association-members/sync-apply", {
        method: "POST",
        headers: {
          "x-admin-sync-secret": secret,
        },
      });
      const payload = (await response.json()) as AssociationMembersSyncReport;

      if (!response.ok || payload.ok === false) {
        setMembersSyncError(payload.message ?? "Errore conferma nuove iscrizioni.");
      }

      setMembersSyncApplyReport(payload);
      setMembersSyncPreview(payload);
      setMembersSyncPreviewFilter("all");
      setMembersSyncPreviewPage(1);
    } catch (error) {
      setMembersSyncError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setApplyingMembersSync(false);
    }
  }

  function updateMembersSyncPreviewFilter(filter: MembersSyncPreviewFilter) {
    setMembersSyncPreviewFilter(filter);
    setMembersSyncPreviewPage(1);
  }

  async function handlePreviewBookSync() {
    if (!secret.trim()) {
      setBookSyncError("Inserisci il codice admin.");
      return;
    }

    setPreviewingBookSync(true);
    setBookSyncError(null);
    setBookSyncPreview(null);
    setBookSyncApplyReport(null);

    try {
      const response = await fetch("/api/admin/association-members/book-sync-preview", {
        method: "POST",
        headers: {
          "x-admin-sync-secret": secret,
        },
      });
      const payload = (await response.json()) as OfficialMembersBookSyncReport;

      if (!response.ok || payload.ok === false) {
        setBookSyncError(payload.message ?? "Errore preview libro soci.");
        return;
      }

      setBookSyncPreview(payload);
      setBookSyncPreviewPage(1);
      setBookSyncPreviewFilters({
        search: "",
        status: "all",
        action: "all",
      });
    } catch (error) {
      setBookSyncError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setPreviewingBookSync(false);
    }
  }

  async function handleApplyBookSync() {
    if (!secret.trim()) {
      setBookSyncError("Inserisci il codice admin.");
      return;
    }

    if (!bookSyncPreview) {
      setBookSyncError("Esegui prima la preview libro soci.");
      return;
    }

    setApplyingBookSync(true);
    setBookSyncError(null);

    try {
      const response = await fetch("/api/admin/association-members/book-sync-apply", {
        method: "POST",
        headers: {
          "x-admin-sync-secret": secret,
        },
      });
      const payload = (await response.json()) as OfficialMembersBookSyncReport;

      if (!response.ok || payload.ok === false) {
        setBookSyncError(payload.message ?? "Errore apply libro soci.");
      }

      setBookSyncApplyReport(payload);
      setBookSyncPreview(payload);
      setBookSyncPreviewPage(1);
      setBookSyncPreviewFilters({
        search: "",
        status: "all",
        action: "all",
      });
    } catch (error) {
      setBookSyncError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setApplyingBookSync(false);
    }
  }

  async function handlePreviewParticipantAssociationCheck() {
    if (!secret.trim()) {
      setParticipantCheckError("Inserisci il codice admin.");
      return;
    }

    setPreviewingParticipantCheck(true);
    setParticipantCheckError(null);
    setParticipantCheckPreview(null);
    setParticipantCheckApplyReport(null);

    try {
      const response = await fetch(
        "/api/admin/participants/association-check-preview",
        {
          method: "POST",
          headers: {
            "x-admin-sync-secret": secret,
          },
        },
      );
      const payload = (await response.json()) as ParticipantAssociationCheckReport;

      if (!response.ok || payload.ok === false) {
        setParticipantCheckError(
          payload.message ?? "Errore preview verifica tessere.",
        );
        return;
      }

      setParticipantCheckPreview(payload);
      setParticipantCheckPage(1);
      setParticipantCheckStatusFilter("all");
      setParticipantCheckMatchFilter("all");
      setParticipantCheckSearch("");
    } catch (error) {
      setParticipantCheckError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setPreviewingParticipantCheck(false);
    }
  }

  async function handleApplyParticipantAssociationCheck() {
    if (!secret.trim()) {
      setParticipantCheckError("Inserisci il codice admin.");
      return;
    }

    if (!participantCheckPreview) {
      setParticipantCheckError("Esegui prima la preview verifica tessere.");
      return;
    }

    setApplyingParticipantCheck(true);
    setParticipantCheckError(null);

    try {
      const response = await fetch(
        "/api/admin/participants/association-check-apply",
        {
          method: "POST",
          headers: {
            "x-admin-sync-secret": secret,
          },
        },
      );
      const payload = (await response.json()) as ParticipantAssociationCheckReport;

      if (!response.ok || payload.ok === false) {
        setParticipantCheckError(
          payload.message ?? "Errore apply verifica tessere.",
        );
      }

      setParticipantCheckApplyReport(payload);
      setParticipantCheckPreview(payload);
      setParticipantCheckPage(1);
      setParticipantCheckStatusFilter("all");
      setParticipantCheckMatchFilter("all");
      setParticipantCheckSearch("");
      await loadParticipants();
    } catch (error) {
      setParticipantCheckError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setApplyingParticipantCheck(false);
    }
  }

  async function loadMembershipRecap() {
    if (!secret.trim()) {
      setMembershipRecapError("Inserisci il codice admin.");
      return;
    }

    setLoadingMembershipRecap(true);
    setMembershipRecapError(null);
    setMembershipRecapSavedIds({});

    try {
      const response = await fetch("/api/admin/participants/membership-recap", {
        headers: {
          "x-admin-sync-secret": secret,
        },
      });
      const payload = (await response.json()) as MembershipRecapResponse;

      if (!response.ok || payload.ok === false) {
        setMembershipRecapRows([]);
        setMembershipRecapDrafts({});
        setMembershipRecapError(payload.message ?? "Errore caricamento recap.");
        return;
      }

      const rows = payload.rows ?? [];
      setMembershipRecapRows(rows);
      setMembershipRecapDrafts(createMembershipRecapDrafts(rows));
      setMembershipRecapPage(1);
    } catch (error) {
      setMembershipRecapRows([]);
      setMembershipRecapDrafts({});
      setMembershipRecapError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setLoadingMembershipRecap(false);
    }
  }

  function updateMembershipRecapDraft(
    participantId: string,
    field: keyof MembershipRecapDraft,
    value: string,
  ) {
    setMembershipRecapDrafts((current) => ({
      ...current,
      [participantId]: {
        ...(current[participantId] ?? {
          association_status: "unknown",
          association_expires_at: "",
          notes_admin: "",
        }),
        [field]: value,
      },
    }));
    setMembershipRecapSavedIds((current) => ({
      ...current,
      [participantId]: false,
    }));
  }

  function applyMembershipRecapSuggestion(row: MembershipRecapRow) {
    setMembershipRecapDrafts((current) => ({
      ...current,
      [row.participant_id]: {
        association_status: row.suggested_final_status,
        association_expires_at: row.suggested_expires_at ?? "",
        notes_admin: current[row.participant_id]?.notes_admin ?? row.notes_admin ?? "",
      },
    }));
    setMembershipRecapSavedIds((current) => ({
      ...current,
      [row.participant_id]: false,
    }));
  }

  async function saveMembershipRecapRow(row: MembershipRecapRow) {
    const draft = membershipRecapDrafts[row.participant_id];
    if (!draft || !isMembershipRecapRowModified(row, draft)) return;

    setSavingMembershipRecapId(row.participant_id);
    setMembershipRecapError(null);

    try {
      const response = await fetch(`/api/admin/participants/${row.participant_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-sync-secret": secret,
        },
        body: JSON.stringify({
          association_status: draft.association_status,
          association_expires_at: draft.association_expires_at || null,
          notes_admin: draft.notes_admin || null,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || payload.ok === false) {
        setMembershipRecapError(payload.message ?? "Errore salvataggio recap.");
        return;
      }

      setMembershipRecapRows((current) =>
        current.map((currentRow) =>
          currentRow.participant_id === row.participant_id
            ? {
                ...currentRow,
                current_association_status: draft.association_status,
                current_association_expires_at:
                  draft.association_expires_at || null,
                notes_admin: draft.notes_admin || null,
              }
            : currentRow,
        ),
      );
      setMembershipRecapSavedIds((current) => ({
        ...current,
        [row.participant_id]: true,
      }));
    } catch (error) {
      setMembershipRecapError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setSavingMembershipRecapId(null);
    }
  }

  function updateParticipantCheckStatusFilter(
    filter: ParticipantCheckStatusFilter,
  ) {
    setParticipantCheckStatusFilter(filter);
    setParticipantCheckPage(1);
  }

  function updateParticipantCheckMatchFilter(filter: ParticipantCheckMatchFilter) {
    setParticipantCheckMatchFilter(filter);
    setParticipantCheckPage(1);
  }

  function updateParticipantCheckSearch(value: string) {
    setParticipantCheckSearch(value);
    setParticipantCheckPage(1);
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] px-5 py-8 text-[#211815] sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col">
        <section className="order-1 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.06)] md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Admin
          </p>
          <h1 className="mt-3 font-serif text-4xl font-medium md:text-5xl">
            Gestione eventi e tessere
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
            Segui gli step in ordine. Quando uno step ha due bottoni, il primo
            controlla i dati senza salvare, il secondo conferma l&apos;aggiornamento.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-sm font-medium text-[#5f524c]">
              Codice admin
              <input
                className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-[#211815] outline-none transition focus:border-[#8b5e4a]"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="off"
              />
              <span className="mt-2 block text-xs font-normal leading-5 text-[#5f524c]">
                Serve per autorizzare le operazioni di sincronizzazione.
              </span>
            </label>
            <button
              className="hidden rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              disabled={syncing}
              onClick={handleSync}
            >
              {syncing ? "Sincronizzo..." : "Sincronizza Ticket Tailor"}
            </button>
          </div>

          {false && syncResults.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {syncResults.map((result) => (
                <div
                  className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                  key={result.label}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                    {result.label}
                  </p>
                  <p
                    className={`mt-2 text-sm font-medium ${
                      result.ok ? "text-[#2f5b3a]" : "text-[#8b2f2a]"
                    }`}
                  >
                    {result.ok ? "OK" : "Errore"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#5f524c]">
                    {result.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className="mt-6 flex gap-2">
          <button
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
              activeTab === "tessere"
                ? "bg-[#211815] text-[#f4efe8]"
                : "border border-[#211815]/20 text-[#211815]"
            }`}
            type="button"
            onClick={() => setActiveTab("tessere")}
          >
            Gestione Tessere
          </button>
          <button
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
              activeTab === "partner"
                ? "bg-[#211815] text-[#f4efe8]"
                : "border border-[#211815]/20 text-[#211815]"
            }`}
            type="button"
            onClick={() => setActiveTab("partner")}
          >
            Gestione Partner
          </button>
        </div>

        {activeTab === "tessere" && (
          <>
        <section className="order-1 mt-6 rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-5 md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Riepilogo del processo
          </p>
          <h2 className="mt-2 font-serif text-3xl font-medium">
            Riepilogo del processo
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5f524c]">
            Segui le fasi in ordine. Le fasi con due azioni prevedono prima un
            controllo senza salvataggio e poi una conferma.
          </p>

          <ol className="mt-5 grid gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c] md:grid-cols-6">
            {[
              "Soci ufficiali",
              "Nuove iscrizioni",
              "Biglietti",
              "Verifica tessere",
              "Partecipanti",
              "Recap tessere",
            ].map((label, index) => (
              <li
                className="flex items-center gap-2 rounded-full border border-[#211815]/10 bg-white/55 px-3 py-2"
                key={label}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#211815] text-[#f4efe8]">
                  {index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>

          <div className="mt-5 hidden overflow-x-auto rounded-[8px] border border-[#211815]/10 md:block">
            <table className="min-w-[1100px] w-full border-collapse bg-white/60 text-left text-sm">
              <thead className="bg-[#211815]/5 text-[11px] uppercase tracking-[0.12em] text-[#5f524c]">
                <tr>
                  {[
                    "Fase",
                    "Cosa aggiorna",
                    "Fonte dati",
                    "Azione da fare",
                    "Risultato",
                  ].map((column) => (
                    <th className="border-b border-[#211815]/10 px-4 py-3" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processSummaryRows.map((row) => (
                  <tr className="border-b border-[#211815]/8" key={row.phase}>
                    <td className="px-4 py-4 font-semibold text-[#211815]">
                      {row.phase}
                    </td>
                    <td className="px-4 py-4 text-[#5f524c]">{row.updates}</td>
                    <td className="px-4 py-4 text-[#5f524c]">{row.source}</td>
                    <td className="px-4 py-4 text-[#5f524c]">{row.action}</td>
                    <td className="px-4 py-4 text-[#5f524c]">{row.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {processSummaryRows.map((row) => (
              <div
                className="rounded-[8px] border border-[#211815]/10 bg-white/60 p-4"
                key={row.phase}
              >
                <p className="font-semibold text-[#211815]">{row.phase}</p>
                <p className="mt-2 text-sm text-[#5f524c]">
                  <span className="font-semibold text-[#211815]">Cosa aggiorna:</span>{" "}
                  {row.updates}
                </p>
                <p className="mt-2 text-sm text-[#5f524c]">
                  <span className="font-semibold text-[#211815]">Fonte dati:</span>{" "}
                  {row.source}
                </p>
                <p className="mt-2 text-sm text-[#5f524c]">
                  <span className="font-semibold text-[#211815]">Azione da fare:</span>{" "}
                  {row.action}
                </p>
                <p className="mt-2 text-sm text-[#5f524c]">
                  <span className="font-semibold text-[#211815]">Risultato:</span>{" "}
                  {row.result}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="order-4 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#211815] font-serif text-2xl text-[#f4efe8]">
                3
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Fase 3
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  3. Aggiorna biglietti Ticket Tailor
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Importa eventi, ordini, biglietti, acquirenti, partecipanti e
                  check-in da Ticket Tailor. Questo step non verifica le
                  tessere.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={syncing}
                onClick={handleSync}
              >
                {syncing ? "Aggiorno..." : "Aggiorna dati Ticket Tailor"}
              </button>
              <button
                className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={syncingProfiles}
                onClick={handleSyncProfiles}
              >
                {syncingProfiles ? "Sync profili..." : "Sync Profili"}
              </button>
            </div>
          </div>

          {profilesSyncResult ? (
            <div
              className={`mt-4 rounded-[8px] border p-3 text-sm ${
                profilesSyncResult.ok
                  ? "border-[#2f5b3a]/20 bg-[#2f5b3a]/5 text-[#2f5b3a]"
                  : "border-[#8b2f2a]/20 bg-[#8b2f2a]/5 text-[#8b2f2a]"
              }`}
            >
              {profilesSyncResult.ok ? "Sync profili OK — " : "Sync profili: "}
              {typeof profilesSyncResult.message === "string"
                ? profilesSyncResult.message
                : [
                    `${profilesSyncResult.ordersRead ?? 0} ordini`,
                    `${profilesSyncResult.profilesCreated ?? 0} profili creati`,
                    `${profilesSyncResult.profilesSkipped ?? 0} già esistenti`,
                    `${profilesSyncResult.enrollmentsCreated ?? 0} enrollment creati`,
                    `${profilesSyncResult.partnerPrefilled ?? 0} partner compilati`,
                  ].join(" · ")}
            </div>
          ) : null}

          {syncResults.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {syncResults.map((result) => (
                <div
                  className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                  key={result.label}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                    {result.label}
                  </p>
                  <p
                    className={`mt-2 text-sm font-medium ${
                      result.ok ? "text-[#2f5b3a]" : "text-[#8b2f2a]"
                    }`}
                  >
                    {result.ok ? "OK" : "Errore"}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#5f524c]">
                    {result.summary}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="order-5 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#211815] font-serif text-2xl text-[#f4efe8]">
                4
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Fase 4
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  4. Verifica tessere dei partecipanti
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Confronta i partecipanti importati da Ticket Tailor con i soci
                  presenti nel sistema. Prima controlla il risultato, poi
                  conferma l&apos;aggiornamento.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={previewingParticipantCheck || applyingParticipantCheck}
                onClick={handlePreviewParticipantAssociationCheck}
              >
                {previewingParticipantCheck
                  ? "Controllo..."
                  : "Controlla tessere partecipanti"}
              </button>
              <button
                className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={
                  !participantCheckPreview ||
                  previewingParticipantCheck ||
                  applyingParticipantCheck
                }
                onClick={handleApplyParticipantAssociationCheck}
              >
                {applyingParticipantCheck
                  ? "Confermo..."
                  : "Conferma verifica tessere"}
              </button>
            </div>
          </div>

          {participantCheckError ? (
            <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
              {participantCheckError}
            </p>
          ) : null}

          {participantCheckApplyReport ? (
            <p className="mt-4 rounded-[8px] border border-[#2f5b3a]/20 bg-[#2f5b3a]/5 p-3 text-sm text-[#2f5b3a]">
              Verifica tessere confermata: {participantCheckApplyReport.updated ?? 0}{" "}
              partecipanti aggiornati.
            </p>
          ) : null}

          {participantCheckPreview ? (
            <div className="mt-5 space-y-4">
              {!participantCheckApplyReport ? (
                <p className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-sm text-[#5f524c]">
                  Controllo completato. Nessun dato è stato ancora salvato.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {[
                  ["Partecipanti analizzati", participantCheckPreview.totalAttendees],
                  ["Tessere valide", participantCheckPreview.verified],
                  ["Da validare", participantCheckPreview.pending],
                  ["Scadute", participantCheckPreview.expired],
                  ["Non trovate", participantCheckPreview.notFound],
                  ["Da controllare", participantCheckPreview.manualReview],
                  ["Match multipli", participantCheckPreview.multipleMatches],
                ].map(([label, value]) => (
                  <div
                    className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                    key={label}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                      {label}
                    </p>
                    <p className="mt-2 font-serif text-3xl text-[#211815]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {participantCheckPreview.errors &&
              participantCheckPreview.errors.length > 0 ? (
                <div className="rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
                  {participantCheckPreview.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              <div className="space-y-3 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Tutti", "all"],
                    ["Da controllare", "manual_review"],
                    ["Non trovati", "not_found"],
                    ["Scaduti", "expired"],
                    ["Validi", "verified"],
                  ].map(([label, filter]) => (
                    <button
                      className={quickFilterButtonClass(
                        participantCheckStatusFilter === filter,
                      )}
                      key={filter}
                      type="button"
                      onClick={() =>
                        updateParticipantCheckStatusFilter(
                          filter as ParticipantCheckStatusFilter,
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  className="w-fit rounded-full border border-[#211815]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c] transition hover:border-[#8b5e4a] hover:text-[#211815]"
                  type="button"
                  onClick={() =>
                    setShowParticipantCheckAdvancedFilters((current) => !current)
                  }
                >
                  {showParticipantCheckAdvancedFilters
                    ? "Nascondi filtri avanzati"
                    : "Mostra filtri avanzati"}
                </button>

                {showParticipantCheckAdvancedFilters ? (
                  <label className="block max-w-sm text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Tipo di corrispondenza
                    <select
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/70 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={participantCheckMatchFilter}
                      onChange={(event) =>
                        updateParticipantCheckMatchFilter(
                          event.target.value as ParticipantCheckMatchFilter,
                        )
                      }
                    >
                      <option value="all">Tutti i match</option>
                      <option value="email">Email</option>
                      <option value="name">Nome</option>
                      <option value="none">Nessun match</option>
                      <option value="multiple">Multiplo</option>
                    </select>
                  </label>
                ) : null}

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)] md:items-end">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Cerca
                    <input
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/70 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={participantCheckSearch}
                      onChange={(event) =>
                        updateParticipantCheckSearch(event.target.value)
                      }
                      placeholder="Nome, email, evento, motivo"
                    />
                  </label>
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  {participantCheckDisplayStart}-{participantCheckDisplayEnd} di{" "}
                  {filteredParticipantCheckRows.length} · Pagina{" "}
                  {safeParticipantCheckPage} di {participantCheckTotalPages}
                </p>
              </div>

              <div className="overflow-x-auto rounded-[8px] border border-[#211815]/10">
                <table className="min-w-[1200px] w-full border-collapse bg-[#f4efe8]/60 text-left text-xs">
                  <thead className="bg-[#211815]/5 uppercase tracking-[0.12em] text-[#5f524c]">
                    <tr>
                      {[
                        "partecipante",
                        "email",
                        "evento",
                        "attuale",
                        "suggerito",
                        "corrispondenza",
                        "socio trovato",
                        "scadenza",
                        "motivo",
                      ].map((column) => (
                        <th className="border-b border-[#211815]/10 px-3 py-3" key={column}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedParticipantCheckRows.length > 0 ? (
                      pagedParticipantCheckRows.map((row) => (
                        <tr className="border-b border-[#211815]/8" key={row.participant_id}>
                          <td className="px-3 py-3">{row.participant_name}</td>
                          <td className="px-3 py-3">{row.participant_email ?? "-"}</td>
                          <td className="px-3 py-3">
                            {row.ticket_tailor_event_id ?? row.event_id ?? "-"}
                          </td>
                          <td className="px-3 py-3">
                            {formatAssociationStatusLabel(
                              row.current_association_status,
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {formatAssociationStatusLabel(
                              row.suggested_association_status,
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {formatMatchMethodLabel(row.match_method)}
                          </td>
                          <td className="px-3 py-3">{row.matched_member_id ?? "-"}</td>
                          <td className="px-3 py-3">
                            {row.matched_member_expires_at ?? "-"}
                          </td>
                          <td className="px-3 py-3">{row.reason}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-[#5f524c]" colSpan={9}>
                          Nessuna riga da mostrare.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  {participantCheckDisplayStart}-{participantCheckDisplayEnd} di{" "}
                  {filteredParticipantCheckRows.length}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeParticipantCheckPage <= 1}
                    onClick={() =>
                      setParticipantCheckPage((page) => Math.max(1, page - 1))
                    }
                  >
                    Precedente
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Pagina {safeParticipantCheckPage} di{" "}
                    {participantCheckTotalPages}
                  </span>
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeParticipantCheckPage >= participantCheckTotalPages}
                    onClick={() =>
                      setParticipantCheckPage((page) =>
                        Math.min(participantCheckTotalPages, page + 1),
                      )
                    }
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="order-2 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#211815] font-serif text-2xl text-[#f4efe8]">
                1
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Fase 1
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  1. Aggiorna libro soci ufficiale
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Legge il tab &lsquo;libro soci&rsquo; e aggiorna lo stato
                  ufficiale delle tessere: valide, scadute o da controllare.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={previewingBookSync || applyingBookSync}
                onClick={handlePreviewBookSync}
              >
                {previewingBookSync ? "Controllo..." : "Controlla libro soci"}
              </button>
              <button
                className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={!bookSyncPreview || previewingBookSync || applyingBookSync}
                onClick={handleApplyBookSync}
              >
                {applyingBookSync
                  ? "Confermo..."
                  : "Conferma aggiornamento libro soci"}
              </button>
            </div>
          </div>

          {bookSyncError ? (
            <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
              {bookSyncError}
            </p>
          ) : null}

          {bookSyncApplyReport ? (
            <p className="mt-4 rounded-[8px] border border-[#2f5b3a]/20 bg-[#2f5b3a]/5 p-3 text-sm text-[#2f5b3a]">
              Libro soci aggiornato.
            </p>
          ) : null}

          {bookSyncPreview ? (
            <div className="mt-5 space-y-4">
              {!bookSyncApplyReport ? (
                <p className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-sm text-[#5f524c]">
                  Controllo completato. Nessun dato è stato ancora salvato.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {[
                  ["Righe lette", bookSyncPreview.totalRows],
                  ["Validi", bookSyncPreview.verifiedRows],
                  ["Scaduti", bookSyncPreview.expiredRows],
                  ["Da creare", bookSyncPreview.wouldCreate],
                  ["Da aggiornare", bookSyncPreview.wouldUpdate],
                  ["Già allineati", bookSyncPreview.unchanged],
                  ["Non valide", bookSyncPreview.invalidRows],
                ].map(([label, value]) => (
                  <div
                    className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                    key={label}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                      {label}
                    </p>
                    <p className="mt-2 font-serif text-3xl text-[#211815]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {bookSyncPreview.fallbackNameMatchCount > 0 ? (
                <p className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-sm text-[#5f524c]">
                  Corrispondenze per nome/cognome usate:{" "}
                  {bookSyncPreview.fallbackNameMatchCount}.
                </p>
              ) : null}

              {bookSyncPreview.detectedColumns ? (
                <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                    Colonne rilevate
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-[#5f524c] md:grid-cols-4">
                    {[
                      ["Nome", bookSyncPreview.detectedColumns.first_name],
                      ["Cognome", bookSyncPreview.detectedColumns.last_name],
                      ["Codice fiscale", bookSyncPreview.detectedColumns.fiscal_code],
                      ["Data nascita", bookSyncPreview.detectedColumns.birth_date],
                      ["Data accettazione", bookSyncPreview.detectedColumns.accepted_at],
                      ["Data cessazione", bookSyncPreview.detectedColumns.ceased_at],
                      ["Quota 2026", bookSyncPreview.detectedColumns.current_year_quota],
                      ["N. tessera 2026", bookSyncPreview.detectedColumns.current_year_card_number],
                    ].map(([label, column]) => (
                      <p key={label as string}>
                        <span className="font-semibold text-[#211815]">
                          {label as string}:
                        </span>{" "}
                        {(column as DetectedSheetColumn).header ?? "-"}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {bookSyncPreview.errors.length > 0 ? (
                <div className="rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
                  {bookSyncPreview.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.4fr)_minmax(160px,0.65fr)_minmax(180px,0.75fr)_auto] lg:items-end">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Cerca
                    <input
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={bookSyncPreviewFilters.search}
                      onChange={(event) => {
                        setBookSyncPreviewFilters((current) => ({
                          ...current,
                          search: event.target.value,
                        }));
                        setBookSyncPreviewPage(1);
                      }}
                      placeholder="Cerca nome, cognome, codice fiscale o tessera"
                    />
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Stato
                    <select
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={bookSyncPreviewFilters.status}
                      onChange={(event) => {
                        setBookSyncPreviewFilters((current) => ({
                          ...current,
                          status: event.target.value as BookSyncPreviewFilters["status"],
                        }));
                        setBookSyncPreviewPage(1);
                      }}
                    >
                      <option value="all">Tutti</option>
                      <option value="verified">Validi</option>
                      <option value="expired">Scaduti</option>
                      <option value="invalid">Non validi</option>
                    </select>
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Azione
                    <select
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={bookSyncPreviewFilters.action}
                      onChange={(event) => {
                        setBookSyncPreviewFilters((current) => ({
                          ...current,
                          action: event.target.value as BookSyncPreviewFilters["action"],
                        }));
                        setBookSyncPreviewPage(1);
                      }}
                    >
                      <option value="all">Tutte</option>
                      <option value="create">Da creare</option>
                      <option value="update">Da aggiornare</option>
                      <option value="unchanged">Già allineate</option>
                      <option value="invalid">Non valide</option>
                    </select>
                  </label>

                  <button
                    className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5"
                    type="button"
                    onClick={() => {
                      setBookSyncPreviewFilters({
                        search: "",
                        status: "all",
                        action: "all",
                      });
                      setBookSyncPreviewPage(1);
                    }}
                  >
                    Reset filtri
                  </button>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  Mostrati {filteredBookSyncRows.length} di{" "}
                  {bookSyncPreview.previewRows.length} soci
                </p>
              </div>

              <div className="overflow-x-auto rounded-[8px] border border-[#211815]/10">
                <table className="min-w-[1100px] w-full border-collapse bg-[#f4efe8]/60 text-left text-xs">
                  <thead className="bg-[#211815]/5 uppercase tracking-[0.12em] text-[#5f524c]">
                    <tr>
                      {[
                        "riga",
                        "nome",
                        "codice fiscale",
                        "nascita",
                        "stato",
                        "scadenza",
                        "tessera",
                        "azione",
                        "corrispondenza",
                        "note",
                      ].map((column) => (
                        <th className="border-b border-[#211815]/10 px-3 py-3" key={column}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBookSyncRows.length > 0 ? (
                      pagedBookSyncRows.map((row) => (
                        <tr className="border-b border-[#211815]/8" key={row.rowNumber}>
                          <td className="px-3 py-3">{row.rowNumber}</td>
                          <td className="px-3 py-3">
                            {row.first_name} {row.last_name}
                          </td>
                          <td className="px-3 py-3">{row.fiscal_code ?? "-"}</td>
                          <td className="px-3 py-3">{row.birth_date ?? "-"}</td>
                          <td className="px-3 py-3">
                            {formatMembershipStatusLabel(row.membership_status)}
                          </td>
                          <td className="px-3 py-3">{row.membership_expires_at}</td>
                          <td className="px-3 py-3">{row.membership_card_number ?? "-"}</td>
                          <td className="px-3 py-3">
                            {formatPreviewActionLabel(row.action)}
                          </td>
                          <td className="px-3 py-3">
                            {formatMatchMethodLabel(row.matchMethod)}
                          </td>
                          <td className="px-3 py-3">
                            {[...row.notes, ...row.errors].join(" · ")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-[#5f524c]" colSpan={10}>
                          Nessuna riga da mostrare.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  {bookSyncDisplayStart}-{bookSyncDisplayEnd} di{" "}
                  {filteredBookSyncRows.length}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeBookSyncPreviewPage <= 1}
                    onClick={() =>
                      setBookSyncPreviewPage((page) => Math.max(1, page - 1))
                    }
                  >
                    Precedente
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Pagina {safeBookSyncPreviewPage} di {bookSyncTotalPages}
                  </span>
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeBookSyncPreviewPage >= bookSyncTotalPages}
                    onClick={() =>
                      setBookSyncPreviewPage((page) =>
                        Math.min(bookSyncTotalPages, page + 1),
                      )
                    }
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="order-3 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#211815] font-serif text-2xl text-[#f4efe8]">
                2
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Fase 2
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  2. Aggiorna nuove iscrizioni
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Legge il Google Sheet collegato al form associativo e importa
                  le nuove iscrizioni dal 01/09/2025 in poi. Le compilazioni
                  precedenti vengono ignorate.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={previewingMembersSync || applyingMembersSync}
                onClick={handlePreviewMembersSync}
              >
                {previewingMembersSync
                  ? "Controllo..."
                  : "Controlla nuove iscrizioni"}
              </button>
              <button
                className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={
                  !membersSyncPreview ||
                  previewingMembersSync ||
                  applyingMembersSync
                }
                onClick={handleApplyMembersSync}
              >
                {applyingMembersSync
                  ? "Confermo..."
                  : "Conferma nuove iscrizioni"}
              </button>
            </div>
          </div>

          {membersSyncError ? (
            <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
              {membersSyncError}
            </p>
          ) : null}

          {membersSyncApplyReport ? (
            <p className="mt-4 rounded-[8px] border border-[#2f5b3a]/20 bg-[#2f5b3a]/5 p-3 text-sm text-[#2f5b3a]">
              Nuove iscrizioni confermate: {membersSyncApplyReport.created ?? 0}{" "}
              nuove, {membersSyncApplyReport.updated ?? 0} aggiornate.
            </p>
          ) : null}

          {membersSyncPreview ? (
            <div className="mt-5 space-y-4">
              {!membersSyncApplyReport ? (
                <p className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-sm text-[#5f524c]">
                  Controllo completato. Nessun dato è stato ancora salvato.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {[
                  ["Righe lette", membersSyncPreview.totalRows],
                  ["Da creare", membersSyncPreview.wouldCreate],
                  ["Da aggiornare", membersSyncPreview.wouldUpdate],
                  ["Già allineate", membersSyncPreview.unchanged],
                  ["Non valide", membersSyncPreview.invalidRows],
                  [
                    "Escluse perché precedenti al 01/09/2025",
                    membersSyncPreview.skippedBeforeValidFrom ?? 0,
                  ],
                  [
                    "Data mancante ricostruita",
                    membersSyncPreview.fallbackStartDateCount,
                  ],
                ].map(([label, value]) => (
                  <div
                    className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                    key={label}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                      {label}
                    </p>
                    <p className="mt-2 font-serif text-3xl text-[#211815]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {membersSyncPreview.fallbackNameMatchCount > 0 ? (
                <p className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-sm text-[#5f524c]">
                  Corrispondenze per nome/cognome usate:{" "}
                  {membersSyncPreview.fallbackNameMatchCount}.
                </p>
              ) : null}

              {membersSyncPreview.detectedColumns ? (
                <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                    Colonne rilevate
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-[#5f524c] md:grid-cols-5">
                    {[
                      ["Nome", membersSyncPreview.detectedColumns.first_name],
                      ["Cognome", membersSyncPreview.detectedColumns.last_name],
                      ["Email", membersSyncPreview.detectedColumns.email],
                      ["Data", membersSyncPreview.detectedColumns.membership_starts_at],
                      ["Contatto", membersSyncPreview.detectedColumns.contact],
                    ].map(([label, column]) => (
                      <p key={label as string}>
                        <span className="font-semibold text-[#211815]">
                          {label as string}:
                        </span>{" "}
                        {(column as DetectedSheetColumn).header ?? "-"}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {membersSyncPreview.errors.length > 0 ? (
                <div className="rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
                  {membersSyncPreview.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Tutte", "all"],
                    ["Da creare", "create"],
                    ["Da aggiornare", "update"],
                    ["Già allineate", "unchanged"],
                    ["Non valide", "invalid"],
                  ].map(([label, filter]) => (
                    <button
                      className={quickFilterButtonClass(
                        membersSyncPreviewFilter === filter,
                      )}
                      key={filter}
                      type="button"
                      onClick={() =>
                        updateMembersSyncPreviewFilter(
                          filter as MembersSyncPreviewFilter,
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  {membersSyncDisplayStart}-{membersSyncDisplayEnd} di{" "}
                  {filteredMembersSyncRows.length} · Pagina{" "}
                  {safeMembersSyncPreviewPage} di {membersSyncTotalPages}
                </div>
              </div>

              <div className="overflow-x-auto rounded-[8px] border border-[#211815]/10">
                <table className="min-w-[980px] w-full border-collapse bg-[#f4efe8]/60 text-left text-xs">
                  <thead className="bg-[#211815]/5 uppercase tracking-[0.12em] text-[#5f524c]">
                    <tr>
                      {[
                        "riga",
                        "nome",
                        "email",
                        "inizio",
                        "scadenza",
                        "azione",
                        "corrispondenza",
                        "note",
                      ].map((column) => (
                        <th
                          className="border-b border-[#211815]/10 px-3 py-3"
                          key={column}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMembersSyncRows.length > 0 ? (
                    pagedMembersSyncRows.map((row) => (
                      <tr className="border-b border-[#211815]/8" key={row.rowNumber}>
                        <td className="px-3 py-3">{row.rowNumber}</td>
                        <td className="px-3 py-3">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="px-3 py-3">{row.email ?? "-"}</td>
                        <td className="px-3 py-3">{row.membership_starts_at}</td>
                        <td className="px-3 py-3">{row.membership_expires_at}</td>
                        <td className="px-3 py-3">
                          {formatPreviewActionLabel(row.action)}
                        </td>
                        <td className="px-3 py-3">
                          {formatMatchMethodLabel(row.matchMethod)}
                        </td>
                        <td className="px-3 py-3">
                          {row.notes.length > 0 ? row.notes.join(" · ") : ""}
                          {row.notes.length > 0 &&
                          (row.fallbackStartDate || row.errors.length > 0)
                            ? " · "
                            : ""}
                          {row.action === "skipped" && row.errors.length === 0
                            ? "Compilazione precedente al 01/09/2025: da verificare manualmente."
                            : ""}
                          {row.fallbackStartDate
                            ? `${row.action === "skipped" ? " · " : ""}data fallback`
                            : ""}
                          {row.errors.length > 0
                            ? `${
                                row.fallbackStartDate || row.action === "skipped"
                                  ? " · "
                                  : ""
                              }${row.errors.join(" · ")}`
                            : ""}
                        </td>
                      </tr>
                    ))
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-[#5f524c]" colSpan={8}>
                          Nessuna riga per questo filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  {membersSyncDisplayStart}-{membersSyncDisplayEnd} di{" "}
                  {filteredMembersSyncRows.length}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeMembersSyncPreviewPage <= 1}
                    onClick={() =>
                      setMembersSyncPreviewPage((page) => Math.max(1, page - 1))
                    }
                  >
                    Precedente
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Pagina {safeMembersSyncPreviewPage} di{" "}
                    {membersSyncTotalPages}
                  </span>
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeMembersSyncPreviewPage >= membersSyncTotalPages}
                    onClick={() =>
                      setMembersSyncPreviewPage((page) =>
                        Math.min(membersSyncTotalPages, page + 1),
                      )
                    }
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="order-8 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Strumenti avanzati
          </p>
          <h2 className="mt-2 font-serif text-3xl font-medium">
            Strumenti avanzati
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
            Funzioni di controllo manuale o debug. Non servono nel flusso
            ordinario.
          </p>
          <details className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[#211815]">
              Mostra strumenti avanzati
            </summary>
            <div className="mt-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                Soci
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium">
                Verifica manuale soci
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                Strumento precedente per verifiche manuali su nominativi. Usare
                solo per casi storici, controlli puntuali o debug.
              </p>
            </div>
            <button
              className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5"
              type="button"
              onClick={handlePreviewImportSoci}
            >
              Controlla lista manuale
            </button>
          </div>

          <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
            Lista Nome/Cognome
            <textarea
              className="mt-2 min-h-[180px] w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-3 text-sm normal-case leading-6 tracking-normal text-[#211815] outline-none transition focus:border-[#8b5e4a]"
              value={importSociText}
              onChange={(event) => {
                setImportSociText(event.target.value);
                setImportSociPreview(null);
                setImportSociMatchPreview(null);
                setImportSociMatchError(null);
              }}
              placeholder={"Nome\tCognome\nMario Rossi\nAnna Maria\tSiviero\\"}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              onClick={handleSearchImportSociMatches}
              disabled={matchingImportSoci}
            >
              {matchingImportSoci
                ? "Cerco match..."
                : "Cerca corrispondenze"}
            </button>
          </div>

          {importSociPreview ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[8px] border border-[#2f5b3a]/20 bg-[#2f5b3a]/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2f5b3a]">
                  Righe valide ({importSociPreview.validRows.length})
                </p>
                {importSociPreview.validRows.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-[#211815]">
                    {importSociPreview.validRows.map((row) => (
                      <li key={`${row.lineNumber}-${row.firstName}-${row.lastName}`}>
                        <span className="font-semibold">Riga {row.lineNumber}:</span>{" "}
                        {row.firstName} {row.lastName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[#5f524c]">
                    Nessuna riga valida trovata.
                  </p>
                )}
              </div>

              <div className="rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b2f2a]">
                  Righe non valide ({importSociPreview.invalidRows.length})
                </p>
                {importSociPreview.invalidRows.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-[#211815]">
                    {importSociPreview.invalidRows.map((row) => (
                      <li key={`${row.lineNumber}-${row.raw}`}>
                        <span className="font-semibold">Riga {row.lineNumber}:</span>{" "}
                        {row.raw || "-"}{" "}
                        <span className="text-[#8b2f2a]">({row.reason})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[#5f524c]">
                    Nessuna riga non valida.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {importSociMatchError ? (
            <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
              {importSociMatchError}
            </p>
          ) : null}

          {importSociMatchPreview ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Input validi", importSociMatchPreview.totalInput],
                  ["Corrispondenze univoche", importSociMatchPreview.uniqueMatches],
                  ["Corrispondenze multiple", importSociMatchPreview.multipleMatches],
                  ["Non trovati", importSociMatchPreview.notFound],
                ].map(([label, value]) => (
                  <div
                    className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                    key={label}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                      {label}
                    </p>
                    <p className="mt-2 font-serif text-3xl text-[#211815]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <ImportSociMatchBlock
                title="Corrispondenze univoche"
                tone="success"
                results={uniqueImportSociMatches}
              />
              <ImportSociMatchBlock
                title="Corrispondenze multiple"
                tone="warning"
                results={multipleImportSociMatches}
              />
              <ImportSociMatchBlock
                title="Non trovati"
                tone="danger"
                results={notFoundImportSociMatches}
              />
            </div>
          ) : null}
            </div>
          </details>
        </section>

        <section className="order-6 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#211815] font-serif text-2xl text-[#f4efe8]">
                5
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Fase 5
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  5. Controlla partecipanti evento
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Mostra acquirenti, partecipanti, check-in e stato tessera
                  dopo la verifica. Il check-in riguarda solo i partecipanti.
                </p>
              </div>
            </div>
          </div>

          <form
            className="mt-5 grid gap-3 md:grid-cols-5"
            onSubmit={loadParticipants}
          >
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
              Evento
              <select
                className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#8b5e4a]"
                value={filters.ticket_tailor_event_id}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    ticket_tailor_event_id: event.target.value,
                  }))
                }
              >
                <option value="">Tutti gli eventi</option>
                {events
                  .filter((event) => event.ticket_tailor_event_id)
                  .map((event) => (
                    <option
                      key={event.id}
                      value={event.ticket_tailor_event_id ?? ""}
                    >
                      {formatEventOptionLabel(event)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
              Tipo
              <select
                className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#8b5e4a]"
                value={filters.participant_type}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    participant_type: event.target.value,
                  }))
                }
              >
                <option value="">Tutti</option>
                <option value="attendee">Partecipanti</option>
                <option value="buyer">Acquirenti</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
              Check-in
              <select
                className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#8b5e4a]"
                value={filters.checked_in}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    checked_in: event.target.value,
                  }))
                }
              >
                <option value="">Tutti</option>
                <option value="true">Sì</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
              Stato tessera
              <select
                className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#8b5e4a]"
                value={filters.association_status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    association_status: event.target.value,
                  }))
                }
              >
                <option value="">Tutti</option>
                {associationStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatAssociationStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 md:self-end"
              type="submit"
              disabled={loadingParticipants}
            >
              {loadingParticipants ? "Carico..." : "Carica partecipanti"}
            </button>
          </form>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Righe mostrate", participantSummary.total],
              ["Check-in fatto", participantSummary.checkedIn],
              ["Check-in mancante", participantSummary.notCheckedIn],
              ["Da verificare", participantSummary.toVerify],
              ["Tessere valide", participantSummary.verified],
            ].map(([label, value]) => (
              <div
                className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                key={label}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                  {label}
                </p>
                <p className="mt-2 font-serif text-3xl text-[#211815]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(160px,0.8fr))_auto] lg:items-end">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                Cerca
                <input
                  className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                  value={participantListFilters.search}
                  onChange={(event) =>
                    setParticipantListFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Cerca nome, email, ordine o evento"
                />
              </label>

              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                Stato tessera
                <select
                  className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                  value={participantListFilters.associationStatus}
                  onChange={(event) =>
                    setParticipantListFilters((current) => ({
                      ...current,
                      associationStatus: event.target.value,
                    }))
                  }
                >
                  <option value="">Tutte</option>
                  <option value="verified">Tessera valida</option>
                  <option value="pending">Da validare</option>
                  <option value="expired">Scaduta</option>
                  <option value="not_found">Non trovata</option>
                  <option value="manual_review">Da controllare</option>
                  <option value="unknown">Da verificare</option>
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                Check-in
                <select
                  className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                  value={participantListFilters.checkedIn}
                  onChange={(event) =>
                    setParticipantListFilters((current) => ({
                      ...current,
                      checkedIn: event.target.value,
                    }))
                  }
                >
                  <option value="">Tutti</option>
                  <option value="true">Check-in effettuato</option>
                  <option value="false">Check-in non effettuato</option>
                </select>
              </label>

              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                Tipo
                <select
                  className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                  value={participantListFilters.participantType}
                  onChange={(event) =>
                    setParticipantListFilters((current) => ({
                      ...current,
                      participantType: event.target.value,
                    }))
                  }
                >
                  <option value="">Tutti</option>
                  <option value="attendee">Solo partecipanti</option>
                  <option value="buyer">Solo acquirenti</option>
                </select>
              </label>

              <button
                className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5"
                type="button"
                onClick={() => {
                  setParticipantListFilters({
                    search: "",
                    associationStatus: "",
                    checkedIn: "",
                    participantType: "",
                  });
                  setQuickFilterMode("none");
                }}
              >
                Reset filtri
              </button>
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
              Mostrati {displayedParticipants.length} di{" "}
              {quickFilteredParticipants.length} partecipanti
            </p>
          </div>

          {eventsError ? (
            <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
              {eventsError}
            </p>
          ) : null}

          {participantError ? (
            <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
              {participantError}
            </p>
          ) : null}

          <div className="mt-5 space-y-4">
            {participantOrderGroups.length > 0 ? (
              participantOrderGroups.map((group) => (
                <div
                  className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4"
                  key={group.key}
                >
                  <div className="flex flex-col gap-2 border-b border-[#211815]/10 pb-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                        Ordine
                      </p>
                      <h3 className="mt-1 font-serif text-2xl text-[#211815]">
                        {group.orderId ?? "Senza codice ordine"}
                      </h3>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                      {group.buyers.length} acquirenti · {group.attendees.length} partecipanti
                    </p>
                  </div>

                  {group.hiddenRows > 0 ? (
                    <p className="mt-3 rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                      Alcune righe dell&apos;ordine sono nascoste dai filtri.
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {group.buyers.length > 0 ? (
                      group.buyers.map((buyer) => (
                        <ParticipantOrderRow
                          key={buyer.id}
                          participant={buyer}
                          roleLabel="Acquirente"
                          variant="buyer"
                          onEdit={() => setEditingParticipantId(buyer.id)}
                        />
                      ))
                    ) : (
                      <div className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-sm text-[#5f524c]">
                        Acquirente esplicito non presente per questo ordine.
                      </div>
                    )}

                    {group.attendees.length > 0 ? (
                      <div className="space-y-2 border-l border-[#211815]/15 pl-3 md:ml-5 md:pl-5">
                        {group.attendees.map((attendee) => (
                          <ParticipantOrderRow
                            key={attendee.id}
                            participant={attendee}
                            roleLabel="Partecipante"
                            variant="attendee"
                            onEdit={() => setEditingParticipantId(attendee.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="pl-1 text-sm text-[#5f524c]">
                        Nessun partecipante collegato a questo ordine.
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 px-4 py-8 text-center text-sm text-[#5f524c]">
                Nessun partecipante caricato.
              </div>
            )}
          </div>

          <div className="hidden">
            <table className="min-w-[1600px] w-full border-collapse bg-[#f4efe8]/60 text-left text-sm">
              <thead className="bg-[#211815]/5 text-[11px] uppercase tracking-[0.14em] text-[#5f524c]">
                <tr>
                  {[
                    "first_name",
                    "last_name",
                    "email",
                    "participant_type",
                    "ticket_tailor_event_id",
                    "association_status",
                    "association_expires_at",
                    "notes_admin",
                    "checked_in",
                    "checked_in_source",
                    "ticket_tailor_order_id",
                    "azioni",
                  ].map((column) => (
                    <th className="border-b border-[#211815]/10 px-3 py-3" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedParticipants.length > 0 ? (
                  displayedParticipants.map((participant) => (
                    <tr
                      className={`border-b border-[#211815]/8 ${participantRowClass(participant)}`}
                      key={participant.id}
                    >
                      <td className="px-3 py-3">{participant.first_name ?? "-"}</td>
                      <td className="px-3 py-3">{participant.last_name ?? "-"}</td>
                      <td className="px-3 py-3">{participant.email ?? "-"}</td>
                      <td className="px-3 py-3">{participant.participant_type ?? "-"}</td>
                      <td className="px-3 py-3">{participant.ticket_tailor_event_id ?? "-"}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={participant.association_status} />
                        <select
                          className="mt-2 w-full min-w-[150px] rounded-[8px] border border-[#211815]/15 bg-white/70 px-2 py-2 text-sm outline-none focus:border-[#8b5e4a]"
                          value={
                            participantDrafts[participant.id]?.association_status ??
                            participant.association_status ??
                            "unknown"
                          }
                          onChange={(event) =>
                            updateParticipantDraft(
                              participant.id,
                              "association_status",
                              event.target.value,
                            )
                          }
                        >
                          {associationStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          className="w-full min-w-[150px] rounded-[8px] border border-[#211815]/15 bg-white/70 px-2 py-2 text-sm outline-none focus:border-[#8b5e4a]"
                          type="date"
                          value={
                            participantDrafts[participant.id]
                              ?.association_expires_at ??
                            participant.association_expires_at ??
                            ""
                          }
                          onChange={(event) =>
                            updateParticipantDraft(
                              participant.id,
                              "association_expires_at",
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          className="w-full min-w-[220px] rounded-[8px] border border-[#211815]/15 bg-white/70 px-2 py-2 text-sm outline-none focus:border-[#8b5e4a]"
                          value={
                            participantDrafts[participant.id]?.notes_admin ??
                            participant.notes_admin ??
                            ""
                          }
                          onChange={(event) =>
                            updateParticipantDraft(
                              participant.id,
                              "notes_admin",
                              event.target.value,
                            )
                          }
                          placeholder="Nota admin"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <CheckedInBadge checkedIn={participant.checked_in} />
                        <span className="sr-only">
                        {participant.checked_in === null
                          ? "-"
                          : participant.checked_in
                            ? "Sì"
                            : "No"}
                        </span>
                      </td>
                      <td className="px-3 py-3">{participant.checked_in_source ?? "-"}</td>
                      <td className="px-3 py-3">{participant.ticket_tailor_order_id ?? "-"}</td>
                      <td className="px-3 py-3">
                        <button
                          className="rounded-full bg-[#211815] px-4 py-2 text-xs font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                          type="button"
                          disabled={savingParticipantId === participant.id}
                          onClick={() => saveParticipantAssociation(participant.id)}
                        >
                          {savingParticipantId === participant.id
                            ? "Salvo..."
                            : "Salva"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-[#5f524c]" colSpan={12}>
                      Nessun partecipante caricato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="order-7 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#211815] font-serif text-2xl text-[#f4efe8]">
                6
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Fase 6
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  6. Recap tessere partecipanti
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Tabella finale di controllo. Mostra solo i partecipanti
                  effettivi e permette di correggere manualmente stato tessera,
                  scadenza e note.
                </p>
              </div>
            </div>
            <button
              className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              disabled={loadingMembershipRecap}
              onClick={loadMembershipRecap}
            >
              {loadingMembershipRecap ? "Carico..." : "Carica recap tessere"}
            </button>
          </div>

          {membershipRecapError ? (
            <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
              {membershipRecapError}
            </p>
          ) : null}

          {membershipRecapRows.length > 0 ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(150px,0.75fr))_auto] lg:items-end">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Cerca
                    <input
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={membershipRecapFilters.search}
                      onChange={(event) => {
                        setMembershipRecapFilters((current) => ({
                          ...current,
                          search: event.target.value,
                        }));
                        setMembershipRecapPage(1);
                      }}
                      placeholder="Cerca nome, email, ordine o evento"
                    />
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Stato tessera finale
                    <select
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={membershipRecapFilters.associationStatus}
                      onChange={(event) => {
                        setMembershipRecapFilters((current) => ({
                          ...current,
                          associationStatus: event.target.value,
                        }));
                        setMembershipRecapPage(1);
                      }}
                    >
                      <option value="">Tutte</option>
                      {associationStatusesForEditing.map((status) => (
                        <option key={status} value={status}>
                          {formatAssociationStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Libro soci
                    <select
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={membershipRecapFilters.membersBookStatus}
                      onChange={(event) => {
                        setMembershipRecapFilters((current) => ({
                          ...current,
                          membersBookStatus: event.target.value,
                        }));
                        setMembershipRecapPage(1);
                      }}
                    >
                      <option value="">Tutti</option>
                      <option value="valid">Valido</option>
                      <option value="expired">Scaduto</option>
                      <option value="pending">Da validare</option>
                      <option value="not_present">Non presente</option>
                      <option value="manual_review">Da controllare</option>
                    </select>
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Google Form
                    <select
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={membershipRecapFilters.googleFormStatus}
                      onChange={(event) => {
                        setMembershipRecapFilters((current) => ({
                          ...current,
                          googleFormStatus: event.target.value,
                        }));
                        setMembershipRecapPage(1);
                      }}
                    >
                      <option value="">Tutti</option>
                      <option value="present">Presente</option>
                      <option value="not_present">Non presente</option>
                      <option value="manual_review">Da controllare</option>
                    </select>
                  </label>

                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Check-in
                    <select
                      className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={membershipRecapFilters.checkedIn}
                      onChange={(event) => {
                        setMembershipRecapFilters((current) => ({
                          ...current,
                          checkedIn: event.target.value,
                        }));
                        setMembershipRecapPage(1);
                      }}
                    >
                      <option value="">Tutti</option>
                      <option value="true">Check-in effettuato</option>
                      <option value="false">Check-in non effettuato</option>
                    </select>
                  </label>

                  <button
                    className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5"
                    type="button"
                    onClick={() => {
                      setMembershipRecapFilters({
                        search: "",
                        associationStatus: "",
                        membersBookStatus: "",
                        googleFormStatus: "",
                        checkedIn: "",
                      });
                      setMembershipRecapPage(1);
                    }}
                  >
                    Reset filtri
                  </button>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  Mostrati {filteredMembershipRecapRows.length} di{" "}
                  {membershipRecapRows.length} partecipanti
                </p>
              </div>

              <div className="overflow-x-auto rounded-[8px] border border-[#211815]/10">
                <table className="min-w-[1700px] w-full border-collapse bg-[#f4efe8]/60 text-left text-xs">
                  <thead className="bg-[#211815]/5 uppercase tracking-[0.12em] text-[#5f524c]">
                    <tr>
                      {[
                        "Evento",
                        "Ordine",
                        "Partecipante",
                        "Email",
                        "Check-in",
                        "Libro soci",
                        "Google Form",
                        "Scadenza prevista",
                        "Stato tessera finale",
                        "Note admin",
                        "Azione",
                      ].map((column) => (
                        <th className="border-b border-[#211815]/10 px-3 py-3" key={column}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedMembershipRecapRows.length > 0 ? (
                      pagedMembershipRecapRows.map((row) => {
                        const draft = membershipRecapDrafts[row.participant_id] ?? {
                          association_status:
                            row.current_association_status ?? "unknown",
                          association_expires_at:
                            row.current_association_expires_at ?? "",
                          notes_admin: row.notes_admin ?? "",
                        };
                        const modified = isMembershipRecapRowModified(row, draft);

                        return (
                          <tr
                            className={`border-b border-[#211815]/8 ${
                              modified ? "bg-[#8b5e4a]/10" : ""
                            }`}
                            key={row.participant_id}
                          >
                            <td className="px-3 py-3">
                              {row.event_title ??
                                row.ticket_tailor_event_id ??
                                row.event_id ??
                                "-"}
                            </td>
                            <td className="px-3 py-3">
                              {row.ticket_tailor_order_id ?? "-"}
                            </td>
                            <td className="px-3 py-3 font-semibold text-[#211815]">
                              {row.first_name ?? "-"} {row.last_name ?? ""}
                            </td>
                            <td className="px-3 py-3">{row.email ?? "-"}</td>
                            <td className="px-3 py-3">
                              <CheckedInBadge checkedIn={row.checked_in} />
                            </td>
                            <td className="px-3 py-3">
                              <RecapStatusBadge
                                label={formatMembersBookStatusLabel(
                                  row.members_book_status,
                                )}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <RecapStatusBadge
                                label={formatGoogleFormStatusLabel(
                                  row.google_form_status,
                                )}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                className="w-full min-w-[145px] rounded-[8px] border border-[#211815]/15 bg-white/80 px-2 py-2 text-sm outline-none focus:border-[#8b5e4a]"
                                type="date"
                                value={draft.association_expires_at}
                                onChange={(event) =>
                                  updateMembershipRecapDraft(
                                    row.participant_id,
                                    "association_expires_at",
                                    event.target.value,
                                  )
                                }
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                className="w-full min-w-[160px] rounded-[8px] border border-[#211815]/15 bg-white/80 px-2 py-2 text-sm outline-none focus:border-[#8b5e4a]"
                                value={draft.association_status}
                                onChange={(event) =>
                                  updateMembershipRecapDraft(
                                    row.participant_id,
                                    "association_status",
                                    event.target.value,
                                  )
                                }
                              >
                                {associationStatusesForEditing.map((status) => (
                                  <option key={status} value={status}>
                                    {formatAssociationStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <textarea
                                className="min-h-[76px] w-full min-w-[220px] rounded-[8px] border border-[#211815]/15 bg-white/80 px-2 py-2 text-sm leading-5 outline-none focus:border-[#8b5e4a]"
                                value={draft.notes_admin}
                                onChange={(event) =>
                                  updateMembershipRecapDraft(
                                    row.participant_id,
                                    "notes_admin",
                                    event.target.value,
                                  )
                                }
                                placeholder="Nota interna admin"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex min-w-[170px] flex-col gap-2">
                                <button
                                  className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5"
                                  type="button"
                                  onClick={() => applyMembershipRecapSuggestion(row)}
                                >
                                  Applica suggerimento
                                </button>
                                <button
                                  className="rounded-full bg-[#211815] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                                  type="button"
                                  disabled={
                                    !modified ||
                                    savingMembershipRecapId === row.participant_id
                                  }
                                  onClick={() => saveMembershipRecapRow(row)}
                                >
                                  {savingMembershipRecapId === row.participant_id
                                    ? "Salvo..."
                                    : "Salva"}
                                </button>
                                {membershipRecapSavedIds[row.participant_id] ? (
                                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2f5b3a]">
                                    Salvato
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-[#5f524c]" colSpan={11}>
                          Nessun partecipante da mostrare.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                  {membershipRecapDisplayStart}-{membershipRecapDisplayEnd} di{" "}
                  {filteredMembershipRecapRows.length}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeMembershipRecapPage <= 1}
                    onClick={() =>
                      setMembershipRecapPage((page) => Math.max(1, page - 1))
                    }
                  >
                    Precedente
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Pagina {safeMembershipRecapPage} di{" "}
                    {membershipRecapTotalPages}
                  </span>
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#211815] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    disabled={safeMembershipRecapPage >= membershipRecapTotalPages}
                    onClick={() =>
                      setMembershipRecapPage((page) =>
                        Math.min(membershipRecapTotalPages, page + 1),
                      )
                    }
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 px-4 py-8 text-center text-sm text-[#5f524c]">
              Carica il recap per controllare solo i partecipanti effettivi.
            </div>
          )}
        </section>
          </>
        )}

        {activeTab === "partner" && (
          <section className="mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Partner
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  Gestione Partner
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Enrollment che richiedono un partner. Evidenziati quelli con
                  dati da Ticket Tailor ancora da confermare.
                </p>
              </div>
              <button
                className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={loadingPartners}
                onClick={loadPartners}
              >
                {loadingPartners ? "Carico..." : "Carica partner"}
              </button>
            </div>

            {partnerError ? (
              <p className="mt-4 rounded-[8px] border border-[#8b2f2a]/20 bg-[#8b2f2a]/5 p-3 text-sm text-[#8b2f2a]">
                {partnerError}
              </p>
            ) : null}

            {partnerRows.length > 0 ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["Totale", partnerRows.length],
                      [
                        "Da confermare",
                        partnerRows.filter(
                          (r) => r.partner_source === "ticket_tailor",
                        ).length,
                      ],
                      [
                        "Confermati",
                        partnerRows.filter((r) => r.partner_source === "user")
                          .length,
                      ],
                      [
                        "Non indicati",
                        partnerRows.filter((r) => !r.partner_source).length,
                      ],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div
                      className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                      key={label}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                        {label}
                      </p>
                      <p className="mt-2 font-serif text-3xl text-[#211815]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Cerca acquirente
                    <input
                      className="mt-1 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      type="text"
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                      placeholder="Nome, nickname, email"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Evento
                    <select
                      className="mt-1 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={partnerEventFilter}
                      onChange={(e) => setPartnerEventFilter(e.target.value)}
                    >
                      <option value="">Tutti gli eventi</option>
                      {partnerUniqueEvents.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Fonte
                    <select
                      className="mt-1 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
                      value={partnerSourceFilter}
                      onChange={(e) => setPartnerSourceFilter(e.target.value)}
                    >
                      <option value="">Tutti</option>
                      <option value="ticket_tailor">Da Ticket Tailor</option>
                      <option value="user">Confermato</option>
                      <option value="none">Non indicato</option>
                    </select>
                  </label>
                  <button
                    className="rounded-full border border-[#211815]/20 px-4 py-2.5 text-xs font-semibold text-[#211815] transition hover:-translate-y-0.5"
                    type="button"
                    onClick={() => {
                      setPartnerSearch("");
                      setPartnerEventFilter("");
                      setPartnerSourceFilter("");
                    }}
                  >
                    Reset filtri
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto rounded-[8px] border border-[#211815]/10">
                  <table className="min-w-[800px] w-full border-collapse bg-white/60 text-left text-sm">
                    <thead className="bg-[#211815]/5 text-[11px] uppercase tracking-[0.12em] text-[#5f524c]">
                      <tr>
                        {[
                          "Acquirente",
                          "Email",
                          "Evento",
                          "Data",
                          "Partner",
                          "Fonte",
                          "Azioni",
                        ].map((col) => (
                          <th
                            className="border-b border-[#211815]/10 px-3 py-3"
                            key={col}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPartnerRows.length > 0 ? (
                        filteredPartnerRows.map((row) => {
                          const draft = partnerDrafts[row.id] ?? {
                            partner_email: row.partner_email ?? "",
                            partner_name: row.partner_name ?? "",
                          };
                          const isEditing = editingPartnerId === row.id;
                          const isSaving = savingPartnerId === row.id;
                          const isSaved = partnerSavedIds[row.id] ?? false;
                          const buyerLabel =
                            row.buyer_nickname ??
                            row.buyer_first_name ??
                            row.buyer_email ??
                            "—";
                          return (
                            <tr
                              className="border-b border-[#211815]/10 last:border-0 hover:bg-[#f4efe8]/40"
                              key={row.id}
                            >
                              <td className="px-3 py-3 font-medium text-[#211815]">
                                {buyerLabel}
                              </td>
                              <td className="px-3 py-3 text-[#5f524c]">
                                {row.buyer_email ?? "—"}
                              </td>
                              <td className="max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap px-3 py-3 text-[#5f524c]">
                                {row.event_title ?? "—"}
                              </td>
                              <td className="px-3 py-3 text-[#5f524c]">
                                {row.event_starts_at
                                  ? formatDate(row.event_starts_at)
                                  : "—"}
                              </td>
                              <td className="px-3 py-3 text-[#5f524c]">
                                {isEditing ? (
                                  <div className="grid gap-1.5">
                                    <input
                                      className="rounded-[6px] border border-[#211815]/15 bg-[#f4efe8]/80 px-2 py-1.5 text-xs text-[#211815] outline-none focus:border-[#8b5e4a]"
                                      type="email"
                                      placeholder="Email partner"
                                      value={draft.partner_email}
                                      onChange={(e) =>
                                        setPartnerDrafts((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...draft,
                                            partner_email: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                    <input
                                      className="rounded-[6px] border border-[#211815]/15 bg-[#f4efe8]/80 px-2 py-1.5 text-xs text-[#211815] outline-none focus:border-[#8b5e4a]"
                                      type="text"
                                      placeholder="Nome partner"
                                      value={draft.partner_name}
                                      onChange={(e) =>
                                        setPartnerDrafts((prev) => ({
                                          ...prev,
                                          [row.id]: {
                                            ...draft,
                                            partner_name: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                ) : (
                                  row.partner_name || row.partner_email || "—"
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {row.partner_source === "ticket_tailor" ? (
                                  <span className="inline-flex rounded-full border border-[#8b5e4a]/25 bg-[#8b5e4a]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8b5e4a]">
                                    Da TT
                                  </span>
                                ) : row.partner_source === "user" ? (
                                  <span className="inline-flex rounded-full border border-[#2f5b3a]/25 bg-[#2f5b3a]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#2f5b3a]">
                                    Confermato
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full border border-[#211815]/15 bg-[#211815]/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#5f524c]">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      className="rounded-full bg-[#211815] px-3 py-1.5 text-xs font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:opacity-55"
                                      type="button"
                                      disabled={isSaving}
                                      onClick={async () => {
                                        await savePartnerRow(row.id);
                                        setEditingPartnerId(null);
                                      }}
                                    >
                                      {isSaving ? "…" : "Salva"}
                                    </button>
                                    <button
                                      className="text-xs text-[#5f524c] transition hover:text-[#211815]"
                                      type="button"
                                      onClick={() => setEditingPartnerId(null)}
                                    >
                                      Annulla
                                    </button>
                                    {isSaved ? (
                                      <span className="text-xs text-[#2f5b3a]">
                                        ✓
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <button
                                    className="rounded-full border border-[#211815]/20 px-3 py-1.5 text-xs font-semibold text-[#211815] transition hover:-translate-y-0.5"
                                    type="button"
                                    onClick={() => setEditingPartnerId(row.id)}
                                  >
                                    Modifica
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            className="px-3 py-6 text-center text-[#5f524c]"
                            colSpan={7}
                          >
                            Nessun risultato.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        )}
      </div>

      {editingParticipant ? (
        <AssociationEditModal
          participant={editingParticipant}
          draft={participantDrafts[editingParticipant.id]}
          saving={savingParticipantId === editingParticipant.id}
          onClose={() => setEditingParticipantId(null)}
          onChange={updateParticipantDraft}
          onSave={saveEditingParticipantAssociation}
        />
      ) : null}
    </main>
  );
}

function ParticipantOrderRow({
  participant,
  roleLabel,
  variant,
  onEdit,
}: {
  participant: Participant;
  roleLabel: string;
  variant: "buyer" | "attendee";
  onEdit: () => void;
}) {
  const showCheckIn = variant === "attendee";

  return (
    <div
      className={`rounded-[8px] border border-[#211815]/10 bg-white/70 p-3 ${participantRowClass(participant)}`}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                variant === "buyer"
                  ? "border-[#211815]/15 bg-[#211815]/5 text-[#211815]"
                  : "border-[#8b5e4a]/20 bg-[#8b5e4a]/10 text-[#8b5e4a]"
              }`}
            >
              {roleLabel}
            </span>
            <StatusBadge status={participant.association_status} />
          </div>
          <p className="mt-2 text-sm font-semibold text-[#211815]">
            {participant.first_name ?? "-"} {participant.last_name ?? "-"}
          </p>
          <p className="mt-1 text-xs text-[#5f524c]">
            {participant.email ?? "-"}
          </p>
        </div>

        <div className="grid gap-2 text-xs text-[#5f524c] sm:grid-cols-2">
          <p>
            <span className="font-semibold text-[#211815]">Evento:</span>{" "}
            {participant.ticket_tailor_event_id ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-[#211815]">Scadenza:</span>{" "}
            {participant.association_expires_at ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-[#211815]">Check-in:</span>{" "}
            {showCheckIn ? (
              <CheckedInBadge checkedIn={participant.checked_in} />
            ) : (
              "—"
            )}
          </p>
          <p>
            <span className="font-semibold text-[#211815]">Origine:</span>{" "}
            {showCheckIn ? participant.checked_in_source ?? "-" : "—"}
          </p>
        </div>

        <button
          className="rounded-full bg-[#211815] px-4 py-2 text-xs font-semibold text-[#f4efe8] transition hover:-translate-y-0.5"
          type="button"
          onClick={onEdit}
        >
          Modifica tessera
        </button>
      </div>
    </div>
  );
}

function AssociationEditModal({
  participant,
  draft,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  participant: Participant;
  draft: AssociationDraft | undefined;
  saving: boolean;
  onClose: () => void;
  onChange: (
    participantId: string,
    field: keyof AssociationDraft,
    value: string,
  ) => void;
  onSave: () => void;
}) {
  const currentDraft =
    draft ??
    ({
      association_status: participant.association_status ?? "unknown",
      association_expires_at: participant.association_expires_at ?? "",
      notes_admin: participant.notes_admin ?? "",
    } satisfies AssociationDraft);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211815]/45 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[8px] border border-[#211815]/10 bg-[#f4efe8] p-5 shadow-[0_24px_80px_rgba(33,24,21,0.28)] md:p-7">
        <div className="flex flex-col gap-3 border-b border-[#211815]/10 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              Tessera associativa
            </p>
            <h2 className="mt-2 font-serif text-3xl font-medium text-[#211815]">
              {participant.first_name ?? "-"} {participant.last_name ?? "-"}
            </h2>
            <p className="mt-2 text-sm text-[#5f524c]">
              {participant.email ?? "-"} ·{" "}
              {participant.participant_type === "buyer"
                ? "Acquirente"
                : participant.participant_type === "attendee"
                  ? "Partecipante"
                  : "-"}
            </p>
          </div>
          <button
            className="rounded-full border border-[#211815]/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c] transition hover:border-[#8b5e4a] hover:text-[#211815]"
            type="button"
            onClick={onClose}
          >
            Chiudi
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
            Stato tessera
            <select
              className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/70 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
              value={currentDraft.association_status}
              onChange={(event) =>
                onChange(
                  participant.id,
                  "association_status",
                  event.target.value,
                )
              }
            >
              {associationStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatAssociationStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
            Scadenza tessera
            <input
              className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-white/70 px-3 py-2 text-sm normal-case tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
              type="date"
              value={currentDraft.association_expires_at}
              onChange={(event) =>
                onChange(
                  participant.id,
                  "association_expires_at",
                  event.target.value,
                )
              }
            />
          </label>
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
          Nota interna admin
          <textarea
            className="mt-2 min-h-[120px] w-full rounded-[8px] border border-[#211815]/15 bg-white/70 px-3 py-3 text-sm normal-case leading-6 tracking-normal text-[#211815] outline-none focus:border-[#8b5e4a]"
            value={currentDraft.notes_admin}
            onChange={(event) =>
              onChange(participant.id, "notes_admin", event.target.value)
            }
            placeholder="Nota visibile solo agli admin"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:-translate-y-0.5"
            type="button"
            onClick={onClose}
          >
            Annulla
          </button>
          <button
            className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
            type="button"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Salvo..." : "Salva tessera"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportSociMatchBlock({
  title,
  tone,
  results,
}: {
  title: string;
  tone: "success" | "warning" | "danger";
  results: ImportSociMatchResult[];
}) {
  const toneClass =
    tone === "success"
      ? "border-[#2f5b3a]/20 bg-[#2f5b3a]/5 text-[#2f5b3a]"
      : tone === "warning"
        ? "border-[#8b5e4a]/25 bg-[#8b5e4a]/5 text-[#8b5e4a]"
        : "border-[#8b2f2a]/20 bg-[#8b2f2a]/5 text-[#8b2f2a]";

  return (
    <div className={`rounded-[8px] border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">
        {title} ({results.length})
      </p>
      {results.length > 0 ? (
        <div className="mt-3 space-y-3">
          {results.map((result) => (
            <div
              className="rounded-[8px] border border-[#211815]/10 bg-white/65 p-3 text-[#211815]"
              key={`${result.normalized_key}-${result.match_status}`}
            >
              <p className="text-sm font-semibold">
                {result.input.first_name} {result.input.last_name}
              </p>
              <p className="mt-1 text-xs text-[#5f524c]">
                Chiave di confronto: {result.normalized_key || "-"}
              </p>

              {result.matches.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {result.matches.map((match) => (
                    <div
                      className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/70 p-3"
                      key={match.id}
                    >
                      <div className="grid gap-2 text-xs text-[#5f524c] md:grid-cols-3">
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Nome:
                          </span>{" "}
                          {match.first_name ?? "-"} {match.last_name ?? "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Email:
                          </span>{" "}
                          {match.email ?? "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Tipo:
                          </span>{" "}
                          {match.participant_type === "buyer"
                            ? "Acquirente"
                            : match.participant_type === "attendee"
                              ? "Partecipante"
                              : "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Ordine:
                          </span>{" "}
                          {match.ticket_tailor_order_id ?? "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Evento:
                          </span>{" "}
                          {match.ticket_tailor_event_id ?? "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Tessera:
                          </span>{" "}
                          {formatAssociationStatusLabel(match.association_status)}
                        </p>
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Scadenza:
                          </span>{" "}
                          {match.association_expires_at ?? "-"}
                        </p>
                        <p className="md:col-span-2">
                          <span className="font-semibold text-[#211815]">
                            Note:
                          </span>{" "}
                          {match.notes_admin ?? "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#5f524c]">
                  Nessun partecipante trovato in Supabase.
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#5f524c]">Nessun risultato.</p>
      )}
    </div>
  );
}

function parseImportSociText(text: string): ImportSociPreview {
  return text.split(/\r?\n/).reduce<ImportSociPreview>(
    (preview, rawLine, index) => {
      const lineNumber = index + 1;
      const cleanedLine = rawLine
        .replace(/\\+$/g, "")
        .trim()
        .replace(/\s+/g, " ");

      if (!cleanedLine) {
        return preview;
      }

      if (cleanedLine.toLowerCase() === "nome cognome") {
        return preview;
      }

      const tabParts = rawLine
        .replace(/\\+$/g, "")
        .split("\t")
        .map((part) => part.trim().replace(/\s+/g, " "))
        .filter(Boolean);

      if (tabParts.length >= 2) {
        preview.validRows.push({
          lineNumber,
          firstName: tabParts[0],
          lastName: tabParts.slice(1).join(" "),
        });
        return preview;
      }

      const nameParts = cleanedLine.split(" ");

      if (nameParts.length >= 2) {
        preview.validRows.push({
          lineNumber,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(" "),
        });
        return preview;
      }

      preview.invalidRows.push({
        lineNumber,
        raw: cleanedLine,
        reason: "Inserisci nome e cognome.",
      });

      return preview;
    },
    {
      validRows: [],
      invalidRows: [],
    },
  );
}

function getDefaultAssociationExpiryDate(referenceDate = new Date()) {
  const referenceMonth = referenceDate.getMonth();
  const expiryYear =
    referenceMonth >= 9
      ? referenceDate.getFullYear() + 1
      : referenceDate.getFullYear();

  return `${expiryYear}-12-31`;
}

function groupParticipantsByOrder(
  participants: Participant[],
  sourceParticipants = participants,
) {
  const groups = new Map<string, ParticipantOrderGroup>();
  const sourceCounts = sourceParticipants.reduce<Record<string, number>>(
    (counts, participant) => {
      const orderId = participant.ticket_tailor_order_id?.trim() || null;
      const key = orderId ?? `participant-without-order-${participant.id}`;
      counts[key] = (counts[key] ?? 0) + 1;

      return counts;
    },
    {},
  );

  for (const participant of participants) {
    const orderId = participant.ticket_tailor_order_id?.trim() || null;
    const key = orderId ?? `participant-without-order-${participant.id}`;
    const group =
      groups.get(key) ??
      ({
        key,
        orderId,
        buyers: [],
        attendees: [],
        hiddenRows: 0,
      } satisfies ParticipantOrderGroup);

    if (participant.participant_type === "buyer") {
      group.buyers.push(participant);
    } else {
      group.attendees.push(participant);
    }

    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    hiddenRows: Math.max(
      0,
      (sourceCounts[group.key] ?? 0) - group.buyers.length - group.attendees.length,
    ),
  }));
}

function createParticipantDrafts(participants: Participant[]) {
  return participants.reduce<Record<string, AssociationDraft>>(
    (drafts, participant) => {
      drafts[participant.id] = {
        association_status: participant.association_status ?? "unknown",
        association_expires_at: participant.association_expires_at ?? "",
        notes_admin: participant.notes_admin ?? "",
      };

      return drafts;
    },
    {},
  );
}

function createMembershipRecapDrafts(rows: MembershipRecapRow[]) {
  return rows.reduce<Record<string, MembershipRecapDraft>>((drafts, row) => {
    drafts[row.participant_id] = {
      association_status:
        row.current_association_status ?? row.suggested_final_status ?? "unknown",
      association_expires_at:
        row.current_association_expires_at ?? row.suggested_expires_at ?? "",
      notes_admin: row.notes_admin ?? "",
    };

    return drafts;
  }, {});
}

function matchesMembershipRecapFilters(
  row: MembershipRecapRow,
  filters: MembershipRecapFilters,
  drafts: Record<string, MembershipRecapDraft>,
) {
  const draft = drafts[row.participant_id];
  const status = normalizeAssociationStatus(
    draft?.association_status ?? row.current_association_status,
  );
  const search = filters.search.trim().toLowerCase();
  const searchMatches = search
    ? [
        row.first_name ?? "",
        row.last_name ?? "",
        row.email ?? "",
        row.ticket_tailor_order_id ?? "",
        row.ticket_tailor_event_id ?? "",
        row.event_title ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    : true;
  const statusMatches = filters.associationStatus
    ? status === filters.associationStatus
    : true;
  const membersBookMatches = filters.membersBookStatus
    ? row.members_book_status === filters.membersBookStatus
    : true;
  const googleFormMatches = filters.googleFormStatus
    ? row.google_form_status === filters.googleFormStatus
    : true;
  const checkInMatches = filters.checkedIn
    ? filters.checkedIn === "true"
      ? row.checked_in === true
      : row.checked_in !== true
    : true;

  return (
    searchMatches &&
    statusMatches &&
    membersBookMatches &&
    googleFormMatches &&
    checkInMatches
  );
}

function isMembershipRecapRowModified(
  row: MembershipRecapRow,
  draft: MembershipRecapDraft,
) {
  return (
    draft.association_status !==
      normalizeAssociationStatus(row.current_association_status) ||
    (draft.association_expires_at || "") !==
      (row.current_association_expires_at ?? "") ||
    (draft.notes_admin || "") !== (row.notes_admin ?? "")
  );
}

function applyQuickFilter(
  participants: Participant[],
  quickFilterMode: QuickFilterMode,
) {
  if (quickFilterMode === "association_to_verify") {
    return participants.filter((participant) =>
      associationStatusesToVerify.has(
        normalizeAssociationStatus(participant.association_status),
      ),
    );
  }

  return participants;
}

function matchesBookSyncPreviewFilters(
  row: OfficialMembersBookPreviewRow,
  filters: BookSyncPreviewFilters,
) {
  const search = filters.search.trim().toLowerCase();
  const rowText = [
    row.first_name,
    row.last_name,
    row.fiscal_code ?? "",
    row.birth_date ?? "",
    row.membership_card_number ?? "",
    ...row.notes,
    ...row.errors,
  ]
    .join(" ")
    .toLowerCase();
  const searchMatches = search ? rowText.includes(search) : true;
  const statusMatches =
    filters.status === "all"
      ? true
      : filters.status === "invalid"
        ? row.action === "invalid" || row.errors.length > 0
        : row.membership_status === filters.status;
  const actionMatches =
    filters.action === "all" ? true : row.action === filters.action;

  return searchMatches && statusMatches && actionMatches;
}

function applyParticipantListFilters(
  participants: Participant[],
  filters: ParticipantListFilters,
  events: AdminEvent[],
) {
  const search = filters.search.trim().toLowerCase();

  return participants.filter((participant) => {
    const status = normalizeParticipantListStatus(
      participant.association_status,
    );
    const eventTitle = findParticipantEventTitle(participant, events);

    const searchMatches = search
      ? [
          participant.first_name ?? "",
          participant.last_name ?? "",
          participant.email ?? "",
          participant.ticket_tailor_order_id ?? "",
          participant.ticket_tailor_event_id ?? "",
          eventTitle ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      : true;

    const statusMatches = filters.associationStatus
      ? status === filters.associationStatus
      : true;
    const typeMatches = filters.participantType
      ? participant.participant_type === filters.participantType
      : true;
    const checkInMatches = filters.checkedIn
      ? participant.participant_type === "attendee" &&
        (filters.checkedIn === "true"
          ? participant.checked_in === true
          : participant.checked_in !== true)
      : true;

    return searchMatches && statusMatches && typeMatches && checkInMatches;
  });
}

function normalizeParticipantListStatus(status: string | null) {
  const normalized = normalizeAssociationStatus(status);

  if (normalized === "missing") {
    return "not_found";
  }

  return normalized || "unknown";
}

function findParticipantEventTitle(
  participant: Participant,
  events: AdminEvent[],
) {
  const event = events.find(
    (candidate) =>
      candidate.ticket_tailor_event_id === participant.ticket_tailor_event_id,
  );

  return event?.title ?? event?.slug ?? null;
}

function getParticipantSummary(participants: Participant[]) {
  return participants.reduce(
    (summary, participant) => {
      const status = normalizeAssociationStatus(participant.association_status);

      summary.total += 1;

      if (participant.participant_type === "attendee") {
        if (participant.checked_in === true) {
          summary.checkedIn += 1;
        } else {
          summary.notCheckedIn += 1;
        }
      }

      if (["unknown", "missing", "expired"].includes(status)) {
        summary.toVerify += 1;
      }

      if (status === "verified") {
        summary.verified += 1;
      }

      return summary;
    },
    {
      total: 0,
      checkedIn: 0,
      notCheckedIn: 0,
      toVerify: 0,
      verified: 0,
    },
  );
}

function normalizeAssociationStatus(status: string | null) {
  return status?.trim() || "unknown";
}

function formatAssociationStatusLabel(status: string | null) {
  const normalized = normalizeAssociationStatus(status);
  const labels: Record<string, string> = {
    verified: "Tessera valida",
    pending: "Da validare",
    expired: "Scaduta",
    not_found: "Non trovata",
    manual_review: "Da controllare",
    unknown: "Da verificare",
    missing: "Non trovata",
    not_required: "Non richiesta",
  };

  return labels[normalized] ?? normalized;
}

function formatPreviewActionLabel(action: string | null | undefined) {
  const labels: Record<string, string> = {
    create: "Da creare",
    update: "Da aggiornare",
    unchanged: "Già allineata",
    invalid: "Non valida",
    skipped: "Esclusa",
  };

  return action ? labels[action] ?? action : "-";
}

function formatMatchMethodLabel(method: string | null | undefined) {
  const labels: Record<string, string> = {
    email: "Email",
    name: "Nome",
    multiple: "Multiplo",
    none: "Nessuna corrispondenza",
    fiscal_code: "Codice fiscale",
    name_birth: "Nome e data nascita",
    fiscal_code_birth: "Codice fiscale e nascita",
  };

  return method ? labels[method] ?? method : "-";
}

function formatMembershipStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    verified: "Valida",
    expired: "Scaduta",
    pending: "Da validare",
    manual_review: "Da controllare",
  };

  return status ? labels[status] ?? status : "-";
}

function formatMembersBookStatusLabel(status: MembershipRecapRow["members_book_status"]) {
  const labels: Record<MembershipRecapRow["members_book_status"], string> = {
    valid: "Valido",
    expired: "Scaduto",
    pending: "Da validare",
    not_present: "Non presente",
    manual_review: "Da controllare",
  };

  return labels[status];
}

function formatGoogleFormStatusLabel(status: MembershipRecapRow["google_form_status"]) {
  const labels: Record<MembershipRecapRow["google_form_status"], string> = {
    present: "Presente",
    not_present: "Non presente",
    manual_review: "Da controllare",
  };

  return labels[status];
}

function quickFilterButtonClass(active: boolean) {
  return active
    ? "rounded-full border border-[#8b5e4a] bg-[#8b5e4a] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#f4efe8] transition hover:-translate-y-0.5"
    : "rounded-full border border-[#211815]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c] transition hover:border-[#8b5e4a] hover:text-[#211815]";
}

function participantRowClass(participant: Participant) {
  const status = normalizeAssociationStatus(participant.association_status);

  if (status === "missing" || status === "expired") {
    return "bg-[#8b2f2a]/7";
  }

  return "";
}

function StatusBadge({ status }: { status: string | null }) {
  const normalized = normalizeAssociationStatus(status);
  const className =
    normalized === "verified"
      ? "border-[#2f5b3a]/25 bg-[#2f5b3a]/10 text-[#2f5b3a]"
      : normalized === "missing" || normalized === "expired"
        ? "border-[#8b2f2a]/25 bg-[#8b2f2a]/10 text-[#8b2f2a]"
        : normalized === "pending"
          ? "border-[#8b5e4a]/25 bg-[#8b5e4a]/10 text-[#8b5e4a]"
          : "border-[#211815]/15 bg-[#211815]/5 text-[#5f524c]";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${className}`}
    >
      {formatAssociationStatusLabel(normalized)}
    </span>
  );
}

function RecapStatusBadge({ label }: { label: string }) {
  const className =
    label === "Valido" || label === "Presente"
      ? "border-[#2f5b3a]/25 bg-[#2f5b3a]/10 text-[#2f5b3a]"
      : label === "Scaduto" || label === "Non presente"
        ? "border-[#8b2f2a]/25 bg-[#8b2f2a]/10 text-[#8b2f2a]"
        : "border-[#8b5e4a]/25 bg-[#8b5e4a]/10 text-[#8b5e4a]";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${className}`}
    >
      {label}
    </span>
  );
}

function CheckedInBadge({ checkedIn }: { checkedIn: boolean | null }) {
  if (checkedIn === true) {
    return (
      <span className="inline-flex rounded-full border border-[#2f5b3a]/25 bg-[#2f5b3a]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2f5b3a]">
        Si
      </span>
    );
  }

  if (checkedIn === false) {
    return (
      <span className="inline-flex rounded-full border border-[#8b2f2a]/25 bg-[#8b2f2a]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8b2f2a]">
        No
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-[#211815]/15 bg-[#211815]/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5f524c]">
      N/D
    </span>
  );
}

function summarizePayload(payload: Record<string, unknown>) {
  const keys = [
    "fetched",
    "targetEvents",
    "matched",
    "upserted",
    "skipped",
    "ordersRead",
    "ticketsFound",
    "ticketsRead",
    "buyerParticipantsUpserted",
    "attendeeParticipantsUpserted",
    "errors",
  ];

  return keys
    .filter((key) => key in payload)
    .map((key) => {
      const value = payload[key];
      return `${key}: ${Array.isArray(value) ? value.length : String(value)}`;
    })
    .join(" · ");
}

function formatEventOptionLabel(event: AdminEvent) {
  const date = event.starts_at ? formatDate(event.starts_at) : "senza data";
  const title = event.title ?? "Evento";
  const ticketTailorId = event.ticket_tailor_event_id ?? "senza id";

  return `${title} · ${date} · ${ticketTailorId}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
