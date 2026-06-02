import { redirect } from "next/navigation";

import { PersonalAreaDashboard } from "@/app/area-personale/PersonalAreaDashboard";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getOrCreatePersonalAreaData } from "@/lib/personal-area";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PersonalAreaPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/area-personale/login");
  }

  const data = await getOrCreatePersonalAreaData(user);

  return (
    <main className="min-h-screen bg-[#f4efe8] text-[#211815]">
      <SiteHeader />
      <PersonalAreaDashboard data={data} />
    </main>
  );
}
