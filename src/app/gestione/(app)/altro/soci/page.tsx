export const maxDuration = 120;

import { Suspense } from "react";
import Link from "next/link";
import { MemberLinkReview } from "@/components/gestionale/MemberLinkReview";
import { PaymentEmailReview } from "@/components/gestionale/PaymentEmailReview";
import { CompleteAllFromMembers } from "@/components/gestionale/CompleteAllFromMembers";
import { RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
import { SyncSociButton } from "@/components/gestionale/SyncSociButton";
import { AssociationMailSyncControl } from "@/components/gestionale/AssociationMailSyncControl";
import { Notice } from "@/components/gestionale/ui";
import { getAssociationMailState } from "@/app/gestione/(app)/quote-email/actions";
import { membershipPeriodFor, membershipPeriodForPayment } from "@/lib/association/membership-periods";
import { todayInRome } from "@/lib/gestionale/workshops";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { findMemberLinkProposals } from "@/lib/gestionale/server/member-links";
import { listCompletablePeople } from "@/lib/gestionale/server/member-fill";

/** Il pannello lento non deve impedire di usare i pulsanti di sincronizzazione. */
async function MemberProposals() {
  const proposals = await findMemberLinkProposals().catch((error:unknown) => {
    console.error("[soci] Proposte di collegamento", error instanceof Error ? error.message : error);
    return null;
  });
  return <details id="allineamento-anagrafiche" className="rounded-xl border border-[#211815]/10 bg-white/70 p-3">
    <summary className="cursor-pointer text-sm font-semibold">
      Abbinamenti da confermare{proposals?.proposals.length?` · ${proposals.proposals.length}`:""}
    </summary>
    <div className="mt-3">
      {!proposals?<Notice tone="error">Impossibile caricare gli abbinamenti. Ripeti la sincronizzazione e riprova.</Notice>:
        <MemberLinkReview proposals={proposals.proposals}/>}
    </div>
  </details>;
}

async function PaymentReviews({open}:{open:boolean}) {
  const mail = await getAssociationMailState().catch((error:unknown) => {
    console.error("[soci] Pagamenti Gmail", error instanceof Error ? error.message : error);
    return {ok:false as const,error:"Impossibile caricare i pagamenti. Riprova."};
  });
  const today=todayInRome();
  const periods=Array.from({length:Math.max(1,Number(today.slice(0,4))-2025+2)},
    (_,i)=>membershipPeriodFor(`${2025+i}-12-31`))
    .filter((p):p is NonNullable<typeof p>=>Boolean(p))
    .filter((p,i,all)=>all.findIndex(other=>other.paymentsFrom===p.paymentsFrom)===i)
    .map(p=>({from:p.paymentsFrom,label:p.validUntil.startsWith("2026")?"2025/26":p.validUntil.slice(0,4)}));
  return <details open={open} className="rounded-xl border border-[#211815]/10 bg-white/70 p-3">
    <summary className="cursor-pointer text-sm font-semibold">Pagamenti email da verificare{mail.ok?` · ${mail.payments.length}`:""}</summary>
    <div className="mt-3">
      {mail.ok?<PaymentEmailReview payments={mail.payments} periods={periods}
        defaultPeriod={membershipPeriodForPayment(today)?.paymentsFrom??"2025-09-01"}/>:
        <Notice tone="error">{mail.error}</Notice>}
    </div>
  </details>;
}

async function ExtraMaintenance() {
  const completable=await listCompletablePeople().catch((error:unknown)=>{
    console.error("[soci] Anagrafiche da completare",error instanceof Error?error.message:error);
    return null;
  });
  return <>{completable&&completable.length>0?<CompleteAllFromMembers count={completable.length}/>:null}</>;
}

export default async function SociPage({searchParams}:{searchParams:Promise<{quote?:string;q?:string}>}){
  await requireAdmin();
  const params=await searchParams;
  return <section className="mx-auto max-w-3xl space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="font-serif text-xl font-medium">Verifiche soci e quote</h1>
      <Link prefetch={false} href="/gestione/altro" className="text-sm text-[#5f524c] underline">Altre impostazioni</Link>
    </div>
    <div className="flex flex-wrap items-start gap-2">
      <SyncSociButton/>
      <Suspense fallback={<span role="status" className="px-2 py-3 text-xs text-[#5f524c]">Controllo connessione Gmail…</span>}>
        <AssociationMailSyncControl/>
      </Suspense>
    </div>
    <p className="text-xs text-[#5f524c]">
      I moduli Google registrano le persone; le quote si verificano dalle email PayPal/Qonto o manualmente.
      Team Artist non è necessario per queste verifiche.
    </p>
    <div className="flex justify-end">
      <Link prefetch={false} href={`/gestione/persone${typeof params.q==="string"?`?q=${encodeURIComponent(params.q.slice(0,100))}`:""}`}
        className="inline-flex min-h-10 items-center rounded-lg border border-[#a8583e] px-3 text-sm font-semibold text-[#a8583e]">
        Apri anagrafiche
      </Link>
    </div>
    <Link prefetch={false} href="/gestione/altro/soci/abbinamenti-ale"
      className="flex min-h-12 items-center justify-between rounded-xl border border-[#211815]/10 bg-white/80 px-3 text-sm font-semibold text-[#a8583e]">
      <span>Matching anagrafica Alessandra ↔ Persone e libro soci</span>
      <span aria-hidden="true">Apri</span>
    </Link>
    <Suspense fallback={<p role="status" className="py-2 text-sm text-[#5f524c]">Caricamento delle proposte di abbinamento…</p>}>
      <MemberProposals/>
    </Suspense>
    <div id="quote-email">
      <Suspense fallback={<p role="status" className="py-2 text-sm text-[#5f524c]">Caricamento dei pagamenti da verificare…</p>}>
        <PaymentReviews open={params.quote==="1"}/>
      </Suspense>
    </div>
    <details className="rounded-xl border border-[#211815]/10 bg-white/55 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-[#5f524c]">Altre operazioni</summary>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <RefreshMembershipButton/>
        <Suspense fallback={<span className="text-xs text-[#5f524c]">Controllo anagrafiche…</span>}>
          <ExtraMaintenance/>
        </Suspense>
      </div>
    </details>
  </section>;
}
