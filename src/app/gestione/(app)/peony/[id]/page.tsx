import Link from "next/link";
import { notFound } from "next/navigation";

import { PeonyEventOperations } from "@/components/gestionale/PeonyEventOperations";
import { getPeonyEvent, loadPeonyAttendees } from "@/lib/gestionale/server/peony-events";
import { loadPeonyEmailState } from "@/lib/gestionale/server/peony-email";

export default async function PeonyEventPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getPeonyEvent(id); // 404 per Ale, e per eventi LuXuria
  if (!event) notFound();
  const [roster, email] = await Promise.all([
    loadPeonyAttendees(event),
    loadPeonyEmailState(event),
  ]);

  return (
    <section className="space-y-4">
      <Link href="/gestione" prefetch={false} className="text-sm text-[#5f524c] underline">
        ← Tutti gli eventi
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#a8583e]">Evento Peony · Ticket Tailor</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold">{event.title}</h1>
        <p className="mt-1 text-sm text-[#5f524c]">
          {event.startsOn ? new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "UTC" })
            .format(new Date(`${event.startsOn}T12:00:00Z`)) : "Data da definire"}
        </p>
      </div>
      <PeonyEventOperations
        eventId={event.id}
        eventTitle={event.title}
        dateLabel={event.startsOn ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${event.startsOn}T12:00:00Z`)) : "Data da definire"}
        attendees={roster.attendees}
        ticketsLastSyncedAt={roster.ticketsLastSyncedAt}
        associationLastSyncedAt={roster.associationLastSyncedAt}
        templates={email.templates}
        sends={email.sends}
      />
    </section>
  );
}
