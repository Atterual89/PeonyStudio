import Link from "next/link";

import { MemberLinkReview } from "@/components/gestionale/MemberLinkReview";
import { RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
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
      <h1 className="mt-2 font-serif text-xl font-medium">Collega al libro soci</h1>
      <p className="mt-1 text-sm text-[#5f524c]">
        Persone del gestionale non ancora collegate a un socio. Collegare scrive solo il collegamento della persona (con storico) e completa i suoi campi
        vuoti; il libro soci non cambia.
      </p>
      <div className="mt-2">
        <RefreshMembershipButton />
      </div>

      {!result ? (
        <div className="mt-4">
          <Notice tone="error">Lettura del libro soci non riuscita. Riprova tra poco.</Notice>
        </div>
      ) : (
        <>
          <MemberLinkReview proposals={result.proposals} />
          <Section title="Nessuna corrispondenza" count={result.none.length}>
            {result.none.length === 0 ? (
              <p className="text-sm text-[#5f524c]">Nessuna.</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-[#5f524c]">Nessun socio con la stessa email, o più soci con lo stesso nome: apri la scheda e cerca nel libro soci.</p>
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
              </>
            )}
          </Section>
        </>
      )}
    </section>
  );
}
