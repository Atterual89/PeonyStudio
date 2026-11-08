import Link from "next/link";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson } from "@/lib/gestionale/server/data";
import { isUuidLike } from "@/lib/gestionale/validation";
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
 const preferredPerson=preferred&&!preferred.merged_into?{
  id:preferred.id,name:[preferred.first_name,preferred.last_name].filter(Boolean).join(" ")||preferred.nickname||preferred.email||"Persona selezionata"
 }:null;
 return <section className="mx-auto max-w-3xl space-y-4">
  <Link href="/gestione" prefetch={false} className="text-sm underline">← Gestionale</Link>
  <h1 className="font-serif text-2xl">Quote associative · email</h1>
  {!result.ok?<p role="alert" className="rounded-xl border p-4">{result.error}</p>:
   <PaymentEmailReview payments={result.payments} initialised={Boolean(result.state?.initial_from)}
       lastSync={result.state?.last_success_at??null} preferredPerson={preferredPerson}/>}
 </section>;
}
