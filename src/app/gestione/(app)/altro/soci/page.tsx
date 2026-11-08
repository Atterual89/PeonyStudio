export const maxDuration = 120;

import Link from "next/link";

import { MemberLinkReview } from "@/components/gestionale/MemberLinkReview";
import { PaymentEmailReview } from "@/components/gestionale/PaymentEmailReview";
import { getAssociationMailState } from "@/app/gestione/(app)/quote-email/actions";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { todayInRome } from "@/lib/gestionale/workshops";
import { CompleteAllFromMembers } from "@/components/gestionale/CompleteAllFromMembers";
import { RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
import { SyncSociButton } from "@/components/gestionale/SyncSociButton";
import { SociBookUpload } from "@/components/gestionale/SociBookUpload";
import { Notice, Section, cardClass } from "@/components/gestionale/ui";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { findMemberLinkProposals } from "@/lib/gestionale/server/member-links";
import { listCompletablePeople } from "@/lib/gestionale/server/member-fill";

// Fase 5: collegamento in blocco al libro soci. Solo admin (D18). Le persone
// senza collegamento al libro soci con il socio proposto: per email
// (preselezionate) o per nome e cognome (da confermare una per una).

export default async function SociPage() {
  await requireAdmin();
  const [result, completable, mail] = await Promise.all([
    findMemberLinkProposals().catch((error: unknown) => {
      console.error("Gestionale (proposte libro soci):", error instanceof Error ? error.message : error);
      return null;
    }),
    listCompletablePeople().catch((error: unknown) => {
      console.error("Gestionale (completamento dati):", error instanceof Error ? error.message : error);
      return null;
    }),
    getAssociationMailState(),
  ]);

  return (
    <section className="max-w-3xl">
      <Link prefetch={false} href="/gestione/altro" className="text-sm text-[#5f524c] underline">
        ← Impostazioni
      </Link>
      <h1 className="mt-2 font-serif text-xl font-medium">Sincronizzazioni e libro soci</h1>
      <p className="mt-1 text-sm text-[#5f524c]">
        Qui aggiorni le fonti dei dati. Per cercare persone e segnare le quote pagate usa la sezione Persone.
      </p>
      <div className="mt-3">
        <SyncSociButton />
      </div>
      <SociBookUpload />
      <details id="quote-email" className="mt-4 rounded-xl border border-[#211815]/10 bg-white/65 p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Pagamenti email da verificare {mail.ok?`· ${mail.payments.length}`:""}
        </summary>
        <p className="mt-2 text-xs text-[#5f524c]">
          PayPal e Qonto: i pagamenti importati vanno associati manualmente alla persona corretta.
          Non modificano automaticamente il libro ufficiale.
        </p>
        {mail.ok?(
          <div className="mt-3">
            <PaymentEmailReview payments={mail.payments}
              periods={Array.from({length:Math.max(1,Number(todayInRome().slice(0,4))-2025+2)},(_,i)=>membershipPeriodFor(`${2025+i}-01-01`))
                .filter((p):p is NonNullable<typeof p>=>Boolean(p))
                .filter((p,i,all)=>all.findIndex(other=>other.paymentsFrom===p.paymentsFrom)===i)
                .map(p=>({from:p.paymentsFrom,label:p.paymentsFrom==="2025-09-01"?"2025/26":p.paymentsFrom.slice(0,4)}))}
              defaultPeriod={membershipPeriodFor(todayInRome())?.paymentsFrom??"2025-09-01"}
            />
          </div>
        ):<Notice tone="error">{mail.error}</Notice>}
      </details>
      <details id="allineamento-anagrafiche" open className="mt-4 rounded-xl border border-[#211815]/10 bg-white/65 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Allinea persone con il libro soci</summary>
        <p className="mt-2 text-xs text-[#5f524c]">
          Aggiorna la verifica associativa e collega le persone alle corrispondenze del libro soci. Per caricare un nuovo export Team Artist usa il riquadro qui sopra; il libro ufficiale non viene modificato da questi collegamenti.
        </p>
        <div className="mt-2"><RefreshMembershipButton /></div>
        {completable && completable.length > 0 ? (
          <div className="mt-2"><CompleteAllFromMembers count={completable.length} /></div>
        ) : null}
        {!result ? (
          <div className="mt-3">
            <Notice tone="error">Lettura del libro soci non riuscita.</Notice>
          </div>
        ) : (
          <>
            {result.alreadyVerified>0 ? (
              <p className="mt-3 text-xs text-[#326941]">
                {result.alreadyVerified} {result.alreadyVerified===1?"persona già verificata":"persone già verificate"} nel libro soci: nessuna nuova conferma necessaria.
              </p>
            ):null}
            <MemberLinkReview proposals={result.proposals} />
            <details className="mt-4 rounded-xl border border-[#211815]/10 bg-white/45 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#5f524c]">
                Schede senza corrispondenza · {result.none.length}
              </summary>
              <p className="mt-2 text-xs text-[#5f524c]">Solo archivio: non indica quote da pagare o soci da verificare.</p>
              <Section title="Elenco" count={result.none.length}>
              {result.none.length === 0 ? <p className="text-sm text-[#5f524c]">Nessuna.</p> : (
                <ul className={`${cardClass} divide-y divide-[#211815]/5 text-sm`}>
                  {result.none.map((person) => (
                    <li key={person.id}>
                      <Link prefetch={false} href={`/gestione/p/${person.id}`} className="flex min-h-10 flex-wrap items-center gap-x-2 px-3 py-2">
                        <span className="font-semibold underline">{person.name}</span>
                        <span className="break-all text-[#5f524c]">{person.email ?? "senza email"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              </Section>
            </details>
          </>
        )}
      </details>


    </section>
  );
}
