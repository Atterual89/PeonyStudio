"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import {
  confirmMatchAction,
  matchSuggestionsAction,
  rejectMatchAction,
  resolveMatchAction,
  type MatchSuggestions,
} from "@/app/gestione/(app)/w/actions";
import { formatDate } from "@/lib/gestionale/format";
import { PARTY_LABELS, insertedByLabel } from "@/lib/gestionale/labels";
import type { BookingPersonView, BookingView } from "@/lib/gestionale/types";

import { useFlash } from "./Flash";
import { MembershipBadge } from "./MembershipBadge";
import { InlineConfirm, Notice, buttonClass } from "./ui";

/** Proposte per una riga "da abbinare": gestionale e libro soci, esatte prima. */
function Suggestions({
  workshopId,
  entry,
  onPick,
  pending,
}: {
  workshopId: string;
  entry: BookingPersonView;
  onPick: (action: "collega" | "collega_socio" | "unisci", targetId: string, label: string) => void;
  pending: boolean;
}) {
  const [data, setData] = useState<MatchSuggestions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    matchSuggestionsAction({ workshopId, text: entry.enteredAs ?? entry.displayName, excludePersonId: entry.person.id }).then((result) => {
      if (!active) return;
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [workshopId, entry.enteredAs, entry.displayName, entry.person.id]);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-sm text-[#5f524c]">Cerco corrispondenze…</p>;
  if (data.people.length === 0 && data.members.length === 0) {
    return <p className="text-sm text-[#5f524c]">Nessuna corrispondenza, nemmeno parziale.</p>;
  }

  return (
    <div className="space-y-3">
      {data.people.length > 0 ? (
        <ul className="space-y-2">
          {data.people.map((person) => (
            <li key={person.id} className="rounded-xl border border-[#211815]/10 bg-white p-3">
              <p className="flex flex-wrap items-center gap-2">
                <Link prefetch={false} href={`/gestione/p/${person.id}`} className="font-semibold underline">
                  {person.displayName}
                </Link>
                <MembershipBadge badge={person.badge} />
                {person.exact ? <span className="text-xs font-semibold text-[#2f5d3b]">corrispondenza esatta</span> : null}
                {person.enrolled ? <span className="text-xs font-semibold text-[#9b2c2c]">già iscritta</span> : null}
              </p>
              {person.detail ? <p className="text-sm text-[#5f524c]">{person.detail}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass.secondary}
                  disabled={pending || person.enrolled}
                  onClick={() => onPick("collega", person.id, person.displayName)}
                >
                  Abbina
                </button>
                <button
                  type="button"
                  className={buttonClass.ghost}
                  disabled={pending || person.enrolled}
                  onClick={() => onPick("unisci", person.id, person.displayName)}
                >
                  Unisci
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {data.members.length > 0 ? (
        <div>
          <p className="mb-1 text-sm font-medium text-[#5f524c]">Dal libro soci</p>
          <ul className="space-y-2">
            {data.members.map((member) => {
              const name = [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email || "Socio";
              return (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#211815]/10 bg-white p-3">
                  <span>
                    <span className="font-semibold">{name}</span>
                    {member.exact ? <span className="ml-2 text-xs font-semibold text-[#2f5d3b]">corrispondenza esatta</span> : null}
                    <span className="block text-sm text-[#5f524c]">
                      {[member.email, member.expires_at ? `scadenza ${formatDate(member.expires_at)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <button type="button" className={buttonClass.secondary} disabled={pending} onClick={() => onPick("collega_socio", member.id, name)}>
                    Collega
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * D20, solo admin: "Scritto da Ale: …" e azioni sull'abbinamento automatico.
 * automatico → Conferma / Non è questa persona; da abbinare → proposte +
 * Crea nuova / Collega / Unisci. 017: compare solo per le persone non
 * collegate al libro soci e senza email (lo decide BookingDetails).
 */
export function MatchPanel({ booking, workshopId, entry }: { booking: BookingView; workshopId: string; entry: BookingPersonView }) {
  const [pending, startTransition] = useTransition();
  // 4e (#16): conferme sul posto, niente finestre del browser.
  const [asking, setAsking] = useState<
    { kind: "rifiuta" } | { kind: "scegli"; action: "collega" | "collega_socio" | "unisci"; targetId: string; label: string } | null
  >(null);
  const flash = useFlash(entry.person.id);
  const ref = { bookingId: booking.bookingId, version: booking.version, participantId: entry.participantId };

  if (!entry.enteredAs && entry.matchStatus === "confermato" && !entry.possibleDuplicate) return null;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    flash.clear();
    startTransition(async () => {
      flash.result(await action(), success);
      setAsking(null);
    });
  }

  return (
    <div className="space-y-2 rounded-xl bg-[#f2ede3] p-3 text-sm">
      {entry.enteredAs ? (
        <p>
          {insertedByLabel(booking.createdBy?.role ?? null)} ·{" "}
          {booking.createdBy?.role === "organizzatrice" ? "scritto" : `${PARTY_LABELS.redsabbath} vede`}:{" "}
          <strong>{entry.enteredAs}</strong>
        </p>
      ) : null}
      {entry.possibleDuplicate ? (
        <Notice tone="warning">
          Possibile doppia iscrizione: il testo corrisponde a{" "}
          <Link prefetch={false} href={`/gestione/p/${entry.possibleDuplicate.id}`} className="underline">
            {entry.possibleDuplicate.displayName}
          </Link>
          , già iscritta a questo workshop.
        </Notice>
      ) : null}

      {entry.matchStatus === "automatico" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass.secondary} disabled={pending} onClick={() => run(() => confirmMatchAction(ref), "Abbinamento confermato.")}>
            È questa persona
          </button>
          <button type="button" className={buttonClass.ghost} disabled={pending} onClick={() => setAsking({ kind: "rifiuta" })}>
            Non è questa persona
          </button>
        </div>
      ) : null}
      {asking?.kind === "rifiuta" ? (
        <InlineConfirm
          question={`Togliere l'abbinamento con ${entry.displayName}? La riga tornerà "da abbinare".`}
          pending={pending}
          onConfirm={() => run(() => rejectMatchAction(ref), "Abbinamento tolto: ora è da abbinare.")}
          onCancel={() => setAsking(null)}
        />
      ) : null}

      {entry.matchStatus === "da_abbinare" ? (
        <div className="space-y-3">
          <Suggestions
            workshopId={workshopId}
            entry={entry}
            pending={pending}
            onPick={(action, targetId, label) => setAsking({ kind: "scegli", action, targetId, label })}
          />
          {asking?.kind === "scegli" ? (
            <InlineConfirm
              question={
                asking.action === "unisci"
                  ? `Unire la persona creata dal testo a ${asking.label}?`
                  : asking.action === "collega_socio"
                    ? `Collegare al socio ${asking.label} del libro soci?`
                    : `Abbinare a ${asking.label}?`
              }
              pending={pending}
              onConfirm={() => {
                const { action, targetId } = asking;
                run(
                  () => resolveMatchAction({ ...ref, action, targetId }),
                  action === "unisci" ? "Unita." : action === "collega_socio" ? "Collegata al libro soci." : "Abbinata.",
                );
              }}
              onCancel={() => setAsking(null)}
            />
          ) : null}
          <button
            type="button"
            className={buttonClass.secondary}
            disabled={pending}
            onClick={() => run(() => resolveMatchAction({ ...ref, action: "crea_nuova", targetId: null }), "Confermata come persona nuova.")}
          >
            Crea nuova: {entry.displayName}
          </button>
        </div>
      ) : null}
    </div>
  );
}
