"use client";

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
import { EventImage } from "@/components/shared/EventImage";
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
              className="min-w-[180px] shrink-0 overflow-hidden rounded-[12px] border border-[#211815]/8 [scroll-snap-align:start]"
            >
              <EventImage
                src={event.image ?? FALLBACK_IMAGE}
                alt={event.title}
                variant="netflix"
              />
              <div className="bg-[#f5ede2] px-3 pb-3 pt-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#8b5e4a]/10 px-2 py-0.5 text-[10px] font-medium text-[#8b5e4a]">
                    {event.category}
                  </span>
                  <span className="text-[10px] text-[#6b5c52]">
                    {event.date}
                  </span>
                </div>
                <p className="mt-1 font-serif text-[13px] leading-tight text-[#211815] line-clamp-2">
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
