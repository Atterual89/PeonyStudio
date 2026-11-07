"use client";

import { useState } from "react";
import type { SociReviewRow } from "@/lib/gestionale/server/soci";

export function SociReviewList({ rows }: { rows: SociReviewRow[] }) {
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const found = rows.filter((row) =>
    [row.name, row.email].some((text) => text?.toLowerCase().includes(filter.trim().toLowerCase())),
  );
  const visible = filter || showAll ? found : found.slice(0, 20);

  return (
    <div className="mt-3 space-y-2">
      <input
        type="search"
        value={filter}
        onChange={(value) => setFilter(value.target.value)}
        placeholder="Cerca nome o email"
        aria-label="Cerca domande associative"
        className="h-10 w-full rounded-xl border border-[#211815]/15 bg-white px-3 text-sm"
      />
      <p className="text-xs text-[#5f524c]">
        Domande senza conferma nei dati associativi salvati. Verifica in TeamArtist prima di sollecitare il pagamento.
      </p>
      <ul className="divide-y divide-[#211815]/10 rounded-xl border border-[#211815]/10 bg-white/80">
        {visible.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 p-3 text-sm">
            <span className="min-w-0">
              <span className="block font-semibold">{row.name}</span>
              {row.email ? <span className="block break-all text-xs text-[#5f524c]">{row.email}</span> : null}
            </span>
            {row.personId ? (
              <a className="text-xs font-semibold text-[#a8583e] underline" href={`/gestione/p/${row.personId}`}>
                Scheda
              </a>
            ) : <span className="text-xs text-[#5f524c]">Da verificare</span>}
          </li>
        ))}
      </ul>
      {visible.length === 0 ? <p className="text-sm text-[#5f524c]">Nessun risultato.</p> : null}
      {!filter && !showAll && found.length > visible.length ? (
        <button type="button" onClick={() => setShowAll(true)}
          className="h-10 rounded-xl border border-[#211815]/20 bg-white px-3 text-sm font-semibold text-[#a8583e]">
          Mostra tutte le {found.length} domande
        </button>
      ) : null}
    </div>
  );
}
