"use client";

import { useMemo } from "react";

import { EventImage } from "@/components/shared/EventImage";
import type { PeonyEventCard } from "@/lib/events";

type Props = {
  events: PeonyEventCard[];
  searchQuery?: string;
  selectedDay?: string | null;
};

const CATEGORY_ORDER = ["percorso", "pratica", "community", "workshop", "altro"];

const CATEGORY_LABELS: Record<string, string> = {
  percorso: "Percorso",
  pratica: "Pratica",
  community: "Community",
  workshop: "Workshop",
  chiusura: "Chiusura",
  trasferta: "Trasferta",
  altro: "Altro",
};

const FALLBACK_IMAGE = "/images/home/event-class.jpg";
const CATEGORY_SET = new Set(CATEGORY_ORDER);

function tryFormatDate(date: string): string {
  try {
    const d = new Date(`${date}T12:00:00`);
    if (isNaN(d.getTime())) return date;
    return new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return date;
  }
}

export function EventsNetflixLayout({ events, searchQuery, selectedDay }: Props) {
  const isSearching = (searchQuery ?? "").trim().length > 0;
  const isDayFiltered = Boolean(selectedDay);

  const displayEvents = useMemo(() => {
    if (isSearching) {
      const q = (searchQuery ?? "").trim().toLowerCase();
      return events.filter((e) => e.title.toLowerCase().includes(q));
    }
    if (isDayFiltered) {
      return events.filter((e) => e.date === selectedDay);
    }
    return events;
  }, [events, searchQuery, selectedDay, isSearching, isDayFiltered]);

  const grouped = useMemo(() => {
    const map = new Map<string, PeonyEventCard[]>(
      CATEGORY_ORDER.map((cat) => [cat, []]),
    );
    for (const event of events) {
      const cat = CATEGORY_SET.has(event.category) ? event.category : "altro";
      map.get(cat)!.push(event);
    }
    return map;
  }, [events]);

  const showFlat = isSearching || isDayFiltered;

  return (
    <div>
      {showFlat ? (
        <div className="flex flex-col gap-3 px-4">
          {displayEvents.length === 0 ? (
            <p className="text-sm text-[#6b5c52]">Nessun evento trovato.</p>
          ) : (
            displayEvents.map((event) => (
              <SearchCard key={`${event.slug}-${event.date}`} event={event} />
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {CATEGORY_ORDER.map((cat) => {
            const catEvents = grouped.get(cat) ?? [];
            if (catEvents.length === 0) return null;
            return <CategoryRow key={cat} category={cat} events={catEvents} />;
          })}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  events,
}: {
  category: string;
  events: PeonyEventCard[];
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-4">
        <span className="font-sans text-xs uppercase tracking-widest text-[#6b5c52]">
          {CATEGORY_LABELS[category] ?? category}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="#8b5e4a"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 pl-4 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((event) => (
          <NetflixCard key={`${event.slug}-${event.date}`} event={event} />
        ))}
        <div className="w-1 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

function NetflixCard({ event }: { event: PeonyEventCard }) {
  const image = event.image ?? FALLBACK_IMAGE;
  const href = event.bookingUrl ?? event.eventUrl;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-[calc((100vw-48px)/1.25)] max-w-[300px] shrink-0 overflow-hidden rounded-[8px] border bg-white/65 [scroll-snap-align:start] transition-transform hover:-translate-y-[3px]"
    >
      <EventImage
        src={image}
        alt={event.title}
        variant="netflix"
      />
      <div className="px-3 pb-3 pt-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#8b5e4a]/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-[#5f524c]">
            {CATEGORY_LABELS[event.category] ?? event.category}
          </span>
          <span className="text-[10px] text-[#6b5c52]">
            {tryFormatDate(event.date)}
          </span>
        </div>
        <p className="mt-1 font-serif text-lg font-medium leading-tight text-[#211815] line-clamp-2">
          {event.title}
        </p>
        {event.bookingUrl ? (
          <span className="mt-2 inline-block rounded-full bg-[#211815] px-4 py-2 text-[13px] font-medium text-white">
            Prenota
          </span>
        ) : null}
      </div>
    </a>
  );
}

function SearchCard({ event }: { event: PeonyEventCard }) {
  const image = event.image ?? FALLBACK_IMAGE;

  return (
    <a
      href={event.eventUrl}
      className="flex items-center gap-3 rounded-[8px] border border-[#1a1510]/10 bg-white/60 p-3 transition hover:bg-white/80"
    >
      <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[6px]">
        <EventImage
          src={image}
          alt={event.title}
          variant="compact"
          className="h-full w-full"
        />
      </div>
      <div className="min-w-0 flex-1">
        <span className="rounded-full bg-[#8b5e4a]/10 px-2 py-0.5 text-[10px] font-medium capitalize text-[#8b5e4a]">
          {CATEGORY_LABELS[event.category] ?? event.category}
        </span>
        <p className="mt-1 font-serif text-sm font-medium leading-tight text-[#1a1510] line-clamp-2">
          {event.title}
        </p>
        <p className="mt-1 font-sans text-[10px] text-[#6b5c52]">
          {tryFormatDate(event.date)}
        </p>
      </div>
    </a>
  );
}
