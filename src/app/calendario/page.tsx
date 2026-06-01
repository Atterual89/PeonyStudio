import Link from "next/link";

import { CalendarExplorer } from "@/components/calendar/CalendarExplorer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getPublicEvents } from "@/lib/events";
import { TICKET_TAILOR_PUBLIC_URL } from "@/lib/ticketTailor";

export default async function CalendarioPage() {
  const events = await getPublicEvents();

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-12 sm:px-6 md:pb-10 md:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
          Date e prenotazioni
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_0.36fr] md:items-end">
          <div>
            <h1 className="max-w-4xl font-serif text-[clamp(44px,10vw,82px)] font-medium leading-[0.96] tracking-normal text-[#211815]">
              Calendario
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
              Esplora le prossime date di Peony Studio: percorsi, pratica,
              community e workshop.
            </p>
          </div>
          <Link
            href={TICKET_TAILOR_PUBLIC_URL}
            className="inline-flex w-fit rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(33,24,21,0.22)]"
          >
            Apri Ticket Tailor
          </Link>
        </div>
      </section>

      <CalendarExplorer events={events} ticketTailorUrl={TICKET_TAILOR_PUBLIC_URL} />
    </main>
  );
}
