import { HowToStartInline } from "@/components/how-to-start/HowToStartInline";
import { SiteHeader } from "@/components/site/SiteHeader";
import { howToStartContent } from "@/content/how-to-start";
import { TabsWrapper } from "@/components/layout/TabsWrapper";

export default function PercorsiIniziaPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <TabsWrapper />
      <HowToStartInline content={howToStartContent} />
    </main>
  );
}
