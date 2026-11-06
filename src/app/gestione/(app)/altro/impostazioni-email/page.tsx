import Link from "next/link";
import { EmailDefaultsForm } from "@/components/gestionale/EmailDefaultsForm";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { workshopEmailDefaults } from "@/lib/gestionale/email/defaults";

export default async function EmailDefaultsPage() {
  await requireAdmin();
  const {data,error}=await getGestionaleDb().from("gw_settings")
    .select("fields,version").eq("key","email_defaults").maybeSingle();
  if(error) throw new Error("Lettura impostazioni email non riuscita.");
  const defaults=workshopEmailDefaults({displayName:"Workshop",startsOn:"2027-01-01",endsOn:null});
  const base:Record<string,string|number>={
    location:defaults.location,intercom:defaults.intercom,mapsUrl:defaults.mapsUrl,
    membershipFormUrl:defaults.membershipFormUrl,membershipFeeEuro:defaults.membershipFeeEuro,
    signature:defaults.signature||"Peony Studio Staff",
  };
  return <section>
    <Link href="/gestione/altro" className="text-sm underline">← Altro</Link>
    <h1 className="mt-2 font-serif text-xl font-medium">Impostazioni email</h1>
    <EmailDefaultsForm initial={{...base,...((data?.fields||{}) as Record<string,string|number>)}} initialVersion={data?.version??0}/>
  </section>;
}
