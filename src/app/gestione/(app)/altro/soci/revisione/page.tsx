export const maxDuration=120;

import Link from "next/link";
import { AutoFixFormsButton } from "@/components/gestionale/AutoFixFormsButton";
import { GoogleFormsReview } from "@/components/gestionale/GoogleFormsReview";
import { loadGoogleFormReviewAction } from "./actions";
import { requireAdmin } from "@/lib/gestionale/server/auth";

export default async function RevisioneModuliPage(){
  await requireAdmin();
  const queue=await loadGoogleFormReviewAction();
  return <section className="mx-auto max-w-3xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-serif text-xl font-medium">Persone da chiarire</h1>
      <Link prefetch={false} className="text-sm text-[#a8583e] underline"
        href="/gestione/altro/soci">Torna a Verifiche</Link>
    </div>
    <p className="text-sm text-[#5f524c]">
      I moduli chiari si collegano da soli quando premi «Aggiorna tutto». Qui restano solo i dubbi:
      lo stesso nome con email diverse, più schede possibili, moduli registrati due volte.
      Quote e pagamenti restano invariati.
    </p>
    {queue.ok&&queue.cases.some(c=>c.kind==="duplicate")?<AutoFixFormsButton duplicates={queue.cases.filter(c=>c.kind==="duplicate").length}/>:null}
    {queue.ok?<GoogleFormsReview cases={queue.cases} readCount={queue.readCount}/>:
      <p role="alert" className="rounded-xl border border-[#a8583e]/35 bg-[#f3e8d4] p-3 text-sm text-[#733a18]">
        {queue.error}
      </p>}
  </section>;
}
