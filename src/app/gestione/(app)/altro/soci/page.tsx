export const maxDuration = 120;

import Link from "next/link";
import { MemberDirectorySearch } from "@/components/gestionale/MemberDirectorySearch";
import { MemberLinkReview } from "@/components/gestionale/MemberLinkReview";
import { PaymentEmailReview } from "@/components/gestionale/PaymentEmailReview";
import { CompleteAllFromMembers } from "@/components/gestionale/CompleteAllFromMembers";
import { RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
import { SyncSociButton } from "@/components/gestionale/SyncSociButton";
import { AssociationMailSyncControl } from "@/components/gestionale/AssociationMailSyncControl";
import { SociBookUpload } from "@/components/gestionale/SociBookUpload";
import { Notice } from "@/components/gestionale/ui";
import { getAssociationMailState } from "@/app/gestione/(app)/quote-email/actions";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { todayInRome } from "@/lib/gestionale/workshops";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { findMemberLinkProposals } from "@/lib/gestionale/server/member-links";
import { listCompletablePeople } from "@/lib/gestionale/server/member-fill";

export default async function SociPage({searchParams}:{searchParams:Promise<{quote?:string}>}){
 await requireAdmin();
 const openEmailReview=(await searchParams).quote==="1";
 const [proposals,completable,mail]=await Promise.all([
  findMemberLinkProposals().catch((error:unknown)=>{
   console.error("[soci] Proposte di collegamento",error instanceof Error?error.message:error);
   return null;
  }),
  listCompletablePeople().catch((error:unknown)=>{
   console.error("[soci] Completamento anagrafiche",error instanceof Error?error.message:error);
   return null;
  }),
  getAssociationMailState(),
 ]);
 const today=todayInRome();
 const periods=Array.from({length:Math.max(1,Number(today.slice(0,4))-2025+2)},
   (_,i)=>membershipPeriodFor(`${2025+i}-01-01`))
   .filter((p):p is NonNullable<typeof p>=>Boolean(p))
   .filter((p,i,all)=>all.findIndex(other=>other.paymentsFrom===p.paymentsFrom)===i)
   .map(p=>({from:p.paymentsFrom,label:p.paymentsFrom==="2025-09-01"?"2025/26":p.paymentsFrom.slice(0,4)}));
 return <section className="mx-auto max-w-3xl space-y-3">
  <Link prefetch={false} href="/gestione" className="text-sm text-[#5f524c] underline">← Gestionale</Link>
  <h1 className="font-serif text-xl font-medium">Libro soci</h1>
  <div className="flex flex-wrap gap-2 items-start">
   <AssociationMailSyncControl />
  </div>
  <div className="rounded-xl border border-[#211815]/10 bg-white/80 p-3">
   <MemberDirectorySearch/>
  </div>
  <details id="allineamento-anagrafiche" className="rounded-xl border border-[#211815]/10 bg-white/70 p-3">
   <summary className="cursor-pointer text-sm font-semibold">Abbinamenti da confermare{proposals?.proposals.length?` · ${proposals.proposals.length}`:""}</summary>
   <div className="mt-3">
    {!proposals?<Notice tone="error">Impossibile caricare gli abbinamenti. Riprova.</Notice>:
     <MemberLinkReview proposals={proposals.proposals}/>}
   </div>
  </details>
  <details id="quote-email" open={openEmailReview} className="rounded-xl border border-[#211815]/10 bg-white/70 p-3">
   <summary className="cursor-pointer text-sm font-semibold">Pagamenti email da verificare{mail.ok?` · ${mail.payments.length}`:""}</summary>
   <div className="mt-3">
    {mail.ok?<PaymentEmailReview payments={mail.payments} periods={periods}
      defaultPeriod={membershipPeriodFor(today)?.paymentsFrom??"2025-09-01"}/>:
     <Notice tone="error">{mail.error}</Notice>}
   </div>
  </details>
  <details className="rounded-xl border border-[#211815]/10 bg-white/55 p-3">
   <summary className="cursor-pointer text-sm font-semibold text-[#5f524c]">Aggiornamenti e strumenti avanzati</summary>
   <div className="mt-3 space-y-4 text-sm">
    <div>
     <p className="mb-2 text-xs text-[#5f524c]">Aggiorna soltanto le domande dai moduli Google, non il libro ufficiale.</p>
     <SyncSociButton/>
    </div>
    <SociBookUpload/>
    <div className="flex flex-wrap gap-2">
     <RefreshMembershipButton/>
     {completable&&completable.length>0?<CompleteAllFromMembers count={completable.length}/>:null}
    </div>
   </div>
  </details>
 </section>;
}
