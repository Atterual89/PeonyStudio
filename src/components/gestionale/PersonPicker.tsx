"use client";

import { BookUser, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { quickSearchAction, type QuickSearchMember, type QuickSearchPerson } from "@/app/gestione/(app)/w/actions";
import { formatDate } from "@/lib/gestionale/format";
import type { PersonChoice } from "@/lib/gestionale/person-choice";

import { MembershipBadge } from "./MembershipBadge";
import { inputClass } from "./ui";

const DEBOUNCE_MS = 250;

function memberName(member: QuickSearchMember) {
  return [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email || "Socio";
}

/** Scheda compatta della persona scelta, con il badge socio. */
function ChosenCard({ choice, caption, onClear }: { choice: PersonChoice; caption?: string; onClear: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-[#a8583e]/40 bg-[#a8583e]/5 px-3 py-2">
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">
          {choice.label}
          {caption ? <span className="ml-2 text-sm font-normal text-[#5f524c]">{caption}</span> : null}
        </p>
        {choice.detail ? <p className="truncate text-sm text-[#5f524c]">{choice.detail}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {choice.badge ? <MembershipBadge badge={choice.badge} /> : null}
          {choice.kind !== "existing" ? (
            <span className="text-xs font-semibold text-[#5f524c]">
              {choice.kind === "member" ? "Nuova scheda dal libro soci" : "Nuova persona"}
            </span>
          ) : null}
        </div>
      </div>
      <button type="button" onClick={onClear} className="grid h-10 w-10 shrink-0 place-items-center" aria-label="Cambia persona">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Ricerca persona: persone del gestionale, poi "Dal libro soci", poi "Crea
 * nuova". Le persone già iscritte al workshop sono visibili ma non selezionabili.
 */
export function PersonPicker({
  workshopId,
  label,
  value,
  onChange,
  caption,
  excludePersonIds = [],
}: {
  workshopId: string;
  label: string;
  value: PersonChoice | null;
  onChange: (choice: PersonChoice | null) => void;
  /** Etichetta accanto al nome scelto, es. "partner di Claudia". */
  caption?: string;
  excludePersonIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ people: QuickSearchPerson[]; members: QuickSearchMember[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await quickSearchAction({ workshopId, query: trimmed });
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setResults(result.data);
        setError(null);
      } else {
        setError(result.error);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, workshopId]);

  function choose(choice: PersonChoice) {
    onChange(choice);
    setQuery("");
    setResults(null);
  }

  if (value) {
    return (
      <div>
        <span className="mb-1 block text-sm font-medium text-[#5f524c]">{label}</span>
        <ChosenCard choice={value} caption={caption} onClear={() => onChange(null)} />
      </div>
    );
  }

  const people = (results?.people ?? []).filter((person) => !excludePersonIds.includes(person.id));
  const showResults = trimmed.length >= 2 && results !== null;

  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-[#5f524c]">{label}</span>
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nickname, email, nome o cognome"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      {loading && trimmed.length >= 2 ? <p className="mt-2 text-sm text-[#5f524c]">Ricerca…</p> : null}
      {error ? <p className="mt-2 text-sm font-medium text-[#9b2c2c]">{error}</p> : null}

      {showResults ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#211815]/10 bg-white">
          {people.length > 0 ? (
            <ul>
              {people.map((person) => (
                <li key={person.id} className="border-b border-[#211815]/5 last:border-0">
                  <button
                    type="button"
                    disabled={person.enrolled}
                    onClick={() =>
                      choose({ kind: "existing", id: person.id, label: person.displayName, detail: person.detail, badge: person.badge })
                    }
                    className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{person.displayName}</span>
                      <span className="block truncate text-sm text-[#5f524c]">
                        {person.enrolled ? "Già iscritta a questo workshop" : person.detail || "Email mancante"}
                      </span>
                    </span>
                    <MembershipBadge badge={person.badge} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {results.members.length > 0 ? (
            <>
              <p className="flex items-center gap-2 bg-[#f2ede3] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#5f524c]">
                <BookUser className="h-4 w-4" aria-hidden="true" />
                Dal libro soci
              </p>
              <ul>
                {results.members.map((member) => {
                  const detail = [member.email, member.expires_at ? `scadenza ${formatDate(member.expires_at)}` : null]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={member.id} className="border-b border-[#211815]/5 last:border-0">
                      <button
                        type="button"
                        onClick={() =>
                          choose({ kind: "member", memberId: member.id, label: memberName(member), detail, badge: member.badge })
                        }
                        className="flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold">{memberName(member)}</span>
                          <span className="block truncate text-sm text-[#5f524c]">{detail}</span>
                        </span>
                        <MembershipBadge badge={member.badge} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          <button
            type="button"
            onClick={() =>
              choose({ kind: "new", text: trimmed, label: trimmed, badge: { kind: "non_collegata" } })
            }
            className="flex min-h-10 w-full items-center gap-2 border-t border-[#211815]/10 px-3 text-left font-semibold text-[#a8583e]"
          >
            <UserPlus className="h-5 w-5" aria-hidden="true" />
            Crea nuova: “{trimmed}”
          </button>
        </div>
      ) : null}
    </div>
  );
}
