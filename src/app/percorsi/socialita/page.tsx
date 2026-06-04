import { SiteHeader } from "@/components/site/SiteHeader";
import { TabsWrapper } from "@/components/layout/TabsWrapper";
import { SocialitaTabContent } from "@/components/percorsi/SocialitaTabContent";

export default function PercorsiSocialitaPage() {
  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <TabsWrapper />
      <SocialitaTabContent />
    </main>
  );
}
