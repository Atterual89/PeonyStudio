"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFormQuotaPaidAction } from "@/app/gestione/(app)/p/membership-actions";
import type { SociReviewRow } from "@/lib/gestionale/server/soci";

export function SociReviewList({ rows }: { rows: SociReviewRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [showAll, setShowAll] = useState(false);
  const [busy, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const found = rows.filter((row) =>
    (tab === "all" || !row.paid) &&
    [row.name, row.email].some((value) => value?.toLowerCase().includes(filter.trim().toLowerCase())),
  );
  const visible = filter || showAll ? found : found.slice(0, 20);

  function updateQuota(row: SociReviewRow, paid: boolean) {
    setError(null);
    setBusyId(row.formMemberId);
    startTransition(async () => {
      try {
        const result = await setFormQuotaPaidAction(row.formMemberId, paid);
        if (!result.ok) setError(`${row.name}: ${result.error}`);
        else router.refresh();
      } catch {
        setError(`${row.name}: aggiornamento non riuscito.`);
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="soci-stato-filter" className="text-xs text-[#5f524c]">Visualizza</label>
        <select id="soci-stato-filter" value={tab}
          onChange={(event) => { setTab(event.target.value as "pending" | "all"); setShowAll(false); }}
          className="min-h-10 flex-1 rounded-xl border border-[#211815]/15 bg-white px-3 text-sm">
          <option value="pending">Da pagare ({rows.filter((row) => !row.paid).length})</option>
          <option value="all">Tutte ({rows.length})</option>
        </select>
      </div>
      <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)}
        placeholder="Cerca nome o email" aria-label="Cerca domande associative"
        className="h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm" />
      {error ? <p role="alert" className="rounded-lg bg-[#f3e8d4] p-2 text-sm text-[#733a18]">{error}</p> : null}
      <ul className="divide-y divide-[#211815]/10 rounded-xl border border-[#211815]/10 bg-white/80">
        {visible.map((row) => {
          const lockedByBook = row.paid && row.paidSource === "book";
          return (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{row.name}</span>
                {row.email ? <span className="block break-all text-xs text-[#5f524c]">{row.email}</span> : null}
                {row.personId ? <a className="text-xs text-[#a8583e] underline" href={`/gestione/p/${row.personId}`}>Scheda</a> : null}
              </span>
              <label className="flex min-h-10 items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={row.paid}
                  disabled={busy || lockedByBook}
                  onChange={(event) => updateQuota(row, event.target.checked)}
                  aria-label={`Quota pagata: ${row.name}`}
                  className="h-5 w-5 accent-[#a8583e]" />
                <span>{busyId === row.formMemberId ? "Salvataggio…" : lockedByBook ? "Pagata (Team Artist)" : "Quota pagata"}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 ? <p className="text-sm text-[#5f524c]">Nessuna domanda in questa vista.</p> : null}
      {!filter && !showAll && found.length > visible.length ? (
        <button type="button" onClick={() => setShowAll(true)}
          className="h-10 rounded-xl border border-[#211815]/20 bg-white px-3 text-sm font-semibold text-[#a8583e]">
          Mostra tutte ({found.length})
        </button>
      ) : null}
      <p className="text-xs text-[#5f524c]">Il flag registra la quota nel gestionale, anche senza una scheda partecipante. Le quote già presenti nell'export Team Artist non si modificano qui.</p>
    </div>
  );
}
