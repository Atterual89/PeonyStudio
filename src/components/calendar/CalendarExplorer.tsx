"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useLanguage } from "@/components/site/LanguageProvider";
import { EventImage } from "@/components/shared/EventImage";
import { EventsNetflixLayout } from "@/components/shared/EventsNetflixLayout";
import type { Dictionary } from "@/i18n/getDictionary";
import {
  isWorkshopEvent,
  type PeonyEvent,
  type PeonyEventCard,
  type PeonyEventCategory,
} from "@/lib/events";

type CalendarExplorerProps = {
  events: PeonyEvent[];
  ticketTailorUrl: string;
};

type CategoryFilter = "all" | "percorso" | "pratica" | "community" | "workshop";
type PeriodFilter = "all" | "30" | "90" | "season";
type CalendarCopy = Dictionary["calendar"];

const suggestedTags = [
  "anche per single",
  "observer ammessi",
  "principianti",
  "con demo",
  "bottom",
];

const MOBILE_PERIODS = [
  { label: "Tutto", value: "all" },
  { label: "Questo mese", value: "month" },
  { label: "Prossimi 3 mesi", value: "90days" },
] as const;
type MobilePeriod = (typeof MOBILE_PERIODS)[number]["value"];

export function CalendarExplorer({
  events,
  ticketTailorUrl,
}: CalendarExplorerProps) {
  const { dictionary, locale } = useLanguage();
  const copy = dictionary.calendar;
  const categoryFilterOptions: { label: string; value: CategoryFilter }[] = [
    { label: copy.filtersList.all, value: "all" },
    { label: copy.filtersList.programs, value: "percorso" },
    { label: copy.filtersList.practice, value: "pratica" },
    { label: copy.filtersList.community, value: "community" },
    { label: copy.filtersList.workshops, value: "workshop" },
  ];
  const periodFilterOptions: { label: string; value: PeriodFilter }[] = [
    { label: copy.filtersList.all, value: "all" },
    { label: copy.filtersList.next30, value: "30" },
    { label: copy.filtersList.next90, value: "90" },
    { label: copy.filtersList.season, value: "season" },
  ];
  const sectionItems = [
    { key: "upcoming", ...copy.sections.upcoming },
    { key: "percorso", ...copy.sections.percorso, category: "percorso" },
    { key: "pratica", ...copy.sections.pratica, category: "pratica" },
    { key: "community", ...copy.sections.community, category: "community" },
    { key: "workshop", ...copy.sections.workshop, category: "workshop" },
  ] satisfies Array<{
    key: string;
    title: string;
    subtitle: string;
    category?: PeonyEventCategory;
  }>;
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

  // mobile-only state
  const [mobileQuery, setMobileQuery] = useState("");
  const [mobilePeriod, setMobilePeriod] = useState<MobilePeriod>("all");
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);
  const [mobileVisibleMonth, setMobileVisibleMonth] = useState(() =>
    getMonthKey(getTodayIso()),
  );
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string | null>(
    null,
  );

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

  const mobileEvents = useMemo(
    () =>
      sortedEvents
        .filter((event) => event.date >= today)
        .map(toNetflixCard),
    [sortedEvents, today],
  );

  const mobileEventDays = useMemo(
    () => new Set(mobileEvents.map((e) => e.date)),
    [mobileEvents],
  );

  const mobileMonthCells = useMemo(
    () => getMobileMonthCells(mobileVisibleMonth, mobileEventDays),
    [mobileVisibleMonth, mobileEventDays],
  );

  const filteredMobileEvents = useMemo(() => {
    if (mobilePeriod === "all") return mobileEvents;
    if (mobilePeriod === "month") {
      const monthKey = today.slice(0, 7);
      return mobileEvents.filter((e) => e.date.startsWith(monthKey));
    }
    const limit = new Date(`${today}T12:00:00`);
    limit.setDate(limit.getDate() + 90);
    const limitIso = toIsoDate(limit);
    return mobileEvents.filter((e) => e.date <= limitIso);
  }, [mobileEvents, mobilePeriod, today]);

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
    categoryFilters: categoryFilterOptions,
    period,
    periodFilters: periodFilterOptions,
    activeTags,
    noActiveFilters: copy.noActiveFilters,
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
      {/* ── MOBILE: Layer 1 + 2 + 3 ── */}
      <div className="md:hidden">

        {/* Layer 1 — Ricerca */}
        <div className="mb-4">
          <input
            value={mobileQuery}
            onChange={(e) => setMobileQuery(e.target.value)}
            placeholder="Cerca eventi..."
            className="w-full border-b border-[#1a1510]/20 bg-transparent py-2 font-sans text-sm text-[#1a1510] outline-none transition-colors placeholder:text-[#6b5c52]/60 focus:border-[#8b5e4a]"
          />
        </div>

        {/* Layer 1 — Filtro periodo */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MOBILE_PERIODS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMobilePeriod(value);
                setMobileSelectedDay(null);
              }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition ${
                mobilePeriod === value
                  ? "bg-[#1a1510] text-[#f5efea]"
                  : "border border-[#1a1510]/20 bg-transparent text-[#6b5c52]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Layer 2 — Calendario collassabile */}
        <div className="mb-5">
          {/* toggle: NON tocca mobileSelectedDay */}
          <button
            type="button"
            onClick={() => setMobileCalendarOpen((o) => !o)}
            className="flex w-full items-center justify-between border-b border-[#1a1510]/15 pb-2 font-sans text-xs uppercase tracking-widest text-[#6b5c52]"
          >
            <span>
              Calendario
              {mobileSelectedDay !== null && (
                <span className="ml-2 text-[#8b5e4a]">·</span>
              )}
            </span>
            <span aria-hidden="true">{mobileCalendarOpen ? "↑" : "↓"}</span>
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ${
              mobileCalendarOpen ? "max-h-[320px]" : "max-h-0"
            }`}
          >
            <div className="pt-3">
              {/* navigazione mese */}
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMobileVisibleMonth((m) => shiftMonth(m, -1))}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[#1a1510]/15 text-sm text-[#8b5e4a] transition hover:bg-white/60"
                  aria-label="Mese precedente"
                >
                  ‹
                </button>
                <span className="font-sans text-xs font-medium capitalize text-[#1a1510]">
                  {formatMonthLabel(mobileVisibleMonth, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileVisibleMonth((m) => shiftMonth(m, 1))}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[#1a1510]/15 text-sm text-[#8b5e4a] transition hover:bg-white/60"
                  aria-label="Mese successivo"
                >
                  ›
                </button>
              </div>

              {/* intestazioni giorni */}
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[9px] uppercase tracking-wider text-[#8b5e4a]">
                {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => (
                  <span key={`${d}-${i}`}>{d}</span>
                ))}
              </div>

              {/* celle giorni */}
              <div className="grid grid-cols-7 gap-0.5">
                {mobileMonthCells.map((cell) => (
                  <div key={cell.iso} className="flex justify-center">
                    {cell.inMonth ? (
                      <button
                        type="button"
                        onClick={() =>
                          setMobileSelectedDay((prev) =>
                            prev === cell.iso ? null : cell.iso,
                          )
                        }
                        className={`flex h-7 w-7 flex-col items-center justify-center rounded-full text-[11px] font-medium transition ${
                          mobileSelectedDay === cell.iso
                            ? "bg-[#1a1510] text-[#f5efea]"
                            : cell.hasEvents
                              ? "text-[#1a1510] hover:bg-[#1a1510]/8"
                              : "text-[#6b5c52]/40"
                        }`}
                      >
                        <span className="leading-none">{cell.day}</span>
                        {cell.hasEvents ? (
                          <span
                            className={`mt-0.5 h-[3px] w-[3px] rounded-full ${
                              mobileSelectedDay === cell.iso
                                ? "bg-[#f5efea]/70"
                                : "bg-[#8b5e4a]"
                            }`}
                          />
                        ) : null}
                      </button>
                    ) : (
                      <span className="h-7 w-7" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* deseleziona giorno — visibile solo quando selectedDay è attivo */}
        {mobileSelectedDay !== null && (
          <div className="mb-3 flex items-center justify-between rounded-[8px] border border-[#1a1510]/10 bg-white/50 px-3 py-2">
            <span className="font-sans text-xs text-[#6b5c52]">
              {formatDayTitle(mobileSelectedDay, locale)}
            </span>
            <button
              type="button"
              onClick={() => setMobileSelectedDay(null)}
              className="rounded-full border border-[#1a1510]/15 px-3 py-1 font-sans text-[10px] text-[#6b5c52] transition hover:bg-white/80"
            >
              × Deseleziona
            </button>
          </div>
        )}

        {/* Layer 3 — Netflix layout
            selectedDay null  → layout Netflix (periodo selezionato)
            selectedDay attivo → lista flat eventi del giorno */}
        <EventsNetflixLayout
          events={filteredMobileEvents}
          searchQuery={mobileQuery}
          selectedDay={mobileSelectedDay}
        />
      </div>

      {/* desktop: layout calendario invariato */}
      <div className="hidden md:block">
      <div className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-medium leading-none">
              {copy.filters}
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
                {copy.resetFilters}
              </button>
            ) : null}
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className="rounded-full bg-[#211815] px-4 py-2 text-xs font-medium text-white transition hover:-translate-y-0.5"
            >
              {filtersOpen ? copy.hideFilters : copy.showFilters}
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
                <span className="sr-only">{copy.searchEvent}</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="h-11 w-full rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-4 text-sm text-[#211815] outline-none transition placeholder:text-[#5f524c]/60 focus:border-[#8b5e4a]/60 focus:bg-white/70"
                />
              </label>
              <FilterGroup
                label={copy.category}
                options={categoryFilterOptions}
                value={category}
                onChange={(value) => setCategory(value)}
              />
              <FilterGroup
                label={copy.period}
                options={periodFilterOptions}
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
                  {copy.allTags}
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
            {copy.noResults}
          </h2>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-5 mr-2 inline-flex rounded-full border border-[#211815]/20 bg-[#f4efe8]/70 px-5 py-3 text-sm font-medium text-[#211815]"
          >
            {copy.resetFilters}
          </button>
          <Link
            href={ticketTailorUrl}
            className="mt-5 inline-flex rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
          >
            {copy.openTicketTailor}
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-medium leading-none">
                  {copy.monthlyCalendar}
                </h2>
                <p className="mt-1 text-xs text-[#5f524c]">
                  {formatMonthLabel(visibleMonth, locale)} Â· {filteredEvents.length} {copy.filteredEvents}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={calendarOpen}
                onClick={() => setCalendarOpen((open) => !open)}
                className="rounded-full bg-[#211815] px-4 py-2 text-xs font-medium text-white transition hover:-translate-y-0.5"
              >
                {calendarOpen ? copy.hideCalendar : copy.showCalendar}
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
                        aria-label={copy.previousMonth}
                      >
                        â€¹
                      </button>
                      <h3 className="font-serif text-3xl font-medium capitalize leading-[1.05] md:text-4xl">
                        {formatMonthLabel(visibleMonth, locale)}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setVisibleMonth(shiftMonth(visibleMonth, 1))}
                        className="grid h-10 w-10 place-items-center rounded-full border border-[#211815]/10 bg-[#f4efe8]/60 text-lg text-[#8b5e4a] transition hover:bg-white/70"
                        aria-label={copy.nextMonth}
                      >
                        â€º
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
                      {copy.selectedDay}
                    </p>
                    <h3 className="mt-2 font-serif text-3xl font-medium leading-[1.06] md:text-4xl">
                      {copy.eventsOf} {formatDayTitle(effectiveSelectedDay, locale)}
                    </h3>
                    <div className="mt-4 grid gap-3">
                      {selectedDayEvents.length ? (
                        selectedDayEvents.map((event) => (
                          <EventCard
                            key={event.id}
                            event={event}
                            copy={copy}
                            locale={locale}
                            ticketTailorUrl={ticketTailorUrl}
                            compact
                          />
                        ))
                      ) : (
                        <p className="rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/60 p-4 text-sm text-[#5f524c]">
                          {copy.noEventsDay}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-7 grid gap-5">
            {sectionItems.map((section) => {
              const sectionCategory =
                "category" in section ? section.category : undefined;
              const sectionEvents =
                section.key === "upcoming"
                  ? filteredEvents.slice(0, 12)
                  : filteredEvents.filter((event) =>
                      section.key === "workshop"
                        ? isWorkshopEvent(event)
                        : event.category === sectionCategory,
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
                  copy={copy}
                  locale={locale}
                />
              );
            })}
          </div>
        </>
      )}
      </div>
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
  copy,
  locale,
}: {
  title: string;
  subtitle: string;
  events: PeonyEvent[];
  open: boolean;
  onToggle: () => void;
  ticketTailorUrl: string;
  copy: CalendarCopy;
  locale: string;
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
          {open ? "âˆ’" : "+"}
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
                copy={copy}
                locale={locale}
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
  copy,
  locale,
  compact = false,
}: {
  event: PeonyEvent;
  ticketTailorUrl: string;
  copy: CalendarCopy;
  locale: string;
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
        <EventImage
          src={image}
          alt={event.title}
          variant={compact ? "compact" : "card"}
          className={
            compact ? "h-32 md:h-full md:min-h-36" : "h-32 md:h-40"
          }
        />
      </Link>
      <div className="flex min-w-0 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-2.5 py-1 text-[11px] font-medium capitalize text-[#8b5e4a]">
            {categoryLabel(event.category, copy)}
          </span>
          <span className="text-xs font-semibold text-[#5f524c]">
            {formatCalendarDay(event.date, locale)}
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
            {copy.details}
          </Link>
          <Link
            href={event.bookingUrl ?? ticketTailorUrl}
            className="inline-flex w-fit rounded-full bg-[#211815] px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5"
          >
            {copy.book}
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
  categoryFilters,
  period,
  periodFilters,
  activeTags,
  noActiveFilters,
}: {
  query: string;
  category: CategoryFilter;
  categoryFilters: { label: string; value: CategoryFilter }[];
  period: PeriodFilter;
  periodFilters: { label: string; value: PeriodFilter }[];
  activeTags: string[];
  noActiveFilters: string;
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

  return parts.length ? parts.join(" · ") : noActiveFilters;
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

function formatMonthLabel(monthKey: string, locale: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "it-IT", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatDayTitle(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "it-IT", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function formatCalendarDay(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

function categoryLabel(category: PeonyEventCategory, copy: CalendarCopy) {
  if (category === "percorso") {
    return copy.categoryLabels.percorso;
  }

  if (category === "pratica") {
    return copy.categoryLabels.pratica;
  }

  if (category === "community") {
    return copy.categoryLabels.community;
  }

  if (category === "workshop") {
    return copy.categoryLabels.workshop;
  }

  return copy.categoryLabels.altro;
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

function getMobileMonthCells(
  monthKey: string,
  eventDays: Set<string>,
): { iso: string; day: number; inMonth: boolean; hasEvents: boolean }[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    const iso = toIsoDate(d);
    return {
      iso,
      day: d.getDate(),
      inMonth: iso.startsWith(monthKey),
      hasEvents: eventDays.has(iso),
    };
  });
}

function toNetflixCard(event: PeonyEvent): PeonyEventCard {
  const detailHref = event.workshopSlug
    ? `/workshop/${event.workshopSlug}`
    : `/eventi/${event.slug}`;
  return {
    slug: event.slug,
    category: event.category,
    title: event.title,
    date: event.date, // ISO YYYY-MM-DD — formattato da tryFormatDate nel componente
    detail: event.shortDescription,
    image: event.imageUrl ?? getFallbackImage(event),
    eventUrl: detailHref,
    bookingUrl: event.bookingUrl,
  };
}
