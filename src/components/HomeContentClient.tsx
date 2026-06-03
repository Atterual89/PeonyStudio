"use client";

import Image from "next/image";
import Link from "next/link";

import { useLanguage } from "@/components/site/LanguageProvider";
import { EntryDoorsSection } from "@/components/home/EntryDoorsSection";
import { FeaturedEventsSection, type FeaturedEvent } from "@/components/home/FeaturedEventsSection";
import { FinalHomeCta } from "@/components/home/FinalHomeCta";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Marquee } from "@/components/home/Marquee";
import { PhilosophySection } from "@/components/home/PhilosophySection";
import { StudioPreviewSection } from "@/components/home/StudioPreviewSection";
import { SiteHeader } from "@/components/site/SiteHeader";

const FALLBACK_IMAGE = "/images/home/event-class.jpg";

type Props = {
  featured: FeaturedEvent | null;
  events: FeaturedEvent[];
};

export function HomeContentClient({ featured, events }: Props) {
  const { dictionary } = useLanguage();
  const h = dictionary.home;

  const mobileEvents = [...(featured ? [featured] : []), ...events].slice(0, 5);

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <HeroSection content={h.hero} />
      <Marquee />
      <EntryDoorsSection />

      {/* mobile: scroll eventi */}
      <div className="md:hidden pb-2 pt-6">
        <p className="mb-3 px-5 font-sans text-[9px] uppercase tracking-widest text-[#8b5e4a]">
          Prossimi Appuntamenti
        </p>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileEvents.map((event, i) => (
            <a
              key={`${event.slug}-${i}`}
              href={event.bookingUrl ?? event.eventUrl}
              className="relative block h-[220px] min-w-[200px] shrink-0 overflow-hidden rounded-[12px] [scroll-snap-align:start]"
            >
              <Image
                src={event.image ?? FALLBACK_IMAGE}
                alt={event.title}
                fill
                sizes="200px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1a1510]/80 via-[#1a1510]/15 to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-[#8b5e4a]/90 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                {event.category}
              </span>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="mb-1 font-sans text-[10px] text-[#f4efe8]/70">
                  {event.date}
                </p>
                <p className="font-serif text-sm font-medium leading-tight text-[#f4efe8] line-clamp-2">
                  {event.title}
                </p>
              </div>
            </a>
          ))}
          <div className="w-1 shrink-0" aria-hidden="true" />
        </div>
        <div className="mt-3 px-5 text-right">
          <Link href="/calendario" className="font-sans text-xs text-[#8b5e4a]">
            Vedi tutti gli appuntamenti →
          </Link>
        </div>
      </div>

      {/* desktop: sezione eventi invariata */}
      <div className="hidden md:block">
        <FeaturedEventsSection
          featured={featured}
          events={events}
          eyebrow={h.events.eyebrow}
          title={h.events.title}
          ctaLabel={h.events.ctaLabel}
        />
      </div>

      <PhilosophySection content={h.philosophy} />
      <StudioPreviewSection content={h.studio} />
      <FinalHomeCta content={h.finalCta} />
      <HomeFooter content={dictionary.footer} />
    </main>
  );
}
