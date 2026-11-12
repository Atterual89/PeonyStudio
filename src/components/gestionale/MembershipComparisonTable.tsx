"use client";

// Fase C audit anagrafica: differenze tra il calcolo attuale e quello nuovo.
// Le righe gialle si chiariscono qui, con gli stessi passi della pagina evento.

import Link from "next/link";
import { useState } from "react";

import { formatShortDate } from "@/lib/gestionale/membership-rule";
import type { ComparisonRow } from "@/lib/gestionale/server/linked-membership-compare";

import { Resolver } from "./EventMembershipCheck";
import { UI, buttonClass } from "./ui";

const LABEL: Record<ComparisonRow["before"], string> = {
  verde: "In regola",
  rosso: "Non in regola",
  giallo: "Da chiarire",
  non_collegata: "Non collegata",
};
const COLOR: Record<ComparisonRow["before"], string> = {
  verde: "text-[#326941]",
  rosso: "text-[#9b2c2c]",
  giallo: "text-[#7a5212]",
  non_collegata: "text-[#5f524c]",
};

export function MembershipComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  // Prima i gialli (si possono chiarire), poi chi passa da verde a rosso, poi il resto.
  const rank = (row: ComparisonRow) => (row.after === "giallo" ? 0 : row.before === "verde" && row.after === "rosso" ? 1 : 2);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || a.eventDate.localeCompare(b.eventDate) || a.name.localeCompare(b.name, "it"));

  return (
    <ul className="divide-y divide-[#211815]/10 overflow-hidden rounded-xl bg-white">
      {sorted.map((row) => {
        const key = `${row.eventId}:${row.row.key}`;
        return (
          <li key={key}>
            <div className={`${UI.row} flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 ${row.after === "giallo" ? "bg-[#fdf3e1]" : ""}`}>
              <span className="min-w-0 flex-1 basis-56">
                <span className="block font-semibold">{row.name}</span>
                <Link prefetch={false} href={row.href} className="text-xs text-[#5f524c] underline">
                  {row.eventName}{row.eventDate ? ` · ${formatShortDate(row.eventDate)}` : ""}
                </Link>
              </span>
              <span className="basis-40 text-sm">
                <span className={COLOR[row.before]}>{LABEL[row.before]}</span>
                <span className="text-[#5f524c]"> → </span>
                <span className={`font-semibold ${COLOR[row.after]}`}>{LABEL[row.after]}</span>
              </span>
              <span className="min-w-0 flex-1 basis-56 text-xs text-[#5f524c]">{row.reason}</span>
              {row.after === "giallo" ? (
                <button type="button" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)} className={buttonClass.secondary}>
                  {open === key ? "Chiudi" : "Chiarisci"}
                </button>
              ) : null}
            </div>
            {open === key ? <Resolver row={row.row} onDone={() => setOpen(null)} /> : null}
          </li>
        );
      })}
    </ul>
  );
}
