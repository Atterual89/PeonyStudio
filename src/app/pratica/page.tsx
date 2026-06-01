import { PracticeSocialPage } from "@/components/practice/PracticeSocialPage";
import { practiceContent } from "@/content/practice";
import { getUpcomingEvents, toEventCard } from "@/lib/events";

export default async function PraticaPage() {
  const events = (await getUpcomingEvents(12))
    .filter(
      (event) =>
        event.category === "pratica" ||
        event.category === "community" ||
        ["open day", "rope jam", "aperibottom", "aperi-bottom"].some((term) =>
          event.title.toLowerCase().includes(term),
        ),
    )
    .slice(0, 5)
    .map(toEventCard);

  return <PracticeSocialPage content={practiceContent} events={events} />;
}
