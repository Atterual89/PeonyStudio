import { FeaturedEventsSection } from "@/components/home/FeaturedEventsSection";
import { FinalHomeCta } from "@/components/home/FinalHomeCta";
import { HeroSection } from "@/components/home/HeroSection";
import { HomeFooter } from "@/components/home/HomeFooter";
import { HorizontalAreasSection } from "@/components/home/HorizontalAreasSection";
import { PhilosophySection } from "@/components/home/PhilosophySection";
import { SplitIntroSection } from "@/components/home/SplitIntroSection";
import { StudioPreviewSection } from "@/components/home/StudioPreviewSection";
import { VerticalPathSection } from "@/components/home/VerticalPathSection";
import { calendarContent } from "@/content/calendar";
import { homeContent } from "@/content/home";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <HeroSection content={homeContent.hero} />
      <VerticalPathSection items={homeContent.verticalPath} />
      <SplitIntroSection content={homeContent.splitIntro} />
      <HorizontalAreasSection areas={homeContent.areas} />
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
