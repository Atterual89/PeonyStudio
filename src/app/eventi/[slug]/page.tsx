import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HomeFooter } from "@/components/home/HomeFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { homeContent } from "@/content/home";
import {
  getPublicEvents,
  truncateText,
  type PeonyEvent,
  type PeonyEventCategory,
} from "@/lib/events";
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
  const quickInfo = getQuickInfo(event);
  const visibleTags = getVisibleTags(event.tags ?? []);
  const briefDescription = getBriefDescription(event);

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-8 pt-8 sm:px-6 md:pb-10 md:pt-12">
        <div className="grid gap-5 rounded-[8px] border border-[#211815]/10 bg-white/38 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:grid-cols-[0.96fr_1.04fr] md:items-stretch md:p-4">
          <div className="relative min-h-[210px] overflow-hidden rounded-[8px] border border-[#211815]/10 bg-[#efe4d7] md:min-h-[360px]">
            <Image
              src={image}
              alt={event.title}
              width={980}
              height={560}
              className="h-[220px] w-full object-cover saturate-[0.94] md:h-full"
              priority
            />
          </div>

          <div className="flex flex-col justify-between p-1 md:p-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#8b5e4a]/20 bg-[#8b5e4a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b5e4a]">
                  {categoryLabel(event.category)}
                </span>
                <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-3 py-1 text-xs font-medium text-[#5f524c]">
                  {event.dateLabel ?? formatDateRange(event)}
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
                Prenota su Ticket Tailor
              </Link>
              <Link
                href="/calendario"
                className="inline-flex justify-center rounded-full border border-[#211815]/15 bg-white/55 px-5 py-3 text-sm font-medium text-[#211815] transition hover:bg-white/80"
              >
                Torna al calendario
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
                  Info rapide
                </p>
                <h2 className="mt-1 font-serif text-3xl font-medium leading-[1.06] md:text-4xl">
                  Prima di prenotare
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
              In breve
            </p>
            <p className="mt-3 text-[15px] leading-[1.7] text-[#5f524c]">
              {briefDescription}
            </p>
            <div className="mt-5">
              <Link
                href={bookingUrl}
                className="inline-flex justify-center rounded-full bg-[#211815] px-5 py-3 text-sm font-medium text-white"
              >
                Prenota / leggi i dettagli su Ticket Tailor
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
                Correlati
              </p>
              <h2 className="mt-1 font-serif text-3xl font-medium leading-[1.05] md:text-4xl">
                Altre date vicine
              </h2>
            </div>
            <Link
              href="/calendario"
              className="shrink-0 text-sm font-medium text-[#8b5e4a] transition hover:translate-x-1"
            >
              Calendario
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [scrollbar-color:#8b5e4a33_transparent]">
            {relatedEvents.map((item) => (
              <RelatedEventCard key={item.id} event={item} />
            ))}
          </div>
        </section>
      ) : null}

      <HomeFooter content={homeContent.footer} />
    </main>
  );
}

function RelatedEventCard({ event }: { event: PeonyEvent }) {
  return (
    <Link
      href={`/eventi/${event.slug}`}
      className="group grid w-[min(84vw,420px)] shrink-0 grid-cols-[116px_1fr] overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/60 [scroll-snap-align:start] transition hover:-translate-y-0.5 hover:bg-white/75 md:w-[420px] md:grid-cols-[140px_1fr]"
    >
      <div className="relative overflow-hidden bg-[#efe4d7]">
        <Image
          src={event.imageUrl ?? getFallbackImage(event)}
          alt={event.title}
          width={420}
          height={260}
          className="h-full min-h-[132px] w-full object-cover saturate-[0.94] transition duration-700 group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#8b5e4a]/10 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#8b5e4a]">
            {categoryLabel(event.category)}
          </span>
          <span className="text-xs text-[#5f524c]">
            {formatShortDate(event.date)}
          </span>
        </div>
        <h3 className="mt-2 overflow-hidden font-serif text-xl font-medium leading-[1.08] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] md:text-2xl">
          {event.title}
        </h3>
        <span className="mt-3 inline-flex text-sm font-medium text-[#8b5e4a]">
          Dettagli
        </span>
      </div>
    </Link>
  );
}

function getQuickInfo(event: PeonyEvent) {
  const tags = new Set((event.tags ?? []).map((tag) => tag.toLowerCase()));
  const level = inferLevel(tags, event.category);
  const items: { label: string; value: string }[] = [
    { label: "Data", value: event.dateLabel ?? formatShortDate(event.date) },
  ];

  if (event.durationLabel) {
    items.push({ label: "Durata", value: event.durationLabel });
  }

  if (event.timeLabel) {
    items.push({ label: "Orario", value: event.timeLabel });
  }

  items.push({ label: "Categoria", value: categoryLabel(event.category) });

  if (level) {
    items.push({ label: "Livello", value: level });
  } else {
    const prerequisites = inferPrerequisites(tags);
    if (prerequisites) items.push({ label: "Prerequisiti", value: prerequisites });
  }

  const partner = inferPartner(tags);
  if (partner) items.push({ label: "Partner", value: partner });

  const observer = inferObserver(tags);
  if (observer) items.push({ label: "Observer", value: observer });

  const instructors = inferInstructors(tags);
  if (instructors) items.push({ label: "Insegnanti", value: instructors });

  return items;
}

function getBriefDescription(event: PeonyEvent) {
  const text =
    event.shortDescription ??
    (event.description ? truncateText(event.description, 280) : undefined);

  return (
    text ??
    "I dettagli completi sono disponibili nella scheda di prenotazione su Ticket Tailor."
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

function inferLevel(tags: Set<string>, category: PeonyEventCategory) {
  if (tags.has("principianti")) {
    return "Adatto a chi inizia";
  }

  if (tags.has("avanzato")) {
    return "Avanzato";
  }

  if (tags.has("richiede basi")) {
    return "Intermedio";
  }

  if (category === "workshop") {
    return "Variabile";
  }

  return "";
}

function inferPartner(tags: Set<string>) {
  if (tags.has("anche per single")) {
    return "Anche senza partner";
  }

  return "";
}

function inferObserver(tags: Set<string>) {
  return tags.has("observer ammessi") ? "Observer ammessi" : "";
}

function inferInstructors(tags: Set<string>) {
  if (tags.has("peter soptik") && tags.has("sansei")) {
    return "Peter Soptik e Sansei";
  }

  if (tags.has("peter soptik")) return "Peter Soptik";
  if (tags.has("sansei")) return "Sansei";

  return "";
}

function inferPrerequisites(tags: Set<string>) {
  if (tags.has("richiede basi")) {
    return "Richiede basi";
  }

  if (tags.has("principianti")) {
    return "Nessuna base richiesta";
  }

  return "";
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

function formatDateRange(event: PeonyEvent) {
  if (event.endDate && event.endDate !== event.date) {
    return `${formatShortDate(event.date)} - ${formatShortDate(event.endDate)}`;
  }

  return formatShortDate(event.date);
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+02:00`));
}

function categoryLabel(category: PeonyEventCategory) {
  const labels: Record<PeonyEventCategory, string> = {
    percorso: "Percorso",
    pratica: "Pratica",
    community: "Community",
    workshop: "Workshop",
    chiusura: "Evento",
    trasferta: "Evento",
    altro: "Evento",
  };

  return labels[category];
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
