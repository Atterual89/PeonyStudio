"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  isWorkshopEvent,
  type PeonyEvent,
  type PeonyEventCategory,
} from "@/lib/events";

type CalendarExplorerProps = {
  events: PeonyEvent[];
  ticketTailorUrl: string;
};

type CategoryFilter = "all" | "percorso" | "pratica" | "community" | "workshop";
type PeriodFilter = "all" | "30" | "90" | "season";

const categoryFilters: { label: string; value: CategoryFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Percorsi", value: "percorso" },
  { label: "Pratica", value: "pratica" },
  { label: "Community", value: "community" },
  { label: "Workshop", value: "workshop" },
];

const periodFilters: { label: string; value: PeriodFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Prossimi 30 giorni", value: "30" },
  { label: "Prossimi 3 mesi", value: "90" },
  { label: "Stagione completa", value: "season" },
];

const suggestedTags = [
  "anche per single",
  "observer ammessi",
  "principianti",
  "con demo",
  "bottom",
];

const sectionMeta: {
  key: string;
  title: string;
  subtitle: string;
  category?: PeonyEventCategory;
}[] = [
  {
    key: "upcoming",
    title: "Prossimi appuntamenti",
    subtitle: "Le date più vicine, ordinate per giorno.",
  },
  {
    key: "percorso",
    title: "Percorsi",
    subtitle: "Cicli e classi strutturate per costruire continuità.",
    category: "percorso",
  },
  {
    key: "pratica",
    title: "Pratica",
    subtitle: "Serate per ripetere, consolidare e fare domande.",
    category: "pratica",
  },
  {
    key: "community",
    title: "Community",
    subtitle: "Occasioni per incontrare persone e vivere lo spazio.",
    category: "community",
  },
  {
    key: "workshop",
    title: "Workshop",
    subtitle: "Appuntamenti intensivi e approfondimenti specifici.",
    category: "workshop",
  },
];

export function CalendarExplorer({
  events,
  ticketTailorUrl,
}: CalendarExplorerProps) {
  const sortedEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            event.isPublic === true &&
            event.category !== "trasferta" &&
            event.category !== "chiusura",
        )
        .sort(compareEvents),
    [events],
  );
  const today = getTodayIso();
  const firstFutureEvent =
    sortedEvents.find((event) => event.date >= today) ?? sortedEvents[0];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    firstFutureEvent ? getMonthKey(firstFutureEvent.date) : getMonthKey(today),
  );
  const [selectedDay, setSelectedDay] = useState(
    firstFutureEvent?.date ?? today,
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    upcoming: true,
    percorso: true,
    pratica: true,
    community: true,
    workshop: true,
  });

  const availableTags = useMemo(() => {
    const tags = new Set(
      sortedEvents.flatMap((event) =>
        (event.tags ?? []).map((tag) => tag.toLowerCase().trim()),
      ),
    );

    return suggestedTags.filter((tag) => tags.has(tag));
  }, [sortedEvents]);

  const filteredEvents = useMemo(() => {
    return sortedEvents.filter((event) => {
      if (event.date < today) {
        return false;
      }

      if (category !== "all" && event.category !== category) {
        return false;
      }

      if (activeTags.length > 0) {
        const tags = (event.tags ?? []).map((tag) => tag.toLowerCase().trim());
        if (!activeTags.some((tag) => tags.includes(tag))) {
          return false;
        }
      }

      if (!matchesPeriod(event.date, period, today)) {
        return false;
      }

      const normalizedQuery = query.trim().toLowerCase();
      if (normalizedQuery) {
        const haystack = [
          event.title,
          event.shortDescription,
          event.category,
          event.code,
          ...(event.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [activeTags, category, period, query, sortedEvents, today]);

  const eventsByDay = useMemo(
    () => groupEventsByDate(filteredEvents),
    [filteredEvents],
  );
  const effectiveSelectedDay = eventsByDay.has(selectedDay)
    ? selectedDay
    : filteredEvents[0]?.date ?? selectedDay;
  const selectedDayEvents = eventsByDay.get(effectiveSelectedDay) ?? [];
  const monthCells = useMemo(
    () => getMonthCells(visibleMonth, eventsByDay),
    [eventsByDay, visibleMonth],
  );
  const hasResults = filteredEvents.length > 0;
  const hasActiveFilters =
    query.trim().length > 0 ||
    category !== "all" ||
    period !== "all" ||
    activeTags.length > 0;
  const filterSummary = getFilterSummary({
    query,
    category,
    period,
    activeTags,
  });

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setPeriod("all");
    setActiveTags([]);
    if (firstFutureEvent) {
      setSelectedDay(firstFutureEvent.date);
      setVisibleMonth(getMonthKey(firstFutureEvent.date));
    }
  }

  function toggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-2 sm:px-6 md:pb-24">
      <div className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-medium leading-none">
              Filtri
            </h2>
            <p className="mt-1 text-xs text-[#5f524c]">{filterSummary}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-2 text-xs font-medium text-[#5f524c] transition hover:bg-white/70"
              >
                Reset filtri
              </button>
            ) : null}
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className="rounded-full bg-[#211815] px-4 py-2 text-xs font-medium text-white transition hover:-translate-y-0.5"
            >
              {filtersOpen ? "Nascondi filtri" : "Mostra filtri"}
            </button>
          </div>
        </div>

        <div
          className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${
            filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <label className="block">
                <span className="sr-only">Cerca evento</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cerca per titolo, formato o tag"
                  className="h-11 w-full rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-4 text-sm text-[#211815] outline-none transition placeholder:text-[#5f524c]/60 focus:border-[#8b5e4a]/60 focus:bg-white/70"
                />
              </label>
              <FilterGroup
                label="Categoria"
                options={categoryFilters}
                value={category}
                onChange={(value) => setCategory(value)}
              />
              <FilterGroup
                label="Periodo"
                options={periodFilters}
                value={period}
                onChange={(value) => setPeriod(value)}
              />
            </div>

            {availableTags.length ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setActiveTags([])}
                  className={tagButtonClass(activeTags.length === 0)}
                >
                  Tutti i tag
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={tagButtonClass(activeTags.includes(tag))}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!hasResults ? (
        <div className="mt-6 rounded-[8px] border border-[#211815]/10 bg-white/45 p-6">
          <h2 className="font-serif text-3xl font-medium leading-[1.08] tracking-normal">
            Nessun evento trovato con questi filtri.
          </h2>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 mr-2 inline-flex rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815]"
          >
            Reset filtri
          </button>
          <Link
            href={ticketTailorUrl}
            className="mt-5 inline-flex rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
          >
            Apri Ticket Tailor
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-medium leading-none">
                  Calendario mensile
                </h2>
                <p className="mt-1 text-xs text-[#5f524c]">
                  {formatMonthLabel(visibleMonth)} · {filteredEvents.length} eventi filtrati
                </p>
              </div>
              <button
                type="button"
                aria-expanded={calendarOpen}
                onClick={() => setCalendarOpen((open) => !open)}
                className="rounded-full bg-[#211815] px-4 py-2 text-xs font-medium text-white transition hover:-translate-y-0.5"
              >
                {calendarOpen ? "Nascondi calendario" : "Mostra calendario"}
              </button>
            </div>

            <div
              className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${
                calendarOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="rounded-[8px] border border-[#211815]/10 bg-white/45 p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setVisibleMonth(shiftMonth(visibleMonth, -1))}
                        className="grid h-10 w-10 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/60 text-lg text-[#8b5e4a] transition hover:bg-white/70"
                        aria-label="Mese precedente"
                      >
                        ‹
                      </button>
                      <h3 className="font-serif text-3xl font-medium capitalize leading-[1.05] md:text-4xl">
                        {formatMonthLabel(visibleMonth)}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
                        className="grid h-10 w-10 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/60 text-lg text-[#8b5e4a] transition hover:bg-white/70"
                        aria-label="Mese successivo"
                      >
                        ›
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                      {["L", "M", "M", "G", "V", "S", "D"].map((day, index) => (
                        <span key={`${day}-${index}`}>{day}</span>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                      {monthCells.map((cell) => (
                        <button
                          key={cell.date}
                          type="button"
                          disabled={!cell.inMonth}
                          onClick={() => setSelectedDay(cell.date)}
                          className={dayButtonClass({
                            isSelected: cell.date === effectiveSelectedDay,
                            hasEvents: cell.events.length > 0,
                            inMonth: cell.inMonth,
                          })}
                        >
                          <span>{Number(cell.date.slice(-2))}</span>
                          {cell.events.length ? (
                            <span className="mt-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#8b5e4a]/15 px-1 text-[10px] font-semibold text-[#8b5e4a]">
                              {cell.events.length}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-[#211815]/10 bg-white/45 p-4 md:p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                      Giorno selezionato
                    </p>
                    <h3 className="mt-2 font-serif text-3xl font-medium leading-[1.06] md:text-4xl">
                      Eventi del {formatDayTitle(effectiveSelectedDay)}
                    </h3>
                    <div className="mt-4 grid gap-3">
                      {selectedDayEvents.length ? (
                        selectedDayEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            ticketTailorUrl={ticketTailorUrl}
                            compact
                          />
                        ))
                      ) : (
                        <p className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4 text-sm text-[#5f524c]">
                          Nessun evento in questa data.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-7 grid gap-5">
            {sectionMeta.map((section) => {
              const sectionEvents =
                section.key === "upcoming"
                  ? filteredEvents.slice(0, 12)
                  : filteredEvents.filter((event) =>
                      section.key === "workshop"
                        ? isWorkshopEvent(event)
                        : event.category === section.category,
                    );

              if (!sectionEvents.length) {
                return null;
              }

              return (
                <EventRail
                  key={section.key}
                  title={section.title}
                  subtitle={section.subtitle}
                  events={sectionEvents}
                  open={openSections[section.key]}
                  onToggle={() =>
                    setOpenSections((current) => ({
                      ...current,
                      [section.key]: !current[section.key],
                    }))
                  }
                  ticketTailorUrl={ticketTailorUrl}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b5e4a] md:sr-only">
        {label}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:max-w-[360px] [&::-webkit-scrollbar]:hidden">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={filterButtonClass(value === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EventRail({
  title,
  subtitle,
  events,
  open,
  onToggle,
  ticketTailorUrl,
}: {
  title: string;
  subtitle: string;
  events: PeonyEvent[];
  open: boolean;
  onToggle: () => void;
  ticketTailorUrl: string;
}) {
  return (
    <section className="rounded-[8px] border border-[#211815]/10 bg-white/35 p-4 md:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-medium leading-[1.05] md:text-4xl">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-[1.6] text-[#5f524c]">
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/60 text-xl leading-none text-[#8b5e4a] transition hover:bg-white/70"
        >
          {open ? "−" : "+"}
        </button>
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [scrollbar-color:#8b5e4a33_transparent]">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                ticketTailorUrl={ticketTailorUrl}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventCard({
  event,
  ticketTailorUrl,
  compact = false,
}: {
  event: PeonyEvent;
  ticketTailorUrl: string;
  compact?: boolean;
}) {
  const image = event.imageUrl ?? getFallbackImage(event);
  const detailHref = event.workshopSlug
    ? `/workshop/${event.workshopSlug}`
    : `/eventi/${event.slug}`;

  return (
    <article
      className={`group shrink-0 overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/70 shadow-[0_1px_0_rgba(33,24,21,0.04)] transition hover:-translate-y-[2px] hover:shadow-[0_10px_24px_rgba(33,24,21,0.08)] ${
        compact
          ? "grid gap-3 md:grid-cols-[180px_1fr]"
          : "w-[min(78vw,300px)] [scroll-snap-align:start]"
      }`}
    >
      <Link
        href={detailHref}
        className="relative block overflow-hidden bg-[#efe4d7]"
      >
        <Image
          src={image}
          alt={event.title}
          width={640}
          height={360}
          className={`w-full object-cover saturate-[0.92] transition duration-700 group-hover:scale-105 ${
            compact ? "h-32 md:h-full md:min-h-36" : "h-32 md:h-40"
          }`}
        />
      </Link>
      <div className="flex min-w-0 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-2.5 py-1 text-[11px] font-medium capitalize text-[#8b5e4a]">
            {categoryLabel(event.category)}
          </span>
          <span className="text-xs font-semibold text-[#5f524c]">
            {formatCalendarDay(event.date)}
          </span>
        </div>
        <Link href={detailHref} className="mt-2 block">
          <h3 className="font-serif text-2xl font-medium leading-[1.08] tracking-normal text-[#211815]">
            {event.title}
          </h3>
        </Link>
        {event.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#8b5e4a]/10 px-2 py-1 text-[10px] leading-none text-[#5f524c]"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {event.shortDescription ? (
          <p className="mt-2 overflow-hidden text-sm leading-[1.5] text-[#5f524c] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {event.shortDescription}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={detailHref}
            className="inline-flex w-fit rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-4 py-2 text-sm font-medium text-[#211815] transition hover:bg-white/70"
          >
            Dettagli
          </Link>
          <Link
            href={event.bookingUrl ?? ticketTailorUrl}
            className="inline-flex w-fit rounded-full bg-[#211815] px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
          >
            Prenota
          </Link>
        </div>
      </div>
    </article>
  );
}

function filterButtonClass(active: boolean) {
  return `shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition ${
    active
      ? "border-[#211815] bg-[#211815] text-white"
      : "border-[#211815]/10 bg-[#f4efe8]/70 text-[#5f524c] hover:bg-white/70"
  }`;
}

function tagButtonClass(active: boolean) {
  return `shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
    active
      ? "border-[#8b5e4a] bg-[#8b5e4a]/12 text-[#8b5e4a]"
      : "border-[#211815]/10 bg-[#f4efe8]/70 text-[#5f524c] hover:bg-white/70"
  }`;
}

function dayButtonClass({
  isSelected,
  hasEvents,
  inMonth,
}: {
  isSelected: boolean;
  hasEvents: boolean;
  inMonth: boolean;
}) {
  return `flex min-h-[58px] flex-col items-center justify-center rounded-[8px] border text-sm transition md:min-h-[66px] ${
    isSelected
      ? "border-[#211815] bg-[#211815] text-white"
      : hasEvents
        ? "border-[#8b5e4a]/35 bg-white/70 text-[#211815] hover:border-[#8b5e4a]"
        : "border-[#211815]/5 bg-[#f4efe8]/45 text-[#5f524c]"
  } ${inMonth ? "" : "opacity-30"}`;
}

function getFilterSummary({
  query,
  category,
  period,
  activeTags,
}: {
  query: string;
  category: CategoryFilter;
  period: PeriodFilter;
  activeTags: string[];
}) {
  const parts = [];
  const categoryLabel = categoryFilters.find((item) => item.value === category)?.label;
  const periodLabel = periodFilters.find((item) => item.value === period)?.label;

  if (category !== "all" && categoryLabel) {
    parts.push(categoryLabel);
  }

  if (period !== "all" && periodLabel) {
    parts.push(periodLabel);
  }

  if (activeTags.length) {
    parts.push(`${activeTags.length} tag`);
  }

  if (query.trim()) {
    parts.push(`"${query.trim()}"`);
  }

  return parts.length ? parts.join(" · ") : "Nessun filtro attivo";
}

function getMonthCells(monthKey: string, eventsByDay: Map<string, PeonyEvent[]>) {
  const [year, month] = monthKey.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = toIsoDate(date);

    return {
      date: iso,
      inMonth: iso.startsWith(monthKey),
      events: eventsByDay.get(iso) ?? [],
    };
  });
}

function groupEventsByDate(events: PeonyEvent[]) {
  return events.reduce<Map<string, PeonyEvent[]>>((map, event) => {
    const list = map.get(event.date) ?? [];
    list.push(event);
    map.set(event.date, list.sort(compareEvents));
    return map;
  }, new Map());
}

function matchesPeriod(date: string, period: PeriodFilter, today: string) {
  if (period === "all" || period === "season") {
    return true;
  }

  const limit = new Date(`${today}T12:00:00`);
  limit.setDate(limit.getDate() + Number(period));

  return date <= toIsoDate(limit);
}

function compareEvents(a: PeonyEvent, b: PeonyEvent) {
  return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return toIsoDate(date).slice(0, 7);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatDayTitle(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function formatCalendarDay(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

function categoryLabel(category: PeonyEventCategory) {
  if (category === "percorso") {
    return "Percorso";
  }

  if (category === "pratica") {
    return "Pratica";
  }

  if (category === "community") {
    return "Community";
  }

  if (category === "workshop") {
    return "Workshop";
  }

  return "Evento";
}

function getFallbackImage(event: PeonyEvent) {
  const title = event.title.toLowerCase();

  if (title.includes("rope jam")) {
    return "/images/home/event-rope-jam.jpg";
  }

  if (title.includes("foundation")) {
    return "/images/home/event-foundation.jpg";
  }

  if (
    title.includes("pratica") ||
    title.includes("classe tematica") ||
    title.includes("classi tematiche")
  ) {
    return "/images/home/event-practice.jpg";
  }

  return "/images/home/event-class.jpg";
}
