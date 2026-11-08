import Link from "next/link";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson } from "@/lib/gestionale/server/data";
import { isUuidLike } from "@/lib/gestionale/validation";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { todayInRome } from "@/lib/gestionale/workshops";
import { getAssociationMailState } from "./actions";
import { PaymentEmailReview } from "@/components/gestionale/PaymentEmailReview";
export const dynamic="force-dynamic";
export default async function PaymentEmailPage({searchParams}:{searchParams:Promise<{persona?:string}>}){
 await requireAdmin();
 const {persona}=await searchParams;
 const [result,preferred]=await Promise.all([
  getAssociationMailState(),
  persona && isUuidLike(persona)?getPerson(persona):Promise.resolve(null),
 ]);
 const today=todayInRome();
 const current=membershipPeriodFor(today);
 const periods=Array.from({length:Math.max(1,Number(today.slice(0,4))-2025+2)},(_,i)=>membershipPeriodFor(`${2025+i}-01-01`))
  .filter((p):p is NonNullable<typeof p>=>Boolean(p))
  .filter((p,i,all)=>all.findIndex(other=>other.paymentsFrom===p.paymentsFrom)===i)
  .map(p=>({from:p.paymentsFrom,label:p.paymentsFrom==="2025-09-01"?"2025/26":p.paymentsFrom.slice(0,4)}));
 const preferredPerson=preferred&&!preferred.merged_into?{
  id:preferred.id,name:[preferred.first_name,preferred.last_name].filter(Boolean).join(" ")||preferred.nickname||preferred.email||"Persona selezionata"
 }:null;
 return <section className="mx-auto max-w-3xl space-y-4">
  <Link href="/gestione" prefetch={false} className="text-sm underline">← Gestionale</Link>
  <h1 className="font-serif text-2xl">Quote associative · email</h1>
  {!result.ok?<p role="alert" className="rounded-xl border p-4">{result.error}</p>:
   <PaymentEmailReview payments={result.payments} initialised={Boolean(result.state?.initial_from)}
       lastSync={result.state?.last_success_at??null} preferredPerson={preferredPerson}
       periods={periods} defaultPeriod={current?.paymentsFrom??periods[0]?.from??""}/>}
 </section>;
}
