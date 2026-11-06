import { WorkshopTable, YearSelect } from "@/components/gestionale/HomeControls";
import { EconomicBadge, RecapTiles, RecheckBadge } from "@/components/gestionale/Recap";
import { Notice, Section, cardClass } from "@/components/gestionale/ui";
import { formatDateRange } from "@/lib/gestionale/format";
import { availableYears, conguagliText, homeView, parseYearFilter, recapLine } from "@/lib/gestionale/recap";
import { requireOperator } from "@/lib/gestionale/server/auth";
import { getDashboard } from "@/lib/gestionale/server/data";
import type { OperatorRole } from "@/lib/gestionale/types";
import { todayInRome, type DashboardEntry } from "@/lib/gestionale/workshops";

function WorkshopCard({ entry, highlighted, viewer }: { entry: DashboardEntry; highlighted: boolean; viewer: OperatorRole }) {
  const isAdmin = viewer === "admin";
  const { counts } = entry;
  return (
    <li>
      {/* <a> semplice, non <Link>: niente prefetch, la riga gestionale si crea solo all'apertura (D14). */}
      <a
        href={entry.href}
        className={`${cardClass} block p-3 transition active:scale-[0.99] ${highlighted ? "border-[#a8583e] bg-white ring-2 ring-[#a8583e]/20" : ""}`}
      >
        <p className="text-base font-semibold leading-snug">{entry.name}</p>
        <p className="mt-0.5 text-sm text-[#5f524c]">{formatDateRange(entry.startsOn, entry.endsOn)}</p>
        {entry.notice ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#7a5212]">{entry.notice}</p> : null}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <strong className="text-base">
              {counts.iscrizioni}
              {entry.capacity ? ` / ${entry.capacity}` : ""}
            </strong>{" "}
            {counts.iscrizioni === 1 ? "iscrizione" : "iscrizioni"}
          </span>
          {counts.lista_attesa > 0 ? <span>{counts.lista_attesa} in lista d&apos;attesa</span> : null}
          {counts.interessati > 0 ? <span className="text-[#5f524c]">{counts.interessati} interessati</span> : null}
          {counts.cancellati > 0 ? <span className="text-[#5f524c]">{counts.cancellati} cancellati</span> : null}
        </p>
        <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={entry.recap?.movimenti ? "" : "text-[#5f524c]"}>{recapLine(entry.recap)}</span>
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
        </p>
      </a>
    </li>
  );
}

function WorkshopList({ entries, highlighted, viewer }: { entries: DashboardEntry[]; highlighted: readonly string[]; viewer: OperatorRole }) {
  if (entries.length === 0) return <p className="text-sm text-[#5f524c]">Nessun workshop.</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {entries.map((entry) => (
        <WorkshopCard key={entry.key} entry={entry} highlighted={highlighted.includes(entry.key)} viewer={viewer} />
      ))}
    </ul>
  );
}

/**
 * Home (D23), uguale per tutti gli operatori: recap economico dell'anno e
 * workshop (In corso e Prossimi sempre tutti, Passati dell'anno). Nessun
 * dato di persone.
 */
export default async function WorkshopDashboard({
  searchParams,
}: {
  searchParams: Promise<{ errore?: string; anno?: string | string[] }>;
}) {
  const operator = await requireOperator();
  const viewer = operator.role;
  const [{ errore, anno }, entries] = await Promise.all([searchParams, getDashboard()]);
  const today = todayInRome();
  const year = parseYearFilter(anno, today);
  // L'anno filtra solo i Passati e i riquadri: In corso e Prossimi sempre tutti.
  const { groups, totals, rows, totalLabel } = homeView(entries, year, today);
  const conguagli = conguagliText(totals.conguagli, viewer);
  // In evidenza: i workshop in corso, altrimenti il primo dei prossimi.
  const highlighted = (groups.in_corso.length > 0 ? groups.in_corso : groups.prossimo.slice(0, 1)).map((entry) => entry.key);

  const years = availableYears(entries.map((entry) => entry.startsOn), today);
  const error =
    errore === "evento" ? (
      <div className="mt-4">
        <Notice tone="error">Non è stato possibile aprire l&apos;evento. Riprova tra qualche istante.</Notice>
      </div>
    ) : null;
  const current = (
    <>
      {groups.in_corso.length > 0 ? (
        <Section title="In corso" count={groups.in_corso.length} defaultOpen>
          <WorkshopList entries={groups.in_corso} highlighted={highlighted} viewer={viewer} />
        </Section>
      ) : null}
      <Section title="Prossimi" count={groups.prossimo.length} defaultOpen>
        <WorkshopList entries={groups.prossimo} highlighted={highlighted} viewer={viewer} />
      </Section>
    </>
  );
  const past = (
    <Section title="Passati" count={groups.passato.length}>
      <WorkshopList entries={groups.passato} highlighted={highlighted} viewer={viewer} />
    </Section>
  );
  const table = (
    <div className="mt-3 hidden lg:block">
      <WorkshopTable entries={rows} highlighted={highlighted} totalLabel={totalLabel} viewer={viewer} />
    </div>
  );

  if (viewer === "organizzatrice") {
    // 4g (#5, #2): per Ale prima la frase "Devi dare / Peony ti deve / Siete
    // pari" e il workshop in corso o il prossimo; i riquadri dell'anno sotto.
    return (
      <section>
        <h1 className="font-serif text-xl font-medium">Workshop</h1>
        {error}
        {conguagli ? <p className="mt-3 font-serif text-2xl font-medium leading-tight text-[#a8583e]">{conguagli}</p> : null}
        <div className="lg:hidden">{current}</div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-semibold">Totali dell&apos;anno</h2>
          <YearSelect value={year} years={years} />
        </div>
        <div className="mt-2">
          <RecapTiles recap={totals} withOutstanding />
        </div>
        <div className="lg:hidden">{past}</div>
        {table}
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl font-medium">Workshop</h1>
          <p className="mt-1 text-sm text-[#5f524c]">Eventi LuXuria da Ticket Tailor</p>
        </div>
        <YearSelect value={year} years={years} />
      </div>

      {error}

      <div className="mt-4 space-y-2">
        <RecapTiles recap={totals} withOutstanding />
        {conguagli ? <p className="text-[15px] font-semibold">{conguagli}</p> : null}
      </div>

      {/* Mobile e tablet: card per gruppo. */}
      <div className="lg:hidden">
        {current}
        {past}
      </div>

      {/* Desktop: tabella ordinabile con riga Totale. */}
      {table}
    </section>
  );
}
