"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { globalSearchAction, type SearchResult } from "@/app/gestione/(app)/cerca/actions";
import { formatDate } from "@/lib/gestionale/format";

import { cardClass, inputClass } from "./ui";

const DEBOUNCE_MS = 250;
const MIN_LENGTH = 2;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await globalSearchAction(trimmed);
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
  }, [trimmed]);

  const visible = trimmed.length >= MIN_LENGTH ? results : null;

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Cerca</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5f524c]" aria-hidden="true" />
        <input
          type="search"
          autoFocus
          className={`${inputClass} pl-10`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome, cognome, nickname, email, instagram"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      {trimmed.length > 0 && trimmed.length < MIN_LENGTH ? (
        <p className="mt-3 text-sm text-[#5f524c]">Scrivi almeno {MIN_LENGTH} caratteri.</p>
      ) : null}
      {loading && trimmed.length >= MIN_LENGTH ? <p className="mt-3 text-sm text-[#5f524c]">Ricerca…</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-[#9b2c2c]">{error}</p> : null}

      {visible ? (
        visible.length === 0 ? (
          <p className="mt-3 text-sm text-[#5f524c]">Nessun risultato.</p>
        ) : (
          <ul className={`${cardClass} mt-4 divide-y divide-[#211815]/5`}>
            {visible.map((person) => (
              <li key={person.id}>
                <Link prefetch={false} href={`/gestione/p/${person.id}`} className="block px-3 py-2">
                  <span className="block font-semibold">
                    {person.displayName}
                    {person.fullName && person.fullName !== person.displayName ? (
                      <span className="ml-2 font-normal text-[#5f524c]">{person.fullName}</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-sm text-[#5f524c]">
                    {[person.email ?? "Email mancante", person.instagram].filter(Boolean).join(" · ")}
                  </span>
                  {person.workshops.length > 0 ? (
                    <span className="mt-1 block text-sm">
                      {person.workshops.map((w) => `${w.name} (${formatDate(w.startsOn)})`).join(" · ")}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
