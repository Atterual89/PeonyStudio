"use client";

// Home (D23): selettore d'anno e tabella desktop ordinabile con riga Totale.

import { ArrowDownUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatCents, formatDateRange } from "@/lib/gestionale/format";
import { sumRecaps, type YearFilter } from "@/lib/gestionale/recap";
import type { OperatorRole } from "@/lib/gestionale/types";
import type { DashboardEntry } from "@/lib/gestionale/workshops";

import { EconomicBadge, RecheckBadge } from "./Recap";

export function YearSelect({ value, years }: { value: YearFilter; years: readonly number[] }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-[#5f524c]">
      Anno
      <select
        className="min-h-10 rounded-xl border border-[#211815]/15 bg-white px-2 text-sm text-[#211815]"
        value={String(value)}
        onChange={(e) => router.push(`/gestione?anno=${e.target.value}`)}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
        <option value="tutti">Tutti</option>
      </select>
    </label>
  );
}

type SortKey = "ordine" | "nome" | "date" | "iscrizioni" | "entrate" | "uscite" | "rimane" | "stato";

function sortValue(entry: DashboardEntry, index: number, key: SortKey): string | number {
  switch (key) {
    case "ordine":
      return index;
    case "nome":
      return entry.name.toLowerCase();
    case "date":
      return entry.startsOn;
    case "iscrizioni":
      return entry.counts.iscrizioni;
    case "entrate":
      return entry.recap?.entrate ?? 0;
    case "uscite":
      return entry.recap?.uscite ?? 0;
    case "rimane":
      return entry.recap?.rimane ?? 0;
    case "stato":
      return entry.economic ?? "";
  }
}

const COLUMNS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "nome", label: "Workshop" },
  { key: "date", label: "Date" },
  { key: "iscrizioni", label: "Iscrizioni", right: true },
  { key: "entrate", label: "Entrate", right: true },
  { key: "uscite", label: "Spese", right: true },
  { key: "rimane", label: "Guadagno", right: true },
  { key: "stato", label: "Stato" },
];

/**
 * Tabella desktop: in partenza nell'ordine della home (in corso, prossimi,
 * passati). La riga in fondo somma le righe visibili (`totalLabel`).
 */
export function WorkshopTable({
  entries,
  highlighted,
  totalLabel,
  viewer = "admin",
}: {
  entries: readonly DashboardEntry[];
  highlighted: readonly string[];
  totalLabel: string;
  /** 4g (#4): frasi del badge per chi guarda; "Da ricontrollare" solo agli admin. */
  viewer?: OperatorRole;
}) {
  const isAdmin = viewer === "admin";
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "ordine", asc: true });
  const rows = useMemo(() => {
    const indexed = entries.map((entry, index) => ({ entry, index }));
    return indexed.sort((a, b) => {
      const av = sortValue(a.entry, a.index, sort.key);
      const bv = sortValue(b.entry, b.index, sort.key);
      const cmp = av < bv ? -1 : av > bv ? 1 : a.index - b.index;
      return sort.asc ? cmp : -cmp;
    });
  }, [entries, sort]);
  const totals = sumRecaps(entries.map((entry) => entry.recap));
  const iscrizioni = entries.reduce((sum, entry) => sum + entry.counts.iscrizioni, 0);

  if (entries.length === 0) return <p className="text-sm text-[#5f524c]">Nessun workshop.</p>;

  return (
    <table className="w-full overflow-hidden rounded-2xl border border-[#211815]/10 bg-white/70 text-sm">
      <thead className="border-b border-[#211815]/10 bg-[#f2ede3]/60 text-[#5f524c]">
        <tr>
          {COLUMNS.map((column) => (
            <th key={column.key} className={`px-3 py-1 ${column.right ? "text-right" : "text-left"}`}>
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-1 font-semibold"
                onClick={() => setSort((current) => ({ key: column.key, asc: current.key === column.key ? !current.asc : true }))}
              >
                {column.label}
                <ArrowDownUp className={`h-4 w-4 ${sort.key === column.key ? "text-[#a8583e]" : "text-[#5f524c]/50"}`} aria-hidden="true" />
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ entry }) => (
          <tr
            key={entry.key}
            className={`border-b border-[#211815]/5 ${highlighted.includes(entry.key) ? "bg-[#a8583e]/5 font-semibold" : ""}`}
          >
            <td className="px-3 py-2">
              {/* <a> semplice: la riga gestionale si crea solo all'apertura (D14). */}
              <a href={entry.href} className="underline-offset-2 hover:underline">
                {entry.name}
              </a>
              {entry.notice ? <span className="block text-xs font-normal text-[#7a5212]">{entry.notice}</span> : null}
            </td>
            <td className="px-3 py-2 font-normal text-[#5f524c]">{formatDateRange(entry.startsOn, entry.endsOn)}</td>
            <td className="px-3 py-2 text-right">
              {entry.counts.iscrizioni}
              {entry.capacity ? ` / ${entry.capacity}` : ""}
            </td>
            {entry.recap?.movimenti ? (
              <>
                <td className="px-3 py-2 text-right">{formatCents(entry.recap.entrate)}</td>
                <td className="px-3 py-2 text-right">{formatCents(entry.recap.uscite)}</td>
                <td className={`px-3 py-2 text-right ${entry.recap.rimane < 0 ? "text-[#9b2c2c]" : ""}`}>{formatCents(entry.recap.rimane)}</td>
              </>
            ) : (
              <td colSpan={3} className="px-3 py-2 text-right font-normal text-[#5f524c]">
                Nessun movimento
              </td>
            )}
            <td className="px-3 py-2">
              {entry.economic ? (
                <EconomicBadge
                  state={entry.economic}
                  residuo={entry.recap?.residuo ?? null}
                  recheck={isAdmin && entry.recap?.daRicontrollare}
                  viewer={viewer}
                />
              ) : isAdmin && entry.recap?.daRicontrollare ? (
                <RecheckBadge />
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-[#f2ede3]/60 font-semibold">
          <td className="px-3 py-2" colSpan={2}>
            {totalLabel}
          </td>
          <td className="px-3 py-2 text-right">{iscrizioni}</td>
          <td className="px-3 py-2 text-right">{formatCents(totals.entrate)}</td>
          <td className="px-3 py-2 text-right">{formatCents(totals.uscite)}</td>
          <td className="px-3 py-2 text-right">{formatCents(totals.rimane)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
