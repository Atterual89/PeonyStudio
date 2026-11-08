import Link from "next/link";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getAssociationMailState } from "./actions";
import { PaymentEmailReview } from "@/components/gestionale/PaymentEmailReview";
export const dynamic="force-dynamic";
export default async function PaymentEmailPage(){
 await requireAdmin();
 const result=await getAssociationMailState();
 return <section className="mx-auto max-w-3xl space-y-4">
  <Link href="/gestione" className="text-sm underline">← Gestionale</Link>
  <h1 className="font-serif text-2xl">Quote associative · email</h1>
  {!result.ok?<p role="alert" className="rounded-xl border p-4">{result.error}</p>:
   <PaymentEmailReview payments={result.payments} initialised={Boolean(result.state?.initial_from)}
       lastSync={result.state?.last_success_at??null}/>}
 </section>;
}
