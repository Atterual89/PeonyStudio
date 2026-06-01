import { EntryDoorsSection } from "@/components/home/EntryDoorsSection";
import { FeaturedEventsSection } from "@/components/home/FeaturedEventsSection";
import { FinalHomeCta } from "@/components/home/FinalHomeCta";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Marquee } from "@/components/home/Marquee";
import { PhilosophySection } from "@/components/home/PhilosophySection";
import { StudioPreviewSection } from "@/components/home/StudioPreviewSection";
import { SiteHeader } from "@/components/site/SiteHeader";
import { homeContent } from "@/content/home";
import { getFeaturedEvent, getUpcomingEvents, toEventCard } from "@/lib/events";

export default async function Home() {
  const [featuredEvent, upcomingEvents] = await Promise.all([
    getFeaturedEvent(),
    getUpcomingEvents(5),
  ]);
  const featured = featuredEvent ? toEventCard(featuredEvent) : null;
  const events = upcomingEvents
    .filter((event) => event.id !== featuredEvent?.id)
    .slice(0, 4)
    .map(toEventCard);

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <HeroSection content={homeContent.hero} />
      <Marquee />
      <EntryDoorsSection />
      <FeaturedEventsSection
        featured={featured}
        events={events}
        ctaLabel="Vedi calendario →"
      />
      <PhilosophySection content={homeContent.philosophy} />
      <StudioPreviewSection content={homeContent.studioPreview} />
      <FinalHomeCta content={homeContent.finalCta} />
      <HomeFooter content={homeContent.footer} />
    </main>
  );
}
