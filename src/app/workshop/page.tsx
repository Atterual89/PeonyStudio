import Image from "next/image";
import Link from "next/link";

import { HomeFooter } from "@/components/home/HomeFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { homeContent } from "@/content/home";
import { getWorkshopBySlug } from "@/content/workshops";
import { getWorkshopEvents, type PeonyEvent } from "@/lib/events";
import { TICKET_TAILOR_PUBLIC_URL } from "@/lib/ticketTailor";

type WorkshopCardData = {
  id: string;
  detailHref: string;
  title: string;
  teachers: string[];
  dateLabel: string | undefined;
  timeLabel: string | undefined;
  ctaLabel: string;
  isPreview: boolean;
  international: boolean;
  coupleOnly: boolean;
  imageUrl: string | undefined;
};

export default async function WorkshopPage() {
  const liveEvents = await getWorkshopEvents();
  const allCards: WorkshopCardData[] = liveEvents.map((event) =>
    buildLiveCard(event),
  );

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-6 md:pb-12 md:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
          Workshop
        </p>
        <h1 className="mt-4 max-w-4xl font-serif text-[clamp(44px,9vw,80px)] font-medium leading-[0.96] tracking-normal">
          Workshop
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
          Approfondimenti intensivi, guest teacher e giornate di studio
          dedicate a temi specifici del kinbaku.
        </p>
        <p className="mt-2 max-w-2xl text-[13px] leading-[1.6] text-[#8b5e4a]">
          Tutti i workshop sono pensati per coppie. Gli observer non sono
          ammessi, salvo diversa indicazione.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 md:pb-28">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            Prossimi workshop
          </p>
          <Link
            href="/calendario"
            className="text-sm font-medium text-[#8b5e4a] transition hover:translate-x-1"
          >
            Vedi calendario completo
          </Link>
        </div>
        {allCards.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [scrollbar-color:#8b5e4a33_transparent]">
            {allCards.map((card) => (
              <WorkshopCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-[#5f524c]">
            Nessun workshop in programma al momento. Controlla il{" "}
            <Link href="/calendario" className="underline">
              calendario
            </Link>{" "}
            per gli aggiornamenti.
          </p>
        )}
      </section>

      <HomeFooter content={homeContent.footer} />
    </main>
  );
}

function WorkshopCard({ card }: { card: WorkshopCardData }) {
  return (
    <Link
      href={card.detailHref}
      className="group flex w-[min(84vw,380px)] shrink-0 flex-col overflow-hidden rounded-[8px] border border-[#211815]/10 bg-white/65 shadow-[0_1px_0_rgba(33,24,21,0.04)] [scroll-snap-align:start] transition duration-500 hover:-translate-y-[3px] hover:shadow-[0_12px_30px_rgba(33,24,21,0.08)]"
    >
      {card.imageUrl ? (
        <div className="relative h-28 overflow-hidden bg-[#efe4d7]">
          <Image
            src={card.imageUrl}
            alt={card.title}
            fill
            className="object-cover saturate-[0.92] transition duration-700 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="h-28 bg-gradient-to-br from-[#efe4d7] to-[#d6b89f]/30" />
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[#8b5e4a]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b5e4a]">
            Workshop
          </span>
          {card.international && (
            <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-2.5 py-1 text-[10px] font-medium text-[#5f524c]">
              Internazionale
            </span>
          )}
          {card.coupleOnly && (
            <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-2.5 py-1 text-[10px] font-medium text-[#5f524c]">
              Solo coppie
            </span>
          )}
        </div>

        <h2 className="mt-3 font-serif text-2xl font-medium leading-[1.1] tracking-normal text-[#211815]">
          {card.title}
        </h2>
        {card.teachers.length > 0 && (
          <p className="mt-1 text-sm text-[#5f524c]">
            {card.teachers.join(", ")}
          </p>
        )}

        {card.dateLabel && (
          <p className="mt-2 text-xs font-medium text-[#211815]">
            {card.dateLabel}
          </p>
        )}
        {card.timeLabel && (
          <p className="text-xs text-[#5f524c]">{card.timeLabel}</p>
        )}

        <div className="mt-auto pt-4">
          <span
            className={`inline-block rounded-full px-3.5 py-2 text-xs font-medium ${
              card.isPreview
                ? "border border-[#211815]/10 bg-[#f4efe8]/70 text-[#5f524c]"
                : "bg-[#211815] text-white"
            }`}
          >
            {card.isPreview ? "In programma" : card.ctaLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}

function buildLiveCard(event: PeonyEvent): WorkshopCardData {
  const enrichment = event.workshopSlug
    ? getWorkshopBySlug(event.workshopSlug)
    : undefined;

  const hasTTBooking =
    event.source === "ticket-tailor" &&
    Boolean(event.bookingUrl) &&
    event.bookingUrl !== TICKET_TAILOR_PUBLIC_URL;

  return {
    id: event.id,
    detailHref: event.workshopSlug
      ? `/workshop/${event.workshopSlug}`
      : `/eventi/${event.slug}`,
    title: event.title,
    teachers: enrichment?.teachers ?? teachersFromTags(event.tags ?? []),
    dateLabel: event.dateLabel ?? enrichment?.dateLabel,
    timeLabel: event.timeLabel ?? enrichment?.timeLabel,
    ctaLabel: hasTTBooking
      ? "Prenota su Ticket Tailor"
      : "In programma — biglietti non ancora disponibili",
    isPreview: !hasTTBooking,
    international: enrichment?.international ?? true,
    coupleOnly: enrichment?.coupleOnly ?? true,
    imageUrl: event.imageUrl ?? enrichment?.image,
  };
}

function teachersFromTags(tags: string[]): string[] {
  const tagMap: [string, string][] = [
    ["peter soptik", "Peter Soptik"],
    ["sansei", "Sansei"],
    ["kurogami", "Kurogami"],
    ["shiawase", "Shiawase"],
    ["wildties", "Riccardo Wildties"],
    ["red sabbath", "Red Sabbath"],
  ];
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

  return tagMap
    .filter(([tag]) => tagSet.has(tag))
    .map(([, name]) => name);
}
