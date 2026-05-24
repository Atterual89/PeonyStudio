import { HeroSection } from "@/components/home/HeroSection";
import { HomePathCards } from "@/components/home/HomePathCards";
import { homeContent } from "@/content/home";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <HeroSection content={homeContent.hero} />
      <HomePathCards cards={homeContent.pathCards} />
    </main>
  );
}
