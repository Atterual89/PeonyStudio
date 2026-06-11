import { CalendarioHero } from "@/components/calendar/CalendarioHero";
import { CalendarExplorer } from "@/components/calendar/CalendarExplorer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getPublicEvents } from "@/lib/events";
import { TICKET_TAILOR_PUBLIC_URL } from "@/lib/ticketTailor";

export default async function CalendarioPage() {
  const events = await getPublicEvents();

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <CalendarioHero ticketTailorUrl={TICKET_TAILOR_PUBLIC_URL} />
      <CalendarExplorer events={events} ticketTailorUrl={TICKET_TAILOR_PUBLIC_URL} />
    </main>
  );
}
