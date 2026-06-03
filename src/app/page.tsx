import { HomeContentClient } from "@/components/HomeContentClient";
import { getFeaturedEvent, getUpcomingEvents, toEventCard } from "@/lib/events";

export default async function Home() {
  const [featuredEvent, upcomingEvents] = await Promise.all([
    getFeaturedEvent(),
    getUpcomingEvents(5),
  ]);
  const featured = featuredEvent ? toEventCard(featuredEvent) : null;
  const events = upcomingEvents
    .filter((event) => event.id !== featuredEvent?.id)
    .slice(0, 4)
    .map(toEventCard);

  return <HomeContentClient featured={featured} events={events} />;
}
