export const maxDuration = 120;

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { NewPersonForm } from "@/components/gestionale/NewPersonForm";
import { QuotaCheckbox } from "@/components/gestionale/QuotaCheckbox";
import { UrlSearchBox } from "@/components/gestionale/UrlSearchBox";
import { Notice, Section, cardClass } from "@/components/gestionale/ui";
import { formatDateRange } from "@/lib/gestionale/format";
import { buildPeopleOverview, type OtherContact, type UpcomingContact } from "@/lib/gestionale/people-overview";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople, loadUpcomingLuxuriaPeople } from "@/lib/gestionale/server/data";
import { loadUpcomingPeonyPeople } from "@/lib/gestionale/server/peony-events";
import { loadSociReviewData } from "@/lib/gestionale/server/soci";
import { todayInRome } from "@/lib/gestionale/workshops";

function PersonLine({ row, year }: { row: OtherContact | UpcomingContact; year?: string }) {
  const observer = "observer" in row && row.observer;
  return (
    <li className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        {row.personId ? (
          <Link prefetch={false} href={`/gestione/p/${row.personId}`}
            className="inline-flex items-center gap-1 font-semibold text-[#211815] underline decoration-[#211815]/25 underline-offset-2">
            <span className="break-words">{row.name}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5f524c]" aria-hidden="true" />
          </Link>
        ) : <span className="block break-words font-semibold">{row.name}</span>}
        {row.email ? <span className="block break-all text-xs text-[#5f524c]">{row.email}</span> : null}
      </span>
      {observer ? (
        <span className="text-xs text-[#5f524c]">Osservatore</span>
      ) : row.formMemberId ? (
        <QuotaCheckbox formMemberId={row.formMemberId} name={row.name}
          paid={Boolean(row.paid)} paidSource={row.paidSource}
          periodDate={year ? `${year}-01-01` : undefined} />
      ) : row.personId ? (
        <Link prefetch={false} href={`/gestione/p/${row.personId}`}
          className="text-xs font-semibold text-[#a8583e] underline">Verifica quota</Link>
      ) : <span className="text-xs text-[#9b4b1e]">Modulo da verificare</span>}
    </li>
  );
}

function PersonList({ people, year }: { people: readonly (OtherContact | UpcomingContact)[]; year?: string }) {
  return (
    <ul className={`${cardClass} divide-y divide-[#211815]/5`}>
      {people.map((person) => <PersonLine key={person.key} row={person} year={year} />)}
    </ul>
  );
}

export default async function PersonePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tutte?: string | string[] }>;
}) {
  await requireAdmin();
  const { q, tutte } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  const showAll = tutte === "1";
  const today = todayInRome();
  const [people, peony, luxuria, currentForms] = await Promise.all([
    loadPeople(),
    loadUpcomingPeonyPeople(today),
    loadUpcomingLuxuriaPeople(today),
    loadSociReviewData().catch((error: unknown) => {
      console.error("Gestionale (persone: registro soci)", error instanceof Error ? error.message : "errore");
      return null;
    }),
  ]);
  const years = [...new Set([...peony, ...luxuria].map((event) => event.startsOn.slice(0, 4)))];
  const formsByYear = new Map<string, NonNullable<typeof currentForms>["rows"]>();
  if (currentForms) {
    formsByYear.set(today.slice(0, 4), currentForms.rows);
    await Promise.all(years.filter((year) => year !== today.slice(0, 4)).map(async (year) => {
      try {
        const result = await loadSociReviewData(`${year}-01-01`);
        formsByYear.set(year, result.rows);
      } catch (error) {
        console.error("Gestionale (persone: annualità)", year, error instanceof Error ? error.message : "errore");
      }
    }));
  }
  const overview = buildPeopleOverview({
    people,
    currentForms: currentForms?.rows ?? [],
    formsByYear,
    peony, luxuria, today, query,
  });
  const limit = showAll || query.trim() ? 200 : 30;
  const others = overview.otherPeople.slice(0, limit);
  const onlyForms = overview.formOnly.slice(0, limit);
  const hasResults = overview.upcoming.length || overview.totalOthers;
  const extraLink = (total: number) => total > limit ? (
    <Link href="/gestione/persone?tutte=1" prefetch={false}
      className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-[#a8583e] underline">
      Mostra tutte ({total})
    </Link>
  ) : null;

  return (
    <section className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-medium">Persone</h1>
          <p className="mt-1 text-sm text-[#5f524c]">
            Iscritti ai prossimi eventi, poi gli altri contatti.
          </p>
        </div>
        <NewPersonForm />
      </div>
      <div className="mt-4">
        <UrlSearchBox initialQuery={query} placeholder="Cerca nome, email o evento" />
      </div>
      {!currentForms ? (
        <div className="mt-3">
          <Notice tone="warning">Le informazioni associative salvate non sono disponibili. Le persone e gli eventi restano consultabili.</Notice>
        </div>
      ) : null}
      {!hasResults ? <p className="mt-4 text-sm text-[#5f524c]">Nessuna persona trovata.</p> : null}

      <Section title="Prossimi eventi" count={overview.upcoming.length} defaultOpen>
        {overview.upcoming.length ? (
          <div className="space-y-2">
            {overview.upcoming.map((event, index) => (
              <details key={event.key} open={Boolean(query.trim()) || index === 0}
                className="rounded-xl border border-[#211815]/10 bg-white/45">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block break-words font-semibold">{event.title}</span>
                    <span className="block text-xs text-[#5f524c]">
                      {formatDateRange(event.startsOn, event.endsOn)} · {event.people.length} persone
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#a8583e]" aria-hidden="true" />
                </summary>
                <div className="border-t border-[#211815]/10 px-2 pb-2 pt-2">
                  <PersonList people={event.people} year={event.startsOn.slice(0, 4)} />
                  <Link prefetch={false} href={event.href}
                    className="mt-2 inline-flex min-h-10 items-center px-2 text-xs font-semibold text-[#a8583e] underline">
                    Apri evento
                  </Link>
                </div>
              </details>
            ))}
          </div>
        ) : <p className="text-sm text-[#5f524c]">Nessun iscritto nei prossimi eventi.</p>}
      </Section>

      <Section title="Altre persone" count={overview.totalOthers} defaultOpen={Boolean(query.trim())}>
        {others.length > 0 ? (
          <>
            <p className="mb-2 text-xs font-semibold text-[#5f524c]">Anagrafiche</p>
            <PersonList people={others} />
            {extraLink(overview.otherPeople.length)}
          </>
        ) : null}
        {overview.formOnly.length > 0 ? (
          <details open={Boolean(query.trim())} className="mt-3 rounded-xl border border-[#211815]/10 bg-white/45 p-3">
            <summary className="min-h-10 cursor-pointer text-sm font-semibold">
              Solo modulo Google ({overview.formOnly.length})
            </summary>
            <p className="mt-1 mb-2 text-xs text-[#5f524c]">
              Persone che hanno compilato il modulo ma non risultano collegate a un'anagrafica o ai prossimi eventi.
            </p>
            <PersonList people={onlyForms} />
            {extraLink(overview.formOnly.length)}
          </details>
        ) : null}
        {!overview.totalOthers ? <p className="text-sm text-[#5f524c]">Nessun altro contatto.</p> : null}
      </Section>
    </section>
  );
}
