"use client";

import { useLanguage } from "@/components/site/LanguageProvider";
import { EntryDoorsSection } from "@/components/home/EntryDoorsSection";
import {
  FeaturedEventsSection,
  type FeaturedEvent,
} from "@/components/home/FeaturedEventsSection";
import { FinalHomeCta } from "@/components/home/FinalHomeCta";
import { HeroSection } from "@/components/home/HeroSection";
import { Marquee } from "@/components/home/Marquee";
import { PhilosophySection } from "@/components/home/PhilosophySection";
import { StudioPreviewSection } from "@/components/home/StudioPreviewSection";
import { SiteHeader } from "@/components/site/SiteHeader";

type Props = {
  featured: FeaturedEvent | null;
  events: FeaturedEvent[];
};

export function HomeContentClient({ featured, events }: Props) {
  const { dictionary } = useLanguage();
  const h = dictionary.home;

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <HeroSection content={h.hero} />
      <Marquee />
      <EntryDoorsSection />
      <FeaturedEventsSection
        featured={featured}
        events={events}
        eyebrow={h.events.eyebrow}
        title={h.events.title}
        ctaLabel={h.events.ctaLabel}
      />
      <PhilosophySection content={h.philosophy} />
      <StudioPreviewSection content={h.studio} />
      <FinalHomeCta content={h.finalCta} />
    </main>
  );
}
