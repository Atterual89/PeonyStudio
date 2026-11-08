export const maxDuration = 60;

import Link from "next/link";

import { NewPersonForm } from "@/components/gestionale/NewPersonForm";
import { UnifiedPeopleDirectory } from "@/components/gestionale/UnifiedPeopleDirectory";
import { Notice } from "@/components/gestionale/ui";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { loadUnifiedDirectory } from "@/lib/gestionale/server/unified-directory";
import { buildUnifiedDirectory } from "@/lib/gestionale/unified-directory";
import { todayInRome } from "@/lib/gestionale/workshops";

/**
 * One searchable directory only. Event summaries and multi-year form checks
 * belong to the Eventi screen and must not block or slow down looking up a
 * person by nickname. A temporary failure of the membership book must not
 * make the local person registry inaccessible.
 */
export default async function PersonePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const today = todayInRome();

  let membershipUnavailable = false;
  let contacts;
  try {
    contacts = await loadUnifiedDirectory(today);
  } catch (error) {
    console.error("[gestionale] Persone: libro soci non disponibile", error instanceof Error ? error.message : error);
    membershipUnavailable = true;
    // Still render the known local people. Their association status is unknown,
    // not "missing" or "unverified": never imply a payment check succeeded.
    const people = await loadPeople();
    contacts = buildUnifiedDirectory({ people, evidence: [], today })
      .map(contact => ({ ...contact, association: "non_disponibile" as const }));
  }

  return <section className="mx-auto max-w-4xl space-y-3">
    <Link prefetch={false} href="/gestione" className="text-sm text-[#5f524c] underline">← Gestionale</Link>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-serif text-xl font-medium">Persone</h1>
        <p className="mt-1 text-sm text-[#5f524c]">Un solo elenco: nickname, anagrafica e libro soci.</p>
      </div>
      <NewPersonForm />
    </div>
    {membershipUnavailable&&
      <Notice tone="warning">Il libro soci non è raggiungibile. Puoi comunque trovare e aprire le anagrafiche; lo stato delle quote non è disponibile.</Notice>}
    <UnifiedPeopleDirectory key={query} contacts={contacts} initialQuery={query}/>
    <p className="text-xs text-[#5f524c]">
      Le iscrizioni ai corsi si trovano nella sezione Eventi. Il collegamento al libro soci non registra automaticamente il pagamento della quota.
    </p>
  </section>;
}
