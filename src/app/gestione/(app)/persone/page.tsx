import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { CompleteAllFromMembers } from "@/components/gestionale/CompleteAllFromMembers";
import { NewPersonForm } from "@/components/gestionale/NewPersonForm";
import { UrlSearchBox } from "@/components/gestionale/UrlSearchBox";
import { cardClass } from "@/components/gestionale/ui";
import { displayName } from "@/lib/gestionale/format";
import { searchPeople } from "@/lib/gestionale/people";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
import { listCompletablePeople } from "@/lib/gestionale/server/member-fill";

export default async function PersonePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";

  const all = (await loadPeople()).filter((person) => !person.merged_into);
  // Solo lettura: le schede si completano solo con il pulsante.
  const completable = await listCompletablePeople().catch((error: unknown) => {
    console.error("Gestionale (completa dal libro soci):", error instanceof Error ? error.message : "errore");
    return null;
  });
  const people =
    query.trim().length > 0
      ? searchPeople(all, query, 200)
      : [...all].sort((a, b) => displayName(a).localeCompare(displayName(b), "it"));

  return (
    <section>
      <h1 className="font-serif text-xl font-medium">Persone</h1>
      <p className="mt-1 text-sm text-[#5f524c]">{all.length} persone in anagrafica</p>

      <div className="mt-4">
        <NewPersonForm />
      </div>

      {completable ? (
        <div className="mt-4">
          <CompleteAllFromMembers count={completable.length} />
        </div>
      ) : null}

      <div className="mt-4">
        <UrlSearchBox initialQuery={query} placeholder="Cerca per nickname, nome, email, instagram" />
      </div>

      {people.length === 0 ? (
        <p className="mt-3 text-sm text-[#5f524c]">Nessuna persona trovata.</p>
      ) : (
        <ul className={`${cardClass} mt-4 divide-y divide-[#211815]/5`}>
          {people.map((person) => (
            <li key={person.id}>
              <Link prefetch={false} href={`/gestione/p/${person.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  <span className="block font-semibold">{displayName(person)}</span>
                  <span className={`block truncate text-sm ${person.email ? "text-[#5f524c]" : "font-medium text-[#9b2c2c]"}`}>
                    {person.email ?? "Email mancante"}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#5f524c]" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
