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

type QuickFilterMode = "none" | "association_to_verify";

type ParticipantOrderGroup = {
  key: string;
  orderId: string | null;
  buyers: Participant[];
  attendees: Participant[];
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
  const [filters, setFilters] = useState<ParticipantFilters>({
    ticket_tailor_event_id: "",
    participant_type: "attendee",
    checked_in: "",
    association_status: "",
  });
  const displayedParticipants = applyQuickFilter(participants, quickFilterMode);
  const participantOrderGroups = groupParticipantsByOrder(displayedParticipants);
  const editingParticipant = editingParticipantId
    ? participants.find((participant) => participant.id === editingParticipantId) ??
      null
    : null;
  const participantSummary = getParticipantSummary(displayedParticipants);
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
  const bookSyncTotalPages = Math.max(
    1,
    Math.ceil((bookSyncPreview?.previewRows.length ?? 0) / membersSyncPreviewPageSize),
  );
  const safeBookSyncPreviewPage = Math.min(
    bookSyncPreviewPage,
    bookSyncTotalPages,
  );
  const bookSyncPageStart =
    (safeBookSyncPreviewPage - 1) * membersSyncPreviewPageSize;
  const pagedBookSyncRows =
    bookSyncPreview?.previewRows.slice(
      bookSyncPageStart,
      bookSyncPageStart + membersSyncPreviewPageSize,
    ) ?? [];
  const bookSyncDisplayStart =
    (bookSyncPreview?.previewRows.length ?? 0) > 0 ? bookSyncPageStart + 1 : 0;
  const bookSyncDisplayEnd = Math.min(
    bookSyncPageStart + pagedBookSyncRows.length,
    bookSyncPreview?.previewRows.length ?? 0,
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
          summary: "Inserisci l'Admin sync secret.",
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

  async function loadEvents() {
    if (!secret.trim()) {
      setEventsError("Inserisci l'Admin sync secret.");
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
      setParticipantError("Inserisci l'Admin sync secret.");
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

  async function applyFilters(
    nextFilters: ParticipantFilters,
    nextQuickFilterMode: QuickFilterMode = "none",
  ) {
    setFilters(nextFilters);
    setQuickFilterMode(nextQuickFilterMode);
    await fetchParticipants(nextFilters);
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
      setParticipantError("Inserisci l'Admin sync secret.");
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
      setImportSociMatchError("Inserisci l'Admin sync secret.");
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
          payload.message ?? payload.error ?? "Errore ricerca match.",
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
      setMembersSyncError("Inserisci l'Admin sync secret.");
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
        setMembersSyncError(payload.message ?? "Errore preview sync soci.");
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
      setMembersSyncError("Inserisci l'Admin sync secret.");
      return;
    }

    if (!membersSyncPreview) {
      setMembersSyncError("Esegui prima la preview sync soci.");
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
        setMembersSyncError(payload.message ?? "Errore apply sync soci.");
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
      setBookSyncError("Inserisci l'Admin sync secret.");
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
      setBookSyncError("Inserisci l'Admin sync secret.");
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
      setParticipantCheckError("Inserisci l'Admin sync secret.");
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
      setParticipantCheckError("Inserisci l'Admin sync secret.");
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
            Admin Ticket Tailor
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
            Procedura guidata per aggiornare soci, Ticket Tailor e verifica
            tessere partecipanti. Nessun secret viene salvato nel client.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-sm font-medium text-[#5f524c]">
              Admin sync secret
              <input
                className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-[#211815] outline-none transition focus:border-[#8b5e4a]"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="off"
              />
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

        <section className="order-1 mt-6 rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-5 md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Flusso consigliato
          </p>
          <ol className="mt-3 grid gap-2 text-sm leading-6 text-[#5f524c] md:grid-cols-5">
            <li>1. Aggiorna libro soci ufficiale</li>
            <li>2. Aggiorna nuove iscrizioni da Google Form</li>
            <li>3. Sincronizza Ticket Tailor</li>
            <li>4. Esegui preview verifica tessere</li>
            <li>5. Applica verifica tessere e controlla i partecipanti</li>
          </ol>
        </section>

        <section className="order-4 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#211815] font-serif text-2xl text-[#f4efe8]">
                3
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  Step 3
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  Sync Ticket Tailor
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Importa eventi, ordini, biglietti e partecipanti da Ticket
                  Tailor. Non verifica la tessera.
                </p>
              </div>
            </div>
            <button
              className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              disabled={syncing}
              onClick={handleSync}
            >
              {syncing ? "Sincronizzo..." : "Sincronizza Ticket Tailor"}
            </button>
          </div>

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
                  Step 4
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  Verifica tessere partecipanti
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Confronta gli attendee con i soci importati e suggerisce lo
                  stato tessera per ogni partecipante.
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
                  ? "Genero preview..."
                  : "Preview verifica tessere"}
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
                  ? "Applico verifica..."
                  : "Applica verifica tessere"}
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
              Verifica applicata: {participantCheckApplyReport.updated ?? 0}{" "}
              attendee aggiornati.
            </p>
          ) : null}

          {participantCheckPreview ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {[
                  ["Attendee analizzati", participantCheckPreview.totalAttendees],
                  ["Verified", participantCheckPreview.verified],
                  ["Pending", participantCheckPreview.pending],
                  ["Expired", participantCheckPreview.expired],
                  ["Non trovati", participantCheckPreview.notFound],
                  ["Manual review", participantCheckPreview.manualReview],
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
                    ["Tutte", "all"],
                    ["Verified", "verified"],
                    ["Pending", "pending"],
                    ["Expired", "expired"],
                    ["Not found", "not_found"],
                    ["Manual review", "manual_review"],
                    ["Match multipli", "multiple"],
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

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)] md:items-end">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                    Metodo match
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
                        "attendee",
                        "email",
                        "evento",
                        "attuale",
                        "suggerito",
                        "match",
                        "socio",
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
                          <td className="px-3 py-3">{row.match_method}</td>
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
                  Step 1
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  Sync libro soci ufficiale
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Legge il tab &lsquo;libro soci&rsquo; e aggiorna lo stato
                  ufficiale delle tessere.
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
                {previewingBookSync ? "Genero preview..." : "Preview libro soci"}
              </button>
              <button
                className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                type="button"
                disabled={!bookSyncPreview || previewingBookSync || applyingBookSync}
                onClick={handleApplyBookSync}
              >
                {applyingBookSync ? "Applico sync..." : "Applica libro soci"}
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
              Libro soci applicato: {bookSyncApplyReport.created ?? 0} creati,{" "}
              {bookSyncApplyReport.updated ?? 0} aggiornati.
            </p>
          ) : null}

          {bookSyncPreview ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {[
                  ["Righe lette", bookSyncPreview.totalRows],
                  ["Validi", bookSyncPreview.verifiedRows],
                  ["Scaduti", bookSyncPreview.expiredRows],
                  ["Da creare", bookSyncPreview.wouldCreate],
                  ["Da aggiornare", bookSyncPreview.wouldUpdate],
                  ["Allineati", bookSyncPreview.unchanged],
                  ["Non validi", bookSyncPreview.invalidRows],
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
                  Match fallback nome/cognome usati:{" "}
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

              <div className="overflow-x-auto rounded-[8px] border border-[#211815]/10">
                <table className="min-w-[1100px] w-full border-collapse bg-[#f4efe8]/60 text-left text-xs">
                  <thead className="bg-[#211815]/5 uppercase tracking-[0.12em] text-[#5f524c]">
                    <tr>
                      {[
                        "riga",
                        "nome",
                        "codice fiscale",
                        "nascita",
                        "status",
                        "scadenza",
                        "tessera",
                        "azione",
                        "match",
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
                          <td className="px-3 py-3">{row.membership_status}</td>
                          <td className="px-3 py-3">{row.membership_expires_at}</td>
                          <td className="px-3 py-3">{row.membership_card_number ?? "-"}</td>
                          <td className="px-3 py-3">{row.action}</td>
                          <td className="px-3 py-3">{row.matchMethod}</td>
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
                  {bookSyncPreview.previewRows.length}
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
                  Step 2
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  Sync nuove iscrizioni da Google Form
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Legge il Google Sheet collegato al form associativo e importa
                  le nuove iscrizioni dal 01/09/2025 in poi.
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
                  ? "Genero preview..."
                  : "Preview nuove iscrizioni"}
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
                  ? "Applico sync..."
                  : "Applica nuove iscrizioni"}
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
              Sync applicata: {membersSyncApplyReport.created ?? 0} creati,{" "}
              {membersSyncApplyReport.updated ?? 0} aggiornati.
            </p>
          ) : null}

          {membersSyncPreview ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {[
                  ["Righe lette", membersSyncPreview.totalRows],
                  ["Da creare", membersSyncPreview.wouldCreate],
                  ["Da aggiornare", membersSyncPreview.wouldUpdate],
                  ["Allineate", membersSyncPreview.unchanged],
                  ["Non valide", membersSyncPreview.invalidRows],
                  [
                    "Escluse prima del 01/09/2025",
                    membersSyncPreview.skippedBeforeValidFrom ?? 0,
                  ],
                  ["Fallback data", membersSyncPreview.fallbackStartDateCount],
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
                  Match fallback nome/cognome usati:{" "}
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
                    ["Allineate", "unchanged"],
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
                        "match",
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
                        <td className="px-3 py-3">{row.action}</td>
                        <td className="px-3 py-3">{row.matchMethod}</td>
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

        <section className="order-7 mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Strumenti avanzati
          </p>
          <h2 className="mt-2 font-serif text-3xl font-medium">
            Strumenti avanzati
          </h2>
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
              Preview import soci
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
                : "Cerca match in Supabase"}
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
                  ["Match univoci", importSociMatchPreview.uniqueMatches],
                  ["Match multipli", importSociMatchPreview.multipleMatches],
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
                title="Match univoci"
                tone="success"
                results={uniqueImportSociMatches}
              />
              <ImportSociMatchBlock
                title="Match multipli"
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
                  Step 5
                </p>
                <h2 className="mt-2 font-serif text-3xl font-medium">
                  Lista partecipanti evento
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
                  Mostra i partecipanti importati da Ticket Tailor. Il check-in
                  riguarda solo gli attendee.
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
                <option value="attendee">attendee</option>
                <option value="buyer">buyer</option>
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
              Associazione
              <input
                className="mt-2 w-full rounded-[8px] border border-[#211815]/15 bg-[#f4efe8]/80 px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#8b5e4a]"
                value={filters.association_status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    association_status: event.target.value,
                  }))
                }
                placeholder="unknown"
              />
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
              ["Checked-in", participantSummary.checkedIn],
              ["Non checked-in", participantSummary.notCheckedIn],
              ["Da verificare", participantSummary.toVerify],
              ["Verified", participantSummary.verified],
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

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={quickFilterButtonClass(filters.participant_type === "attendee")}
              type="button"
              onClick={() =>
                applyFilters({
                  ...filters,
                  participant_type: "attendee",
                })
              }
            >
              Solo attendee
            </button>
            <button
              className={quickFilterButtonClass(filters.participant_type === "buyer")}
              type="button"
              onClick={() =>
                applyFilters({
                  ...filters,
                  participant_type: "buyer",
                })
              }
            >
              Solo buyer
            </button>
            <button
              className={quickFilterButtonClass(filters.checked_in === "false")}
              type="button"
              onClick={() =>
                applyFilters({
                  ...filters,
                  checked_in: "false",
                })
              }
            >
              Solo non checked-in
            </button>
            <button
              className={quickFilterButtonClass(
                quickFilterMode === "association_to_verify",
              )}
              type="button"
              onClick={() =>
                applyFilters(
                  {
                    ...filters,
                    association_status: "",
                  },
                  "association_to_verify",
                )
              }
            >
              Solo tessera da verificare
            </button>
            <button
              className="rounded-full border border-[#211815]/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c] transition hover:border-[#8b5e4a] hover:text-[#211815]"
              type="button"
              onClick={() =>
                applyFilters({
                  ticket_tailor_event_id: "",
                  participant_type: "",
                  checked_in: "",
                  association_status: "",
                })
              }
            >
              Reset filtri
            </button>
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
                        {group.orderId ?? "Senza ticket_tailor_order_id"}
                      </h3>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
                      {group.buyers.length} buyer · {group.attendees.length} attendee
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {group.buyers.length > 0 ? (
                      group.buyers.map((buyer) => (
                        <ParticipantOrderRow
                          key={buyer.id}
                          participant={buyer}
                          roleLabel="Buyer"
                          variant="buyer"
                          onEdit={() => setEditingParticipantId(buyer.id)}
                        />
                      ))
                    ) : (
                      <div className="rounded-[8px] border border-[#8b5e4a]/20 bg-[#8b5e4a]/5 p-3 text-sm text-[#5f524c]">
                        Buyer esplicito non presente per questo ordine.
                      </div>
                    )}

                    {group.attendees.length > 0 ? (
                      <div className="space-y-2 border-l border-[#211815]/15 pl-3 md:ml-5 md:pl-5">
                        {group.attendees.map((attendee) => (
                          <ParticipantOrderRow
                            key={attendee.id}
                            participant={attendee}
                            roleLabel="Attendee"
                            variant="attendee"
                            onEdit={() => setEditingParticipantId(attendee.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="pl-1 text-sm text-[#5f524c]">
                        Nessun attendee collegato a questo ordine.
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
              {participant.email ?? "-"} · {participant.participant_type ?? "-"}
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
            Association status
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
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
            Association expires at
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
          Notes admin · nota interna admin
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
                Key normalizzata: {result.normalized_key || "-"}
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
                          {match.participant_type ?? "-"}
                        </p>
                        <p>
                          <span className="font-semibold text-[#211815]">
                            Order:
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
                          {match.association_status ?? "-"}
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

function groupParticipantsByOrder(participants: Participant[]) {
  const groups = new Map<string, ParticipantOrderGroup>();

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
      } satisfies ParticipantOrderGroup);

    if (participant.participant_type === "buyer") {
      group.buyers.push(participant);
    } else {
      group.attendees.push(participant);
    }

    groups.set(key, group);
  }

  return Array.from(groups.values());
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
    manual_review: "Controllo manuale",
    unknown: "Da verificare",
  };

  return labels[normalized] ?? normalized;
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
      {normalized}
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
