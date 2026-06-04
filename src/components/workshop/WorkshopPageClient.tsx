"use client";

import Image from "next/image";
import Link from "next/link";

import { HomeFooter } from "@/components/home/HomeFooter";
import { TabsWrapper } from "@/components/layout/TabsWrapper";
import { useLanguage } from "@/components/site/LanguageProvider";
import { SiteHeader } from "@/components/site/SiteHeader";

export type WorkshopCardData = {
  id: string;
  detailHref: string;
  title: string;
  teachers: string[];
  dateLabel: string | undefined;
  timeLabel: string | undefined;
  isPreview: boolean;
  international: boolean;
  coupleOnly: boolean;
  imageUrl: string | undefined;
};

type Props = {
  cards: WorkshopCardData[];
};

export function WorkshopPageClient({ cards }: Props) {
  const { dictionary } = useLanguage();
  const w = dictionary.workshop;

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />

      <TabsWrapper />

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-6 md:pb-12 md:pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5e4a]">
          {w.eyebrow}
        </p>
        <h1 className="mt-4 max-w-4xl font-serif text-[clamp(44px,9vw,80px)] font-medium leading-[0.96] tracking-normal">
          {w.eyebrow}
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-[#5f524c] md:text-base">
          {w.description}
        </p>
        <p className="mt-2 max-w-2xl text-[13px] leading-[1.6] text-[#8b5e4a]">
          {w.note}
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6 md:pb-28">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8b5e4a]">
            {w.upcoming}
          </p>
          <Link
            href="/calendario"
            className="text-sm font-medium text-[#8b5e4a] transition hover:translate-x-1"
          >
            {w.viewCalendar}
          </Link>
        </div>
        {cards.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:thin] [scrollbar-color:#8b5e4a33_transparent]">
            {cards.map((card) => (
              <WorkshopCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-[15px] text-[#5f524c]">
            {w.noWorkshopsPrefix}{" "}
            <Link href="/calendario" className="underline">
              {w.noWorkshopsCalendar}
            </Link>{" "}
            {w.noWorkshopsSuffix}
          </p>
        )}
      </section>

      <HomeFooter content={dictionary.footer} />
    </main>
  );
}

function WorkshopCard({ card }: { card: WorkshopCardData }) {
  const { dictionary } = useLanguage();
  const w = dictionary.workshop;

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
            {w.eyebrow}
          </span>
          {card.international && (
            <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-2.5 py-1 text-[10px] font-medium text-[#5f524c]">
              {w.badgeInternational}
            </span>
          )}
          {card.coupleOnly && (
            <span className="rounded-full border border-[#211815]/10 bg-[#f4efe8]/70 px-2.5 py-1 text-[10px] font-medium text-[#5f524c]">
              {w.badgeCoupleOnly}
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
            {card.isPreview ? w.statusPreview : w.ctaBook}
          </span>
        </div>
      </div>
    </Link>
  );
}
