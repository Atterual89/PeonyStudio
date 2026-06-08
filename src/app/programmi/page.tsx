import { ProgramsProgressPage } from "@/components/programs/ProgramsProgressPage";
import { programsContent } from "@/content/programs";
import { getUpcomingEvents } from "@/lib/events";

export default async function ProgrammiPage() {
  const allEvents = await getUpcomingEvents(30);
  const percorsoEvents = allEvents.filter((e) => e.category === "percorso" || e.category === "pratica");
  return <ProgramsProgressPage content={programsContent} percorsoEvents={percorsoEvents} />;
}
