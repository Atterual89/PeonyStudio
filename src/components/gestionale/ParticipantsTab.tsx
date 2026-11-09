"use client";

import { ArrowDownUp, ChevronDown, Mail } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import {
  BOOKING_FILTERS,
  bookingTitle,
  matchesBookingFilter,
  personNames,
  membershipSummary,
  worstMembershipRank,
  type BookingFilter,
} from "@/lib/gestionale/bookings";
import { contactShortLabel, lastContact, peopleInGroup, type ContactGroup } from "@/lib/gestionale/contacts";
import { BOOKING_STATUS_LABELS, UI_LABELS, isConfirmed } from "@/lib/gestionale/labels";
import { canMarkPresent } from "@/lib/gestionale/presence";
import type { BookingView } from "@/lib/gestionale/types";

import { BookingDetails } from "./BookingDetails";
import { DeleteBookingConfirm } from "./Deletion";
import { ExactMatches } from "./ExactMatches";
import { MembershipBadge } from "./MembershipBadge";
import { AssociationDotLegend } from "./AssociationStatusDot";
import { PresentToggle } from "./PresentToggle";
import { QuickAdd } from "./QuickAdd";
import { Chip, RowMenu, cardClass } from "./ui";
import { useIsDesktop } from "./useIsDesktop";

type SortKey = "nome" | "socio" | "stato";

function isContactGroup(filter: BookingFilter): filter is ContactGroup {
  return filter === "da_contattare" || filter === "richiesta_inviata" || filter === "da_verificare";
}

const STATUS_ORDER = Object.keys(BOOKING_STATUS_LABELS);

function sortValue(booking: BookingView, key: SortKey): string | number {
  switch (key) {
    case "nome":
      return bookingTitle(booking).toLowerCase();
    case "socio":
      return worstMembershipRank(booking);
    case "stato":
      return STATUS_ORDER.indexOf(booking.status);
  }
}

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-3 py-2 text-left">
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex min-h-10 items-center gap-1 font-semibold">
        {label}
        <ArrowDownUp className={`h-4 w-4 ${current === sortKey ? "text-[#a8583e]" : "text-[#5f524c]/50"}`} aria-hidden="true" />
      </button>
    </th>
  );
}

/** Persone dell'iscrizione, ognuna con badge socio ed eventuale "email mancante". */
function PeopleLines({ booking }: { booking: BookingView }) {
  return (
    <span className="block space-y-1">
      {booking.people.map((entry) => (
        <span key={entry.participantId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <MembershipBadge badge={entry.membership} compact />
          <span className="font-medium">{personNames(entry).main}</span>
          {personNames(entry).alias ? <span className="text-xs text-[#5f524c]">{personNames(entry).alias}</span> : null}
          {entry.person.email ? null : <span className="font-medium text-[#9b2c2c]">{UI_LABELS.missingEmail.toLowerCase()}</span>}
          {entry.possibleDuplicate ? <span className="text-xs font-semibold text-[#7a5212]">possibile doppia iscrizione</span> : null}
          {entry.membership.kind !== "in_regola" && lastContact(entry.contacts) ? (
            <span className="inline-flex items-center gap-1 text-xs text-[#5f524c]">
              <Mail className="h-3.5 w-3.5" aria-label="Richiesta di associazione" />
              {contactShortLabel(lastContact(entry.contacts)!)}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

function StatusTag({ booking }: { booking: BookingView }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isConfirmed(booking.status) ? "bg-[#a8583e]/10 text-[#a8583e]" : "bg-[#211815]/5 text-[#5f524c]"
      }`}
    >
      {BOOKING_STATUS_LABELS[booking.status]}
    </span>
  );
}

export function ParticipantsTab({
  workshopId,
  workshopStartsOn,
  today,
  showPresence = false,
  bookings,
}: {
  workshopId: string;
  workshopStartsOn: string;
  today: string;
  /** D27: spunta "Presente" sulla riga, dal giorno di inizio. */
  showPresence?: boolean;
  bookings: BookingView[];
}) {
  const [filter, setFilter] = useState<BookingFilter>("confermati");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "nome", asc: true });
  // D26: nei gruppi delle richieste contano le iscrizioni confermate; a richiesta anche gli interessati.
  const [includeInterested, setIncludeInterested] = useState(false);
  const scope = { includeInterested };
  const isDesktop = useIsDesktop();

  const summary = membershipSummary(bookings);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it");
    const rows = bookings.filter((b) => matchesBookingFilter(b, filter, { includeInterested }) && (
      !normalizedQuery || [bookingTitle(b), ...b.people.flatMap((p) => [p.displayName, p.fullName ?? "", p.person.nickname ?? "", p.person.email ?? ""])]
        .some((value) => value.toLocaleLowerCase("it").includes(normalizedQuery))
    ));
    return rows.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = av < bv ? -1 : av > bv ? 1 : bookingTitle(a).localeCompare(bookingTitle(b));
      return sort.asc ? cmp : -cmp;
    });
  }, [bookings, filter, sort, includeInterested, query]);
  const notLinked = new Set(bookings.flatMap((b) => b.people).filter((p) => p.membership.kind === "non_collegata").map((p) => p.person.id)).size;

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  // D22: menu "…" della riga e conferma sul posto.
  const rowMenu = (booking: BookingView) => (
    <RowMenu
      label="Altre azioni sull'iscrizione"
      items={[{ label: "Elimina iscrizione", danger: true, onClick: () => setDeletingId(booking.bookingId) }]}
    />
  );
  const deleteConfirm = (booking: BookingView) => (
    <DeleteBookingConfirm booking={booking} name={bookingTitle(booking)} onClose={() => setDeletingId(null)} />
  );

  const headerProps = {
    current: sort.key,
    onSort: (key: SortKey) => setSort((current) => ({ key, asc: current.key === key ? !current.asc : true })),
  };

  return (
    <div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Riepilogo soci dei confermati">
        <span><strong>{summary.soci}</strong> in regola</span>
        <span><strong>{summary.quotaMancante}</strong> quota non registrata</span>
        <span><strong>{summary.nonSoci}</strong> modulo non trovato</span>
        <span><strong>{summary.nonCollegati}</strong> non collegate</span>
        <span><strong>{summary.emailMancanti}</strong> email mancanti</span>
        <span className="text-[#5f524c]">su {summary.persone} {summary.persone === 1 ? "persona" : "persone"}</span>
      </p>
      <div className="mt-2">
        <AssociationDotLegend/>
      </div>
      <ExactMatches workshopId={workshopId} notLinked={notLinked} />

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-[#5f524c]">
          Cerca partecipante
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, nickname o email"
            className="mt-1 h-10 w-full rounded-lg border border-[#211815]/15 bg-white px-3 text-[15px] text-[#211815] focus:border-[#a8583e] focus:outline-none focus:ring-2 focus:ring-[#a8583e]/20"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Viste principali">
          {([
            { key: "confermati", label: "Confermati" },
            { key: "interessati", label: "Interessati" },
            { key: "non_soci", label: "Da verificare" },
          ] as const).map(({ key, label }) => (
            <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>
              {label} ({bookings.filter((b) => matchesBookingFilter(b, key)).length})
            </Chip>
          ))}
        </div>
        <details key={["confermati", "interessati", "non_soci"].includes(filter) ? "main" : "extra"} className="rounded-lg border border-[#211815]/10 bg-white/70 p-2" open={!["confermati", "interessati", "non_soci"].includes(filter)}>
          <summary className="min-h-10 cursor-pointer px-2 py-2 text-sm font-semibold text-[#5f524c]">
            Altri filtri {["confermati", "interessati", "non_soci"].includes(filter) ? "" : "· filtro attivo"}
          </summary>
          <div className="flex flex-wrap gap-2 px-2 pb-2">
            {BOOKING_FILTERS.filter(({ key }) => !["confermati", "interessati", "non_soci"].includes(key)).map(({ key, label }) => (
              <Chip key={key} active={filter === key} onClick={() => setFilter(key)}>
                {label} ({isContactGroup(key) ? `${peopleInGroup(bookings, key, scope).length} pers.` : bookings.filter((b) => matchesBookingFilter(b, key)).length})
              </Chip>
            ))}
          </div>
        </details>
      </div>
      {isContactGroup(filter) ? (
        <div className="mt-3 rounded-lg bg-[#f2ede3] p-3 text-sm text-[#5f524c]">
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-[#a8583e]" checked={includeInterested} onChange={(e) => setIncludeInterested(e.target.checked)} />
            Includi interessati nel filtro
          </label>
          <p className="mt-1">Le comunicazioni e le conferme d’invio si gestiscono nel tab Email.</p>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-[#5f524c]">{query.trim() ? "Nessun risultato per questa ricerca." : "Nessuna iscrizione in questo elenco."}</p>
      ) : !isDesktop ? (
        /* Mobile e tablet: una riga per iscrizione, si apre sul posto. */
        <ul className="mt-4 space-y-2">
          {visible.map((booking) => {
            const open = openId === booking.bookingId;
            return (
              <li key={booking.bookingId} className={cardClass}>
                <div className="flex items-start">
                  <button
                    type="button"
                    onClick={() => toggle(booking.bookingId)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-start justify-between gap-3 p-3 pr-1 text-left"
                  >
                    <span className="min-w-0 space-y-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{bookingTitle(booking)}</span>
                        <StatusTag booking={booking} />
                      </span>
                      <PeopleLines booking={booking} />
                    </span>
                    <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-[#5f524c] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  <div className="p-2">{rowMenu(booking)}</div>
                </div>
                {showPresence && canMarkPresent(booking.status) ? (
                  <div className="border-t border-[#211815]/5 px-3">
                    <PresentToggle booking={booking} name={bookingTitle(booking)} />
                  </div>
                ) : null}
                {deletingId === booking.bookingId ? <div className="px-3 pb-3">{deleteConfirm(booking)}</div> : null}
                {open ? <BookingDetails booking={booking} workshopId={workshopId} workshopStartsOn={workshopStartsOn} today={today} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        /* Desktop: tabella ordinabile. */
        <div className={`${cardClass} mt-4 overflow-hidden`}>
          <table className="w-full text-sm">
            <thead className="border-b border-[#211815]/10 bg-[#f2ede3]/60 text-[#5f524c]">
              <tr>
                <SortHeader label="Iscrizione" sortKey="nome" {...headerProps} />
                <SortHeader label="Persone e soci" sortKey="socio" {...headerProps} />
                <SortHeader label="Stato" sortKey="stato" {...headerProps} />
                {showPresence ? <th className="px-3 py-2 text-left font-semibold">Presente</th> : null}
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {visible.map((booking) => {
                const open = openId === booking.bookingId;
                return (
                  <Fragment key={booking.bookingId}>
                    <tr
                      onClick={() => toggle(booking.bookingId)}
                      className={`cursor-pointer border-b border-[#211815]/5 align-top hover:bg-white ${open ? "bg-white" : ""}`}
                      aria-expanded={open}
                    >
                      <td className="px-3 py-2 font-semibold">{bookingTitle(booking)}</td>
                      <td className="px-3 py-2">
                        <PeopleLines booking={booking} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusTag booking={booking} />
                      </td>
                      {showPresence ? (
                        <td className="px-3 py-0" onClick={(e) => e.stopPropagation()}>
                          {canMarkPresent(booking.status) ? <PresentToggle booking={booking} name={bookingTitle(booking)} compact /> : null}
                        </td>
                      ) : null}
                      <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                        {rowMenu(booking)}
                      </td>
                    </tr>
                    {deletingId === booking.bookingId ? (
                      <tr>
                        <td colSpan={showPresence ? 5 : 4} className="bg-white px-3 py-2">
                          <div className="max-w-2xl">{deleteConfirm(booking)}</div>
                        </td>
                      </tr>
                    ) : null}
                    {open ? (
                      <tr>
                        <td colSpan={showPresence ? 5 : 4} className="bg-white">
                          <div className="max-w-2xl">
                            <BookingDetails booking={booking} workshopId={workshopId} workshopStartsOn={workshopStartsOn} today={today} />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <QuickAdd workshopId={workshopId} />
    </div>
  );
}
