export const maxDuration = 120;

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { NewPersonForm } from "@/components/gestionale/NewPersonForm";
import { QuotaCheckbox } from "@/components/gestionale/QuotaCheckbox";
import { UrlSearchBox } from "@/components/gestionale/UrlSearchBox";
import { Notice, Section, cardClass } from "@/components/gestionale/ui";
import { formatDateRange } from "@/lib/gestionale/format";
import { buildPeopleOverview, type OtherContact, type UpcomingContact, type UpcomingBooking, type UpcomingPeopleGroup } from "@/lib/gestionale/people-overview";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople, loadUpcomingLuxuriaPeople } from "@/lib/gestionale/server/data";
import { loadUpcomingPeonyPeople } from "@/lib/gestionale/server/peony-events";
import { loadSociReviewData } from "@/lib/gestionale/server/soci";
import { todayInRome } from "@/lib/gestionale/workshops";

function MembershipText({row}: {row:UpcomingContact}) {
  if(row.associationRequired===false)return <span className="text-xs font-semibold text-[#5f524c]">Observer</span>;
  if(row.status==="valid")return <span className="text-xs font-semibold text-[#326941]">Verificata</span>;
  if(row.status==="payment_missing")return <span className="text-xs font-semibold text-[#9b4b1e]">Quota da verificare</span>;
  if(row.status==="missing_form")return <span className="text-xs text-[#9b4b1e]">Modulo assente</span>;
  return <span className="text-xs text-[#9b4b1e]">Da verificare</span>;
}

function MembershipLine({row,role,year}: {row:UpcomingContact;role:string;year:string}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <span className="mr-1 text-xs text-[#5f524c]">{role}:</span>{" "}
        {row.personId?
          <Link prefetch={false} href={`/gestione/p/${row.personId}`} className="font-semibold underline decoration-[#211815]/25 underline-offset-2">{row.name}</Link>
          :<span className="font-semibold">{row.name}</span>}
        {row.email?<span className="block break-all text-xs text-[#5f524c]">{row.email}</span>:null}
      </div>
      <div className="flex flex-col items-end">
        <MembershipText row={row}/>
        {row.status==="payment_missing"&&row.formMemberId?
          <QuotaCheckbox formMemberId={row.formMemberId} name={row.name} paid={false}
            paidSource={row.paidSource} periodDate={`${year}-01-01`}/>:null}
      </div>
    </div>
  );
}

function BookingCard({booking,year}:{booking:UpcomingBooking;year:string}) {
  return (
    <li className="rounded-xl border border-[#211815]/10 bg-white/85 px-3 py-2">
      <p className="break-words text-sm font-semibold">
        {booking.primary.name}
        {booking.partnerRequired?<span className="font-normal"> + {booking.partner?.name??"Partner da indicare"}</span>:null}
      </p>
      <div className="divide-y divide-[#211815]/10">
        <MembershipLine row={booking.primary} role="Intestatario" year={year}/>
        {booking.partner?
          <MembershipLine row={booking.partner} role="Partner" year={year}/>
          :booking.partnerRequired?
            <p className="py-2 text-xs text-[#9b4b1e]">Partner non identificato · usa «Apri evento» per cercarlo e collegarlo.</p>
            :null}
      </div>
    </li>
  );
}

function PersonLine({row}:{row:OtherContact}) {
  return (
    <li className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        {row.personId?<Link prefetch={false} href={`/gestione/p/${row.personId}`} className="block font-semibold underline decoration-[#211815]/25">{row.name}</Link>
          :<span className="block font-semibold">{row.name}</span>}
        {row.email?<span className="block break-all text-xs text-[#5f524c]">{row.email}</span>:null}
      </span>
      <span className="flex flex-col items-end gap-1">
        <MembershipText row={row}/>
        {row.status==="payment_missing"&&row.formMemberId?
          <QuotaCheckbox formMemberId={row.formMemberId} name={row.name} paid={false} paidSource={row.paidSource}/>:null}
      </span>
    </li>
  );
}

function PersonList({people}:{people:readonly OtherContact[]}) {
  return <ul className={`${cardClass} divide-y divide-[#211815]/5`}>
    {people.map(person=><PersonLine key={person.key} row={person}/>)}
  </ul>;
}

function EventGroups({events,query}: {events:UpcomingPeopleGroup[];query:string}) {
  return (
    <div className="space-y-2">
      {events.map((event,index)=>(
        <details key={event.key} open={Boolean(query.trim())||index===0}
          className="rounded-xl border border-[#211815]/10 bg-white/45">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block break-words font-semibold">{event.title}</span>
              <span className="block text-xs text-[#5f524c]">
                {formatDateRange(event.startsOn,event.endsOn)} · {event.bookings.length} iscrizioni
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#a8583e]" aria-hidden="true"/>
          </summary>
          <div className="border-t border-[#211815]/10 px-2 pb-2 pt-2">
            <ul className="space-y-2">
              {event.bookings.map(booking=>(
                <BookingCard key={booking.key} booking={booking} year={event.startsOn.slice(0,4)}/>
              ))}
            </ul>
            <Link prefetch={false} href={event.href}
              className="mt-2 inline-flex min-h-10 items-center px-2 text-xs font-semibold text-[#a8583e] underline">
              Apri evento
            </Link>
          </div>
        </details>
      ))}
    </div>
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
  const ongoing=overview.upcoming.filter(event=>event.startsOn<=today);
  const future=overview.upcoming.filter(event=>event.startsOn>today);
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

      {ongoing.length>0?(
        <Section title="In corso" count={ongoing.length} defaultOpen>
          <EventGroups events={ongoing} query={query}/>
        </Section>
      ):null}
      <Section title="Prossimi eventi" count={future.length} defaultOpen>
        {future.length?<EventGroups events={future} query={query}/>
          :<p className="text-sm text-[#5f524c]">Nessun evento futuro con iscrizioni.</p>}
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
