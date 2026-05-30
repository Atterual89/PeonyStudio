import { EntryDoorsSection } from "@/components/home/EntryDoorsSection";
import { FeaturedEventsSection } from "@/components/home/FeaturedEventsSection";
import { FinalHomeCta } from "@/components/home/FinalHomeCta";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Marquee } from "@/components/home/Marquee";
import { PhilosophySection } from "@/components/home/PhilosophySection";
import { StudioPreviewSection } from "@/components/home/StudioPreviewSection";
import { SiteHeader } from "@/components/site/SiteHeader";
import { calendarContent } from "@/content/calendar";
import { homeContent } from "@/content/home";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <HeroSection content={homeContent.hero} />
      <Marquee />
      <EntryDoorsSection />
      <FeaturedEventsSection
        featured={calendarContent.featuredHomeEvent}
        events={calendarContent.homeEvents}
      />
      <PhilosophySection content={homeContent.philosophy} />
      <StudioPreviewSection content={homeContent.studioPreview} />
      <FinalHomeCta content={homeContent.finalCta} />
      <HomeFooter content={homeContent.footer} />
    </main>
  );
}
