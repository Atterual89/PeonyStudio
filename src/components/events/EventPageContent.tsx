"use client";

import Link from "next/link";

import { EventImage } from "@/components/shared/EventImage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { useLanguage } from "@/components/site/LanguageProvider";
import type { PeonyEvent, PeonyEventCategory } from "@/lib/events";

type EventPageContentProps = {
  event: PeonyEvent;
  relatedEvents: PeonyEvent[];
  image: string;
  bookingUrl: string;
  visibleTags: string[];
};

type EvDict = {
  labelDate: string;
  labelDuration: string;
  labelTime: string;
  labelCategory: string;
  labelLevel: string;
  labelPrerequisites: string;
  labelPartner: string;
  labelObserver: string;
  labelInstructors: string;
  levelBeginner: string;
  levelAdvanced: string;
  levelIntermediate: string;
  levelVariable: string;
  partnerOptional: string;
  observerWelcome: string;
  prerequisitesRequired: string;
  prerequisitesNone: string;
  details: string;
  descriptionFallback: string;
  bookOnTicketTailor: string;
  backToCalendar: string;
  quickInfoTitle: string;
  quickInfoSubtitle: string;
  briefTitle: string;
  bookDetails: string;
  related: string;
  otherDates: string;
};

export function EventPageContent({
  event,
  relatedEvents,
  image,
  bookingUrl,
  visibleTags,
}: EventPageContentProps) {
  const { dictionary, locale } = useLanguage();
  const ev = dictionary.event as unknown as EvDict;
  const calCopy = dictionary.calendar;

  const quickInfo = getQuickInfo(event, ev, calCopy.categoryLabels);
  const briefDescription =
    event.shortDescription ??
    (event.description ? truncateText(event.description, 280) : undefined) ??
    ev.descriptionFallback;

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-8 sm:px-6 md:pb-10 md:pt-12">
        <div className="grid gap-5 rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:grid-cols-[0.96fr_1.04fr] md:items-stretch md:p-4">
          <div className="relative min-h-[210px] overflow-hidden rounded-[8px] border border-[#211815]/10 bg-[#efe4d7] md:min-h-[360px]">
            <EventImage
              src={image}
              alt={event.title}
              variant="hero"
              className="h-[220px] w-full md:h-full"
              priority
            />
          </div>

          <div className="flex flex-col justify-between p-1 md:p-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#8b5e4a]/20 bg-[#8b5e4a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                  {calCopy.categoryLabels[event.category] ?? event.category}
                </span>
                <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                  {event.dateLabel ?? formatDateRange(event, locale)}
                  {event.timeLabel ? ` · ${event.timeLabel}` : ""}
                </span>
              </div>

              <h1 className="mt-4 max-w-3xl font-serif text-[clamp(38px,7vw,72px)] font-medium leading-[0.98] tracking-normal">
                {event.title}
              </h1>

              {visibleTags.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {visibleTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#211815]/10 bg-white/55 px-2.5 py-1 text-[11px] text-[#5f524c]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Link
                href={bookingUrl}
                className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(33,24,21,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(33,24,21,0.22)]"
              >
                {ev.bookOnTicketTailor}
              </Link>
              <Link
                href="/calendario"
                className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-white/55 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/80"
              >
                {ev.backToCalendar}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10 sm:px-6 md:pb-14">
        <div className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
          <section className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-4 md:p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                  {ev.quickInfoTitle}
                </p>
                <h2 className="mt-1 font-serif text-3xl font-medium leading-[1.06] md:text-4xl">
                  {ev.quickInfoSubtitle}
                </h2>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
              {quickInfo.map((item) => (
                <div
                  key={item.label}
                  className="min-h-[82px] rounded-[8px] border border-[#211815]/10 bg-[#f4efe8]/65 p-3"
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-[1.35] text-[#211815]">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-[8px] border border-[#211815]/10 bg-white/38 p-4 md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
              {ev.briefTitle}
            </p>
            <p className="mt-3 text-[15px] leading-[1.7] text-[#5f524c]">
              {briefDescription}
            </p>
            <div className="mt-5">
              <Link
                href={bookingUrl}
                className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
              >
                {ev.bookDetails}
              </Link>
            </div>
          </section>
        </div>
      </section>

      {relatedEvents.length ? (
        <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-6 md:pb-16">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
                {ev.related}
              </p>
              <h2 className="mt-1 font-serif text-3xl font-medium leading-[1.05] md:text-4xl">
                {ev.otherDates}
              </h2>
            </div>
            <Link
              href="/calendario"
              className="shrink-0 text-sm font-medium text-[#8b5e4a] transition hover:translate-x-1"
            >
              {calCopy.heroTitle}
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [scrollbar-color:#8b5e4a33_transparent]">
            {relatedEvents.map((item) => (
              <RelatedEventCard key={item.id} event={item} locale={locale} evDict={ev} calDict={calCopy} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function RelatedEventCard({
  event,
  locale,
  evDict,
  calDict,
}: {
  event: PeonyEvent;
  locale: string;
  evDict: EvDict;
  calDict: { categoryLabels: Record<string, string>; heroTitle: string };
}) {
  return (
    <Link
      href={`/eventi/${event.slug}`}
      className="group grid w-[min(84vw,420px)] shrink-0 grid-cols-[116px_1fr] overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/60 [scroll-snap-align:start] transition hover:-translate-y-0.5 hover:bg-white/75 md:w-[420px] md:grid-cols-[140px_1fr]"
    >
      <div className="relative overflow-hidden bg-[#efe4d7]">
        <EventImage
          src={event.imageUrl ?? getFallbackImage(event)}
          alt={event.title}
          variant="compact"
          className="h-full min-h-[132px] w-full"
        />
      </div>
      <div className="min-w-0 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#8b5e4a]/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#8b5e4a]">
            {calDict.categoryLabels[event.category] ?? event.category}
          </span>
          <span className="text-xs text-[#5f524c]">
            {formatShortDate(event.date, locale)}
          </span>
        </div>
        <h3 className="mt-2 overflow-hidden font-serif text-xl font-medium leading-[1.08] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] md:text-2xl">
          {event.title}
        </h3>
        <span className="mt-3 inline-flex text-sm font-medium text-[#8b5e4a]">
          {evDict.details}
        </span>
      </div>
    </Link>
  );
}

function getQuickInfo(
  event: PeonyEvent,
  ev: EvDict,
  categoryLabels: Record<string, string>,
) {
  const tags = new Set((event.tags ?? []).map((tag) => tag.toLowerCase()));
  const level = inferLevel(tags, event.category, ev);
  const items: { label: string; value: string }[] = [
    { label: ev.labelDate, value: event.dateLabel ?? formatShortDate(event.date, "it") },
  ];

  if (event.durationLabel) {
    items.push({ label: ev.labelDuration, value: event.durationLabel });
  }

  if (event.timeLabel) {
    items.push({ label: ev.labelTime, value: event.timeLabel });
  }

  items.push({ label: ev.labelCategory, value: categoryLabels[event.category] ?? event.category });

  if (level) {
    items.push({ label: ev.labelLevel, value: level });
  } else {
    const prerequisites = inferPrerequisites(tags, ev);
    if (prerequisites) items.push({ label: ev.labelPrerequisites, value: prerequisites });
  }

  const partner = inferPartner(tags, ev);
  if (partner) items.push({ label: ev.labelPartner, value: partner });

  const observer = inferObserver(tags, ev);
  if (observer) items.push({ label: ev.labelObserver, value: observer });

  const instructors = inferInstructors(tags);
  if (instructors) items.push({ label: ev.labelInstructors, value: instructors });

  return items;
}

function inferLevel(tags: Set<string>, category: PeonyEventCategory, ev: EvDict) {
  if (tags.has("principianti")) return ev.levelBeginner;
  if (tags.has("avanzato")) return ev.levelAdvanced;
  if (tags.has("richiede basi")) return ev.levelIntermediate;
  if (category === "workshop") return ev.levelVariable;
  return "";
}

function inferPartner(tags: Set<string>, ev: EvDict) {
  return tags.has("anche per single") ? ev.partnerOptional : "";
}

function inferObserver(tags: Set<string>, ev: EvDict) {
  return tags.has("observer ammessi") ? ev.observerWelcome : "";
}

function inferInstructors(tags: Set<string>) {
  if (tags.has("peter soptik") && tags.has("sansei")) return "Peter Soptik e Sansei";
  if (tags.has("peter soptik")) return "Peter Soptik";
  if (tags.has("sansei")) return "Sansei";
  return "";
}

function inferPrerequisites(tags: Set<string>, ev: EvDict) {
  if (tags.has("richiede basi")) return ev.prerequisitesRequired;
  if (tags.has("principianti")) return ev.prerequisitesNone;
  return "";
}

function formatDateRange(event: PeonyEvent, locale: string) {
  if (event.endDate && event.endDate !== event.date) {
    return `${formatShortDate(event.date, locale)} - ${formatShortDate(event.endDate, locale)}`;
  }
  return formatShortDate(event.date, locale);
}

function formatShortDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+02:00`));
}

function getFallbackImage(event: PeonyEvent) {
  const title = event.title.toLowerCase();
  if (title.includes("rope jam")) return "/images/home/event-rope-jam.jpg";
  if (title.includes("foundation")) return "/images/home/event-foundation.jpg";
  if (title.includes("pratica") || title.includes("classe tematica") || title.includes("classi tematiche"))
    return "/images/home/event-practice.jpg";
  return "/images/home/event-class.jpg";
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…";
}
