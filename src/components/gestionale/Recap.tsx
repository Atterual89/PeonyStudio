// Recap economico (D23): riquadri Entrate · Spese · Guadagno (· Da incassare)
// e badge "Pari" / chi deve dare quanto (4g). Stessi numeri in home, card e tab Conti.

import { formatCents } from "@/lib/gestionale/format";
import { economicText, type Recap } from "@/lib/gestionale/recap";
import type { OperatorRole } from "@/lib/gestionale/types";
import type { EconomicState } from "@/lib/gestionale/workshops";

function Tile({ label, cents, accent }: { label: string; cents: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#211815]/10 bg-white/70 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-[#5f524c]">{label}</dt>
      <dd className={`mt-1 text-base font-semibold sm:text-lg ${accent ? "text-[#a8583e]" : cents < 0 ? "text-[#9b2c2c]" : ""}`}>
        {formatCents(cents)}
      </dd>
    </div>
  );
}

/** Tre riquadri (tab Conti) o quattro con "Da incassare" (home). */
export function RecapTiles({ recap, withOutstanding = false }: { recap: Recap; withOutstanding?: boolean }) {
  return (
    <dl className={`grid gap-2 ${withOutstanding ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
      <Tile label="Entrate" cents={recap.entrate} />
      <Tile label="Spese" cents={recap.uscite} />
      <Tile label="Guadagno" cents={recap.rimane} />
      {withOutstanding ? <Tile label="Da incassare" cents={recap.daIncassare} accent /> : null}
    </dl>
  );
}

/**
 * D24, 4g (#4): "Pari" o chi deve dare quanto ("Devi dare X € a Peony" per
 * Ale); #18: "Da ricontrollare" se il consuntivo verificato è cambiato (solo
 * admin: chi chiama passa `recheck` solo agli admin).
 */
export function EconomicBadge({
  state,
  residuo,
  recheck = false,
  viewer = "admin",
}: {
  state: EconomicState;
  residuo: number | null;
  recheck?: boolean;
  viewer?: OperatorRole;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
          state === "saldato" ? "border-[#3f7a4f]/30 bg-[#eaf3ec] text-[#2f5d3b]" : "border-[#211815]/15 bg-[#211815]/5 text-[#5f524c]"
        }`}
      >
        {economicText(state, residuo, viewer)}
      </span>
      {recheck ? <RecheckBadge /> : null}
    </span>
  );
}

export function RecheckBadge() {
  return (
    <span className="rounded-full border border-[#b7791f]/30 bg-[#fdf3e1] px-2.5 py-0.5 text-xs font-semibold text-[#7a5212]">Da ricontrollare</span>
  );
}
