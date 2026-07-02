import { notFound } from "next/navigation";

import { EventPageContent } from "@/components/events/EventPageContent";
import { getPublicEvents, type PeonyEvent } from "@/lib/events";
import { TICKET_TAILOR_PUBLIC_URL } from "@/lib/ticketTailor";

type EventPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const priorityTags = [
  "principianti",
  "anche per single",
  "observer ammessi",
  "bottom",
  "richiede basi",
  "con demo",
  "workshop",
  "percorso",
  "pratica",
];

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const events = await getPublicEvents();
  const event = events.find((item) => item.slug === slug);

  if (!event) {
    notFound();
  }

  const relatedEvents = getRelatedEvents(event, events);
  const image = event.imageUrl ?? getFallbackImage(event);
  const bookingUrl = event.bookingUrl ?? TICKET_TAILOR_PUBLIC_URL;
  const visibleTags = getVisibleTags(event.tags ?? []);

  return (
    <EventPageContent
      event={event}
      relatedEvents={relatedEvents}
      image={image}
      bookingUrl={bookingUrl}
      visibleTags={visibleTags}
    />
  );
}

function getVisibleTags(tags: string[]) {
  const uniqueTags = Array.from(new Set(tags.map((tag) => tag.toLowerCase())));
  const orderedTags = [
    ...priorityTags.filter((tag) => uniqueTags.includes(tag)),
    ...uniqueTags.filter((tag) => !priorityTags.includes(tag)),
  ];
  return orderedTags.slice(0, 6);
}

function getRelatedEvents(event: PeonyEvent, events: PeonyEvent[]) {
  const today = new Date().toISOString().slice(0, 10);
  const currentTags = new Set(event.tags ?? []);
  return events
    .filter((item) => item.id !== event.id && item.date >= today)
    .map((item) => ({
      item,
      score:
        (item.category === event.category ? 4 : 0) +
        (item.tags ?? []).filter((tag) => currentTags.has(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.date.localeCompare(b.item.date))
    .slice(0, 4)
    .map(({ item }) => item);
}

function getFallbackImage(event: PeonyEvent) {
  const title = event.title.toLowerCase();
  if (title.includes("rope jam")) return "/images/home/event-rope-jam.jpg";
  if (title.includes("foundation")) return "/images/home/event-foundation.jpg";
  if (title.includes("pratica") || title.includes("classe tematica") || title.includes("classi tematiche"))
    return "/images/home/event-practice.jpg";
  return "/images/home/event-class.jpg";
}
