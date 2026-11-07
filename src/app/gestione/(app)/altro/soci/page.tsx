export const maxDuration = 120;

import Link from "next/link";

import { MemberLinkReview } from "@/components/gestionale/MemberLinkReview";
import { RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
import { SyncSociButton } from "@/components/gestionale/SyncSociButton";
import { Notice, Section, cardClass } from "@/components/gestionale/ui";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { findMemberLinkProposals } from "@/lib/gestionale/server/member-links";

// Fase 5: collegamento in blocco al libro soci. Solo admin (D18). Le persone
// senza collegamento al libro soci con il socio proposto: per email
// (preselezionate) o per nome e cognome (da confermare una per una).

export default async function SociPage() {
  await requireAdmin();
  const result = await findMemberLinkProposals().catch((error: unknown) => {
    console.error("Gestionale (proposte libro soci):", error instanceof Error ? error.message : error);
    return null;
  });

  return (
    <section className="max-w-3xl">
      <Link prefetch={false} href="/gestione/altro" className="text-sm text-[#5f524c] underline">
        ← Altro
      </Link>
      <h1 className="mt-2 font-serif text-xl font-medium">Registrazioni associazione</h1>
      <p className="mt-1 text-sm text-[#5f524c]">
        Confronta le domande ricevute e il libro soci. Le conferme di pagamento più recenti
        vanno sempre verificate su TeamArtist, che non è collegato direttamente.
      </p>
      <div className="mt-3">
        <SyncSociButton />
      </div>
      <details className="mt-4 rounded-xl border border-[#211815]/10 bg-white/65 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Collegamenti anagrafici</summary>
        <p className="mt-2 text-xs text-[#5f524c]">
          Collega le schede del gestionale alle corrispondenze nel libro soci. Non modifica il libro.
        </p>
        <div className="mt-2"><RefreshMembershipButton /></div>
        {!result ? (
          <div className="mt-3">
            <Notice tone="error">Lettura del libro soci non riuscita.</Notice>
          </div>
        ) : (
          <>
            <MemberLinkReview proposals={result.proposals} />
            <Section title="Nessuna corrispondenza" count={result.none.length}>
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
          </>
        )}
      </details>


    </section>
  );
}
