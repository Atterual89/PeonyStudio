export const maxDuration=120;
import { Suspense } from "react";
import Link from "next/link";
import { IdentityAuditDashboard } from "@/components/gestionale/IdentityAuditDashboard";
import { HistoricPaymentAudit } from "@/components/gestionale/HistoricPaymentAudit";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadIdentityAudit } from "@/lib/gestionale/server/identity-audit";
import { todayInRome } from "@/lib/gestionale/workshops";

export default async function ControlloAssociazionePage(){
  await requireAdmin();
  const data=await loadIdentityAudit(todayInRome());
  return <section className="mx-auto max-w-4xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-serif text-2xl">Controllo associazione</h1>
      <Link prefetch={false} href="/gestione/altro/soci" className="text-sm text-[#a8583e] underline">Torna alle verifiche</Link>
    </div>
    <p className="text-sm text-[#5f524c]">
      Un'unica anagrafica, con controlli distinti per modulo, quota e identità.
      I dati dubbi non sono collegati o eliminati automaticamente.
    </p>
    <IdentityAuditDashboard contacts={data.contacts} duplicates={data.duplicates} counts={data.counts}/>
    <div className="flex flex-wrap gap-2 text-sm">
      <Link prefetch={false} href="/gestione/altro/soci/revisione"
        className="rounded-lg border border-[#a8583e]/30 px-3 py-2 text-[#a8583e]">
        Revisione singola moduli Google
      </Link>
      <Link prefetch={false} href="/gestione/altro/soci?quote=1#quote-email"
        className="rounded-lg border border-[#a8583e]/30 px-3 py-2 text-[#a8583e]">
        Verifica quote recenti
      </Link>
    </div>
    <Suspense fallback={<p className="text-sm text-[#5f524c]">Caricamento dello storico pagamenti…</p>}>
      <HistoricPaymentAudit/>
    </Suspense>
  </section>;
}
