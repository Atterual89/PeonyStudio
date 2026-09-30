"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MembershipStatus = "missing_form" | "payment_missing" | "valid";
type PartnerStatus =
  | "not_required"
  | "user_provided"
  | "admin_provided"
  | "missing";

type ParticipantRow = {
  id: string;
  ticket_tailor_order_id: string | null;
  ticket_type_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: MembershipStatus;
  membership_expires_at: string | null;
  partner_status: PartnerStatus;
  enrollment_id: string | null;
  partner_name: string | null;
  partner_email: string | null;
  partner_source: string | null;
};

type FutureEvent = {
  id: string;
  title: string | null;
  category: string | null;
  starts_at: string | null;
  ticket_tailor_event_id: string | null;
  partner_check_required: boolean;
  participants: ParticipantRow[];
};

type ParticipantDetail = {
  event: FutureEvent;
  participant: ParticipantRow;
};

type MemberCandidate = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  membership_status: MembershipStatus;
  membership_expires_at: string | null;
  form_present: boolean;
  current_year_paid: boolean;
};

type ActionState = {
  key: "ticket-tailor" | "profiles" | "memberships";
  ok: boolean;
  message: string;
};

export default function TicketTailorAdminHome() {
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<FutureEvent[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [runningAction, setRunningAction] = useState<ActionState["key"] | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [detail, setDetail] = useState<ParticipantDetail | null>(null);

  const summary = useMemo(() => {
    const participants = events.flatMap((event) => event.participants);
    return {
      events: events.length,
      participants: participants.length,
      membershipsToFix: participants.filter(
        (participant) => participant.membership_status !== "valid",
      ).length,
      missingPartners: participants.filter(
        (participant) => participant.partner_status === "missing",
      ).length,
    };
  }, [events]);

  async function loadDashboard() {
    if (!secret.trim()) {
      setDashboardError("Inserisci il codice admin.");
      return;
    }

    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      const response = await fetch("/api/admin/future-event-participants", {
        headers: { "x-admin-sync-secret": secret.trim() },
      });
      const payload = await readJsonResponse(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(readMessage(payload, "Errore caricamento prossimi eventi."));
      }

      setEvents(
        Array.isArray(payload.events) ? (payload.events as FutureEvent[]) : [],
      );
    } catch (error) {
      setEvents([]);
      setDashboardError(
        error instanceof Error ? error.message : "Errore sconosciuto.",
      );
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function runTicketTailorSync() {
    await runAction("ticket-tailor", "Ticket Tailor aggiornato.", async () => {
      const steps = [
        "/api/admin/ticket-tailor/sync-events",
        "/api/admin/ticket-tailor/sync-issued-tickets",
      ];

      for (const endpoint of steps) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "x-admin-sync-secret": secret.trim() },
        });
        const payload = await readJsonResponse(response);
        if (!response.ok || payload.ok === false) {
          throw new Error(readMessage(payload, "Errore aggiornamento Ticket Tailor."));
        }
      }
    });
  }

  async function runProfileSync() {
    await runAction("profiles", "Profili aggiornati.", async () => {
      const response = await fetch("/api/admin/ticket-tailor/sync-profiles", {
        method: "POST",
        headers: { "x-admin-sync-secret": secret.trim() },
      });
      const payload = await readJsonResponse(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(readMessage(payload, "Errore aggiornamento profili."));
      }
    });
  }

  async function runMembershipSync() {
    if (!secret.trim()) {
      setActionState({
        key: "memberships",
        ok: false,
        message: "Inserisci il codice admin.",
      });
      return;
    }

    setRunningAction("memberships");
    setActionState(null);

    const endpoints = [
      {
        label: "Form ITA/ENG",
        path: "/api/admin/association-members/sync-apply",
      },
      {
        label: "Libro Soci",
        path: "/api/admin/association-members/book-sync-apply",
      },
    ];

    try {
      const summaries: string[] = [];

      for (const endpoint of endpoints) {
        const response = await fetch(endpoint.path, {
          method: "POST",
          headers: { "x-admin-sync-secret": secret.trim() },
        });
        const payload = await readJsonResponse(response);

        if (!response.ok || payload.ok === false) {
          throw new Error(
            `${endpoint.label}: ${readMessage(
              payload,
              "Errore aggiornamento tesseramenti.",
            )}`,
          );
        }

        const created = readNumber(payload.created);
        const updated = readNumber(payload.updated);
        const unchanged = readNumber(payload.unchanged);
        const invalid = readNumber(payload.invalidRows);

        summaries.push(
          `${endpoint.label}: +${created}, aggiornati ${updated}, invariati ${unchanged}${
            invalid > 0 ? `, invalidi ${invalid}` : ""
          }`,
        );
      }

      setActionState({
        key: "memberships",
        ok: true,
        message: `Tesseramenti aggiornati. ${summaries.join(" · ")}`,
      });
      await loadDashboard();
    } catch (error) {
      setActionState({
        key: "memberships",
        ok: false,
        message: error instanceof Error ? error.message : "Errore sconosciuto.",
      });
    } finally {
      setRunningAction(null);
    }
  }

  async function runAction(
    key: ActionState["key"],
    successMessage: string,
    action: () => Promise<void>,
  ) {
    if (!secret.trim()) {
      setActionState({
        key,
        ok: false,
        message: "Inserisci il codice admin.",
      });
      return;
    }

    setRunningAction(key);
    setActionState(null);

    try {
      await action();
      setActionState({ key, ok: true, message: successMessage });
      await loadDashboard();
    } catch (error) {
      setActionState({
        key,
        ok: false,
        message: error instanceof Error ? error.message : "Errore sconosciuto.",
      });
    } finally {
      setRunningAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] px-4 py-6 text-[#211815] md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 border-b border-[#211815]/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/"
              className="text-sm font-semibold text-[#8b5e4a] transition hover:text-[#211815]"
            >
              ← Torna al sito
            </Link>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a]">
              Peony Studio
            </p>
            <h1 className="mt-2 font-serif text-4xl font-medium md:text-5xl">
              Admin
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f524c]">
              Prossimi eventi, partecipanti e aggiornamenti essenziali.
            </p>
          </div>

          <Link
            href="/admin/ticket-tailor/advanced"
            className="inline-flex w-fit rounded-full border border-[#211815]/20 px-5 py-2.5 text-sm font-semibold text-[#211815] transition hover:bg-white/55"
          >
            Gestione avanzata →
          </Link>
        </div>

        <section className="mt-6 rounded-[12px] border border-[#211815]/10 bg-white/55 p-4 shadow-[0_12px_34px_rgba(33,24,21,0.04)]">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,0.8fr)_repeat(3,minmax(190px,1fr))] lg:items-end">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
              Codice admin
              <input
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadDashboard();
                }}
                placeholder="Inserisci il codice"
                className="mt-2 w-full rounded-[9px] border border-[#211815]/15 bg-white px-3 py-2.5 text-sm normal-case tracking-normal outline-none focus:border-[#8b5e4a]"
              />
            </label>

            <ActionButton
              title="Aggiorna Ticket Tailor"
              text="Eventi, ticket e check-in"
              loading={runningAction === "ticket-tailor"}
              disabled={Boolean(runningAction)}
              onClick={runTicketTailorSync}
            />
            <ActionButton
              title="Aggiorna profili"
              text="Profili e iscrizioni agli eventi futuri"
              loading={runningAction === "profiles"}
              disabled={Boolean(runningAction)}
              onClick={runProfileSync}
            />
            <ActionButton
              title="Aggiorna tesseramenti"
              text="Google Form + libro soci"
              loading={runningAction === "memberships"}
              disabled={Boolean(runningAction)}
              onClick={runMembershipSync}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loadingDashboard}
              className="rounded-full bg-[#211815] px-5 py-2.5 text-sm font-semibold text-[#f4efe8] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingDashboard ? "Carico..." : "Carica dashboard"}
            </button>
            <p className="text-xs text-[#5f524c]">
              Dopo ogni aggiornamento la lista partecipanti viene ricaricata automaticamente.
            </p>
          </div>

          {actionState ? (
            <div
              className={`mt-4 rounded-[9px] border px-4 py-3 text-sm font-medium ${
                actionState.ok
                  ? "border-[#6f8f72]/35 bg-[#6f8f72]/10 text-[#416248]"
                  : "border-[#9d5d56]/35 bg-[#9d5d56]/10 text-[#844c46]"
              }`}
            >
              {actionState.message}
            </div>
          ) : null}

          {dashboardError ? (
            <div className="mt-4 rounded-[9px] border border-[#9d5d56]/35 bg-[#9d5d56]/10 px-4 py-3 text-sm font-medium text-[#844c46]">
              {dashboardError}
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Eventi futuri" value={summary.events} />
            <SummaryCard label="Partecipanti" value={summary.participants} />
            <SummaryCard
              label="Tesseramenti da sistemare"
              value={summary.membershipsToFix}
              tone={summary.membershipsToFix > 0 ? "warning" : "default"}
            />
            <SummaryCard
              label="Partner mancanti"
              value={summary.missingPartners}
              tone={summary.missingPartners > 0 ? "warning" : "default"}
            />
          </div>
        </section>

        <section className="mt-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                Operatività
              </p>
              <h2 className="mt-1 font-serif text-3xl font-medium">
                Prossimi eventi
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-[#5f524c]">
              <LegendDot status="valid" label="In regola" />
              <LegendDot status="payment_missing" label="Quota mancante" />
              <LegendDot status="missing_form" label="Modulo mancante" />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {events.length > 0 ? (
              events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  secret={secret.trim()}
                  onReload={loadDashboard}
                  onDetail={(participant) => setDetail({ event, participant })}
                />
              ))
            ) : (
              <div className="rounded-[12px] border border-[#211815]/10 bg-white/45 px-5 py-12 text-center text-sm text-[#5f524c]">
                {loadingDashboard
                  ? "Caricamento in corso..."
                  : "Inserisci il codice admin e carica la dashboard."}
              </div>
            )}
          </div>
        </section>
      </div>

      {detail ? (
        <ParticipantDetailModal
          detail={detail}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </main>
  );
}

function ActionButton({
  title,
  text,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  text: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-[10px] border border-[#211815]/12 bg-[#f4efe8]/70 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="block text-sm font-semibold text-[#211815]">
        {loading ? "Aggiornamento..." : title}
      </span>
      <span className="mt-1 block text-xs leading-5 text-[#5f524c]">{text}</span>
    </button>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-[11px] border p-4 ${
        tone === "warning"
          ? "border-[#b69755]/30 bg-[#b69755]/9"
          : "border-[#211815]/10 bg-white/45"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5f524c]">
        {label}
      </p>
      <p className="mt-2 font-serif text-4xl text-[#211815]">{value}</p>
    </div>
  );
}

function EventCard({
  event,
  secret,
  onReload,
  onDetail,
}: {
  event: FutureEvent;
  secret: string;
  onReload: () => Promise<void>;
  onDetail: (participant: ParticipantRow) => void;
}) {
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const warningMemberships = event.participants.filter(
    (participant) => participant.membership_status !== "valid",
  ).length;
  const missingPartners = event.participants.filter(
    (participant) => participant.partner_status === "missing",
  ).length;

  return (
    <article className="overflow-hidden rounded-[12px] border border-[#211815]/10 bg-white/50 shadow-[0_10px_26px_rgba(33,24,21,0.035)]">
      <div className="flex flex-col gap-3 border-b border-[#211815]/10 px-4 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
            {event.starts_at ? formatDateTime(event.starts_at) : "Data da verificare"}
          </p>
          <h3 className="mt-1 font-serif text-2xl text-[#211815]">
            {event.title ?? "Evento Peony Studio"}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[#5f524c]">
          <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1.5">
            {event.participants.length} partecipanti
          </span>
          {warningMemberships > 0 ? (
            <span className="rounded-full border border-[#b69755]/25 bg-[#b69755]/10 px-3 py-1.5 text-[#866d36]">
              {warningMemberships} tessere da sistemare
            </span>
          ) : null}
          {missingPartners > 0 ? (
            <span className="rounded-full border border-[#b69755]/25 bg-[#b69755]/10 px-3 py-1.5 text-[#866d36]">
              {missingPartners} partner mancanti
            </span>
          ) : null}
        </div>
      </div>

      {event.participants.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)_100px_155px_100px] gap-3 border-b border-[#211815]/10 bg-[#f4efe8]/65 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5f524c]">
              <span>Email</span>
              <span>Nome</span>
              <span>Cognome</span>
              <span>Tessera</span>
              <span>Partner</span>
              <span />
            </div>

            {event.participants.map((participant) => (
              <div
                key={participant.id}
                className="border-b border-[#211815]/8 last:border-b-0"
              >
                <div className="grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)_100px_155px_100px] items-center gap-3 px-4 py-3 text-sm text-[#211815]">
                  <span className="truncate" title={participant.email ?? ""}>
                    {participant.email ?? "-"}
                  </span>
                  <span>{participant.first_name ?? "-"}</span>
                  <span>{participant.last_name ?? "-"}</span>
                  <MembershipCell status={participant.membership_status} />
                  {participant.partner_status === "not_required" ? (
                    <span className="text-[#5f524c]">—</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPartnerId((current) =>
                          current === participant.id ? null : participant.id,
                        )
                      }
                      className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        participant.partner_status === "missing"
                          ? "border-[#b69755]/35 bg-[#b69755]/9 text-[#866d36]"
                          : "border-[#211815]/15 text-[#5f524c] hover:bg-[#f4efe8]"
                      }`}
                    >
                      {formatPartnerStatus(participant.partner_status)}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDetail(participant)}
                    className="rounded-full border border-[#211815]/18 px-3 py-1.5 text-xs font-semibold transition hover:bg-[#f4efe8]"
                  >
                    Dettagli
                  </button>
                </div>

                {expandedPartnerId === participant.id &&
                participant.partner_status !== "not_required" ? (
                  <PartnerExpandedRow
                    participant={participant}
                    secret={secret}
                    onSaved={onReload}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-4 py-7 text-sm text-[#5f524c]">
          Nessun partecipante registrato.
        </p>
      )}
    </article>
  );
}

function PartnerExpandedRow({
  participant,
  secret,
  onSaved,
}: {
  participant: ParticipantRow;
  secret: string;
  onSaved: () => Promise<void>;
}) {
  const initialName = splitPartnerName(participant.partner_name);
  const [email, setEmail] = useState(participant.partner_email ?? "");
  const [firstName, setFirstName] = useState(initialName.firstName);
  const [lastName, setLastName] = useState(initialName.lastName);
  const [editing, setEditing] = useState(participant.partner_status === "missing");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<MemberCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      participant.partner_status !== "missing" &&
      (participant.partner_email || participant.partner_name)
    ) {
      void lookupMember(
        participant.partner_email ?? "",
        initialName.firstName,
        initialName.lastName,
        true,
      );
    }
    // Run only when a different participant row is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant.id]);

  async function lookupMember(
    lookupEmail = email,
    lookupFirstName = firstName,
    lookupLastName = lastName,
    silent = false,
  ) {
    if (!secret) {
      setMessage("Inserisci il codice admin.");
      return;
    }

    const normalizedEmail = lookupEmail.trim();
    const normalizedFirstName = lookupFirstName.trim();
    const normalizedLastName = lookupLastName.trim();

    if (!normalizedEmail && !(normalizedFirstName && normalizedLastName)) {
      setMessage("Inserisci email oppure nome e cognome.");
      return;
    }

    setSearching(true);
    if (!silent) setMessage(null);

    const params = new URLSearchParams();
    if (normalizedEmail) {
      params.set("email", normalizedEmail);
    } else {
      params.set("first_name", normalizedFirstName);
      params.set("last_name", normalizedLastName);
    }

    try {
      const response = await fetch(
        `/api/admin/association-members/lookup?${params.toString()}`,
        { headers: { "x-admin-sync-secret": secret } },
      );
      const payload = await readJsonResponse(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(readMessage(payload, "Errore ricerca membro."));
      }

      const nextCandidates = Array.isArray(payload.candidates)
        ? (payload.candidates as MemberCandidate[])
        : [];
      setCandidates(nextCandidates);
      setSearched(true);

      if (!silent && nextCandidates.length === 0) {
        setMessage(
          "Nessun membro trovato. Puoi comunque salvare questi dati; il partner risulterà con modulo non trovato.",
        );
      }
    } catch (error) {
      setCandidates([]);
      setSearched(true);
      setMessage(error instanceof Error ? error.message : "Errore sconosciuto.");
    } finally {
      setSearching(false);
    }
  }

  function useCandidate(candidate: MemberCandidate) {
    setEmail(candidate.email ?? "");
    setFirstName(candidate.first_name ?? "");
    setLastName(candidate.last_name ?? "");
    setCandidates([candidate]);
    setMessage("Membro selezionato. Salva per associarlo come partner.");
  }

  async function savePartner() {
    if (!participant.enrollment_id) {
      setMessage(
        "Collegamento profilo non disponibile. Esegui prima “Aggiorna profili”.",
      );
      return;
    }

    if (!email.trim() && !(firstName.trim() && lastName.trim())) {
      setMessage("Inserisci email oppure nome e cognome.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/partner-enrollments/${participant.enrollment_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-sync-secret": secret,
          },
          body: JSON.stringify({
            partner_email: email.trim() || null,
            partner_name:
              [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
              null,
          }),
        },
      );
      const payload = await readJsonResponse(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(readMessage(payload, "Errore salvataggio partner."));
      }

      setEditing(false);
      setMessage("Partner salvato dallo staff.");
      await onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore sconosciuto.");
    } finally {
      setSaving(false);
    }
  }

  const displayedCandidate =
    candidates.length === 1 ? candidates[0] : null;
  const fallbackStatus: MembershipStatus = searched
    ? "missing_form"
    : "missing_form";

  return (
    <div className="ml-8 border-l-2 border-[#8b5e4a]/22 bg-[#f4efe8]/45 px-4 py-3 md:ml-12">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b5e4a]">
          Partner · {partnerSourceLabel(participant.partner_source)}
        </p>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-[#8b5e4a] hover:text-[#211815]"
          >
            Modifica / cerca
          </button>
        ) : null}
      </div>

      {!editing ? (
        <div className="mt-2 grid grid-cols-[minmax(220px,1.5fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)_minmax(180px,1fr)] items-center gap-3 rounded-[8px] border border-[#211815]/8 bg-white/45 px-3 py-2.5 text-sm">
          <span>{participant.partner_email ?? "-"}</span>
          <span>{initialName.firstName || "-"}</span>
          <span>{initialName.lastName || "-"}</span>
          <span className="inline-flex items-center gap-2">
            <Dot status={displayedCandidate?.membership_status ?? fallbackStatus} />
            <span className="text-xs font-semibold text-[#5f524c]">
              {displayedCandidate
                ? membershipLabel(displayedCandidate.membership_status)
                : searching
                  ? "Verifica..."
                  : "Modulo non trovato"}
            </span>
          </span>
        </div>
      ) : (
        <>
          <div className="mt-2 grid gap-2 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm outline-none focus:border-[#8b5e4a]"
            />
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Nome"
              className="rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm outline-none focus:border-[#8b5e4a]"
            />
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Cognome"
              className="rounded-[8px] border border-[#211815]/15 bg-white/75 px-3 py-2 text-sm outline-none focus:border-[#8b5e4a]"
            />
            <button
              type="button"
              onClick={() => void lookupMember()}
              disabled={searching}
              className="rounded-full border border-[#211815]/18 px-4 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {searching ? "Cerco..." : "Cerca membro"}
            </button>
          </div>

          {candidates.length > 0 ? (
            <div className="mt-3 space-y-2">
              {candidates.map((candidate, index) => (
                <div
                  key={`${candidate.email ?? "no-email"}-${candidate.first_name ?? ""}-${candidate.last_name ?? ""}-${index}`}
                  className="grid grid-cols-[minmax(220px,1.4fr)_minmax(200px,1fr)_minmax(180px,0.8fr)_auto] items-center gap-3 rounded-[8px] border border-[#211815]/10 bg-white/60 px-3 py-2.5 text-sm"
                >
                  <span>{candidate.email ?? "-"}</span>
                  <span>
                    {[candidate.first_name, candidate.last_name]
                      .filter(Boolean)
                      .join(" ") || "-"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Dot status={candidate.membership_status} />
                    <span className="text-xs font-semibold text-[#5f524c]">
                      {membershipLabel(candidate.membership_status)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => useCandidate(candidate)}
                    className="rounded-full border border-[#211815]/18 px-3 py-1.5 text-xs font-semibold"
                  >
                    Usa
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={savePartner}
              disabled={saving}
              className="rounded-full bg-[#211815] px-4 py-2 text-xs font-semibold text-[#f4efe8] disabled:opacity-50"
            >
              {saving ? "Salvo..." : "Salva partner"}
            </button>
            {participant.partner_source === "ticket_tailor" ? (
              <span className="text-xs text-[#5f524c]">
                Dato precompilato da Ticket Tailor: va confermato dallo staff.
              </span>
            ) : null}
          </div>
        </>
      )}

      {message ? (
        <p className="mt-2 text-xs leading-5 text-[#5f524c]">{message}</p>
      ) : null}
    </div>
  );
}

function splitPartnerName(value: string | null) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function partnerSourceLabel(source: string | null) {
  if (source === "user") return "inserito dall’utente";
  if (source === "admin") return "inserito dallo staff";
  if (source === "ticket_tailor") return "dato Ticket Tailor da confermare";
  return "da inserire";
}

function LegendDot({
  status,
  label,
}: {
  status: MembershipStatus;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Dot status={status} />
      {label}
    </span>
  );
}

function MembershipCell({ status }: { status: MembershipStatus }) {
  const shortLabel =
    status === "valid" ? "OK" : status === "payment_missing" ? "Quota" : "Modulo";

  return (
    <span
      className="inline-flex items-center gap-2 text-xs font-semibold text-[#5f524c]"
      title={membershipLabel(status)}
    >
      <Dot status={status} />
      {shortLabel}
    </span>
  );
}

function Dot({ status }: { status: MembershipStatus }) {
  const className =
    status === "valid"
      ? "bg-[#6f8f72]"
      : status === "payment_missing"
        ? "bg-[#b69755]"
        : "bg-[#9d5d56]";

  return <span className={`h-3 w-3 shrink-0 rounded-full ${className}`} />;
}

function ParticipantDetailModal({
  detail,
  onClose,
}: {
  detail: ParticipantDetail;
  onClose: () => void;
}) {
  const { event, participant } = detail;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#211815]/55 p-4">
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-[12px] border border-[#211815]/10 bg-[#f4efe8] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#211815]/10 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
              Dettaglio partecipante
            </p>
            <h3 className="mt-2 font-serif text-3xl">
              {participant.first_name ?? "-"} {participant.last_name ?? "-"}
            </h3>
            <p className="mt-1 text-sm text-[#5f524c]">{participant.email ?? "-"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#211815]/15 px-3 py-1.5 text-sm"
          >
            Chiudi
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailField label="Evento" value={event.title ?? "Evento Peony Studio"} />
          <DetailField
            label="Data"
            value={event.starts_at ? formatDateTime(event.starts_at) : "-"}
          />
          <DetailField
            label="Tesseramento"
            value={membershipLabel(participant.membership_status)}
          />
          <DetailField
            label="Partner"
            value={formatPartnerStatus(participant.partner_status)}
          />
          <DetailField
            label="Tipo biglietto"
            value={participant.ticket_type_name ?? "-"}
          />
          <DetailField
            label="Ordine Ticket Tailor"
            value={participant.ticket_tailor_order_id ?? "-"}
          />
        </div>

        {participant.partner_status === "user_provided" ||
        participant.partner_status === "admin_provided" ? (
          <div className="mt-4 rounded-[9px] border border-[#211815]/10 bg-white/50 p-3 text-sm text-[#5f524c]">
            <span className="font-semibold text-[#211815]">Partner indicato:</span>{" "}
            {participant.partner_name ??
              participant.partner_email ??
              "confermato nell’area personale"}
          </div>
        ) : null}

        <div className="mt-5 border-t border-[#211815]/10 pt-4">
          <Link
            href="/admin/ticket-tailor/advanced"
            className="text-sm font-semibold text-[#8b5e4a] hover:text-[#211815]"
          >
            Apri strumenti avanzati →
          </Link>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[9px] border border-[#211815]/10 bg-white/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b5e4a]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

async function readJsonResponse(response: Response) {
  const raw = await response.text();

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Il server non ha restituito una risposta valida (HTTP ${response.status}). Probabile timeout o errore server.`,
    );
  }
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readMessage(payload: Record<string, unknown>, fallback: string) {
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors.map((error) => String(error)).slice(0, 3).join(" · ");
  }

  return fallback;
}

function membershipLabel(status: MembershipStatus) {
  if (status === "valid") return "Tesseramento in regola";
  if (status === "payment_missing") {
    return "Modulo presente, quota non registrata dal 01/09/2025";
  }
  return "Modulo associativo non trovato";
}

function formatPartnerStatus(status: PartnerStatus) {
  if (status === "user_provided") return "Partner · utente";
  if (status === "admin_provided") return "Partner · staff";
  if (status === "missing") return "Partner · da inserire";
  return "—";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
