export const maxDuration = 120;

import Link from "next/link";
import { notFound } from "next/navigation";

import { EventMembershipCheck } from "@/components/gestionale/EventMembershipCheck";
import { PeonyEventOperations } from "@/components/gestionale/PeonyEventOperations";
import { SyncTicketTailorButton } from "@/components/gestionale/SyncTicketTailorButton";
import { isLinkedMembershipEnabled, peonyMembershipRows } from "@/lib/gestionale/server/linked-membership";
import { getPeonyEvent, loadPeonyAttendees } from "@/lib/gestionale/server/peony-events";
import { loadPeonyEmailState } from "@/lib/gestionale/server/peony-email";
import { loadPeonyRevenue, euro } from "@/lib/gestionale/server/peony-revenue";

export default async function PeonyEventPage({ params,searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?:Promise<{ticket?:string}>;
}) {
  const { id } = await params;
  const search=searchParams?await searchParams:{};
  const initialTicketId=typeof search.ticket==="string"&&search.ticket.length<200?search.ticket:null;
  const event = await getPeonyEvent(id); // 404 per Ale, e per eventi LuXuria
  if (!event) notFound();
  const [roster, email, revenue] = await Promise.all([
    loadPeonyAttendees(event),
    loadPeonyEmailState(event),
    loadPeonyRevenue(),
  ]);
  // Fase C audit anagrafica: verifica soci dai collegamenti salvati (dietro interruttore).
  const membershipRows = isLinkedMembershipEnabled() ? await peonyMembershipRows(event, roster.attendees) : null;

  return (
    <section className="space-y-4">
      <Link href="/gestione" prefetch={false} className="text-sm text-[#5f524c] underline">
        ← Tutti gli eventi
      </Link>
      <div>
        <h1 className="font-serif text-2xl font-semibold">{event.title}</h1>
        <p className="mt-1 text-sm text-[#5f524c]">
          {event.startsOn ? new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "UTC" })
            .format(new Date(`${event.startsOn}T12:00:00Z`)) : "Data da definire"}
        </p>
      </div>
      <div className="grid gap-2 sm:flex sm:items-start">
        <SyncTicketTailorButton eventId={event.id} />
      </div>
      <div className="rounded-xl border border-[#211815]/10 bg-white/60 p-4">
        <h2 className="font-semibold">Introiti Ticket Tailor</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3 text-sm">
          <p>Incassato online <strong className="block text-lg">{euro(revenue.get(event.id)?.paidCents ?? 0)}</strong></p>
          <p>Rimborsi <strong className="block text-lg">{euro(revenue.get(event.id)?.refundedCents ?? 0)}</strong></p>
          <p>Netto dopo rimborsi <strong className="block text-lg">{euro(revenue.get(event.id)?.netCents ?? 0)}</strong></p>
        </div>
        <p className="mt-2 text-xs text-[#5f524c]">{revenue.get(event.id)?.orders ?? 0} ordini completati · incassi in sede esclusi · commissioni non detratte</p>
      </div>
      {membershipRows ? <EventMembershipCheck rows={membershipRows} /> : null}
      <PeonyEventOperations
        eventId={event.id}
        initialTicketId={initialTicketId}
        eventTitle={event.title}
        dateLabel={event.startsOn ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${event.startsOn}T12:00:00Z`)) : "Data da definire"}
        attendees={roster.attendees}
        ticketsLastSyncedAt={roster.ticketsLastSyncedAt}
        associationLastSyncedAt={roster.associationLastSyncedAt}
        templates={email.templates}
        emailContext={email.context}
        initialLanguageOverride={email.languageOverride}
        initialDetailFields={email.detailFields}
        sends={email.sends}
      />
    </section>
  );
}
