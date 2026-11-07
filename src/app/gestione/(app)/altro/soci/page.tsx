export const maxDuration = 120;

import Link from "next/link";

import { MemberLinkReview } from "@/components/gestionale/MemberLinkReview";
import { RefreshMembershipButton } from "@/components/gestionale/QuotaOk";
import { SyncSociButton } from "@/components/gestionale/SyncSociButton";
import { SociBookUpload } from "@/components/gestionale/SociBookUpload";
import { SociReviewList } from "@/components/gestionale/SociReviewList";
import { Notice, Section, cardClass } from "@/components/gestionale/ui";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { findMemberLinkProposals } from "@/lib/gestionale/server/member-links";
import { loadSociReviewData } from "@/lib/gestionale/server/soci";

// Fase 5: collegamento in blocco al libro soci. Solo admin (D18). Le persone
// senza collegamento al libro soci con il socio proposto: per email
// (preselezionate) o per nome e cognome (da confermare una per una).

export default async function SociPage() {
  await requireAdmin();
  const result = await findMemberLinkProposals().catch((error: unknown) => {
    console.error("Gestionale (proposte libro soci):", error instanceof Error ? error.message : error);
    return null;
  });

  const registrations = await loadSociReviewData().catch((error: unknown) => {
    console.error("Gestionale (domande soci):", error instanceof Error ? error.message : error);
    return null;
  });

  const shortDate = (value: string | null) => value
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value))
    : "non disponibile";

  return (
    <section className="max-w-3xl">
      <Link prefetch={false} href="/gestione/altro" className="text-sm text-[#5f524c] underline">
        ← Altro
      </Link>
      <h1 className="mt-2 font-serif text-xl font-medium">Registrazioni associazione</h1>
      <p className="mt-1 text-sm text-[#5f524c]">
        Le domande arrivano dal modulo Google. Segna la quota pagata quando ricevi il pagamento; l'export Team Artist può essere caricato qui sotto.
      </p>
      <div className="mt-3">
        <SyncSociButton />
      </div>
      <SociBookUpload />
      {registrations ? (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/75 p-2">
              <p className="font-semibold">{registrations.formCount}</p>
              <p className="text-xs text-[#5f524c]">Domande registrate</p>
            </div>
            <div className="rounded-xl bg-white/75 p-2">
              <p className="font-semibold">{registrations.paidCount}</p>
              <p className="text-xs text-[#5f524c]">Quote pagate</p>
            </div>
            <div className="rounded-xl bg-white/75 p-2">
              <p className="font-semibold text-[#9b4b1e]">{registrations.pendingCount}</p>
              <p className="text-xs text-[#5f524c]">Da verificare</p>
            </div>
          </div>
          <details className="mt-2 text-xs text-[#5f524c]">
            <summary className="w-fit cursor-pointer py-1 text-[#a8583e]">Date dei dati</summary>
            <p>Domande: {shortDate(registrations.formUpdatedAt)} · Libro soci: {shortDate(registrations.bookUpdatedAt)}</p>
          </details>
          <div className="mt-4 rounded-xl border border-[#211815]/10 bg-white/65 p-3">
            <h2 className="text-sm font-semibold">Domande e quote associative</h2>
            <SociReviewList rows={registrations.rows} />
          </div>
        </div>
      ) : (
        <div className="mt-3"><Notice tone="error">Impossibile caricare il riepilogo delle registrazioni.</Notice></div>
      )}
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
