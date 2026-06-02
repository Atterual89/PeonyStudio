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

const associationStatuses = [
  "unknown",
  "missing",
  "pending",
  "verified",
  "expired",
  "not_required",
];

const associationStatusesToVerify = new Set([
  "unknown",
  "missing",
  "pending",
  "expired",
]);

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
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [quickFilterMode, setQuickFilterMode] =
    useState<QuickFilterMode>("none");
  const [filters, setFilters] = useState<ParticipantFilters>({
    ticket_tailor_event_id: "",
    participant_type: "attendee",
    checked_in: "",
    association_status: "",
  });
  const displayedParticipants = applyQuickFilter(participants, quickFilterMode);
  const participantSummary = getParticipantSummary(displayedParticipants);

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
    setParticipantDrafts((current) => ({
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
  }

  async function saveParticipantAssociation(participantId: string) {
    if (!secret.trim()) {
      setParticipantError("Inserisci l'Admin sync secret.");
      return;
    }

    const draft = participantDrafts[participantId];
    if (!draft) {
      setParticipantError("Dati associazione non trovati per questa riga.");
      return;
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
        return;
      }

      await loadParticipants();
    } catch (error) {
      setParticipantError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setSavingParticipantId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] px-5 py-8 text-[#211815] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.06)] md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Admin
          </p>
          <h1 className="mt-3 font-serif text-4xl font-medium md:text-5xl">
            Ticket Tailor sync
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f524c]">
            Strumento tecnico minimo per sincronizzare eventi, ordini, ticket e
            partecipanti. Nessun secret viene salvato nel client.
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

        <section className="mt-6 rounded-[8px] border border-[#211815]/10 bg-white/55 p-5 shadow-[0_12px_36px_rgba(33,24,21,0.05)] md:p-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                Partecipanti
              </p>
              <h2 className="mt-2 font-serif text-3xl font-medium">
                Event participants
              </h2>
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

          <div className="mt-5 overflow-x-auto rounded-[8px] border border-[#211815]/10">
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
    </main>
  );
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

      if (participant.checked_in === true) {
        summary.checkedIn += 1;
      } else {
        summary.notCheckedIn += 1;
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
