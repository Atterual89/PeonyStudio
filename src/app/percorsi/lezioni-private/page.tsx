import { SiteHeader } from "@/components/site/SiteHeader";
import { TabsWrapper } from "@/components/layout/TabsWrapper";
import { PrivateLessonsTab } from "@/components/programs/PrivateLessonsTab";

export default function LezioniPrivatePage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <TabsWrapper />
      <PrivateLessonsTab />
    </main>
  );
}
