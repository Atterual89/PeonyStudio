import { BeginnerPathSection } from "@/components/home/BeginnerPathSection";
import { CalendarPreviewSection } from "@/components/home/CalendarPreviewSection";
import { FinalHomeCta } from "@/components/home/FinalHomeCta";
import { HeroSection } from "@/components/home/HeroSection";
import { HomePathCards } from "@/components/home/HomePathCards";
import { SpacePreviewSection } from "@/components/home/SpacePreviewSection";
import { calendarContent } from "@/content/calendar";
import { homeContent } from "@/content/home";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <HeroSection content={homeContent.hero} />
      <HomePathCards cards={homeContent.pathCards} />
      <BeginnerPathSection content={homeContent.beginnerPath} />
      <CalendarPreviewSection
        content={homeContent.calendarPreview}
        events={calendarContent.previewEvents}
      />
      <SpacePreviewSection content={homeContent.spacePreview} />
      <FinalHomeCta content={homeContent.finalCta} />
    </main>
  );
}
