export const maxDuration = 120;

import Link from "next/link";

import { MembershipComparisonTable } from "@/components/gestionale/MembershipComparisonTable";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { isLinkedMembershipEnabled } from "@/lib/gestionale/server/linked-membership";
import { compareLinkedMembership } from "@/lib/gestionale/server/linked-membership-compare";
import { todayInRome } from "@/lib/gestionale/workshops";

// Fase C audit anagrafica: chi cambierebbe colore con il nuovo calcolo.
export default async function ConfrontoStatoSociPage({
  searchParams,
}: {
  searchParams: Promise<{ passati?: string | string[] }>;
}) {
  await requireAdmin();
  const includePast = (await searchParams).passati === "1";
  let result: Awaited<ReturnType<typeof compareLinkedMembership>> | null = null;
  let failure: string | null = null;
  try {
    result = await compareLinkedMembership(todayInRome(), includePast);
  } catch (error) {
    console.error("Gestionale: confronto stato soci", (error as Error).message);
    failure = "Confronto non disponibile. Controlla che le migrazioni 050 e 051 siano applicate.";
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-2xl">Confronto stato soci</h1>
        <Link prefetch={false} href="/gestione/altro/soci" className="text-sm text-[#a8583e] underline">Torna alle verifiche</Link>
      </div>
      <p className="text-sm text-[#5f524c]">
        Persone il cui pallino cambia passando dal calcolo attuale (email e nome confrontati a ogni caricamento) a quello nuovo
        (collegamenti salvati). Le righe <strong>Da chiarire</strong> si sistemano qui: scegli chi è, e la scelta vale anche
        nelle pagine evento. Controlla soprattutto chi passa da In regola a Non in regola.
        {isLinkedMembershipEnabled() ? " Il nuovo calcolo è già attivo nelle pagine evento." : " Il nuovo calcolo non è ancora attivo nelle pagine evento."}
      </p>
      <p className="text-sm">
        {includePast ? "Eventi degli ultimi 30 giorni e dei prossimi 60. " : "Eventi dei prossimi 60 giorni. "}
        <Link prefetch={false} href={includePast ? "/gestione/altro/soci/confronto" : "/gestione/altro/soci/confronto?passati=1"} className="text-[#a8583e] underline">
          {includePast ? "Solo eventi futuri" : "Includi gli ultimi 30 giorni"}
        </Link>
      </p>

      {failure ? <p role="alert" className="rounded-xl bg-[#fdf3e1] p-3 text-sm">{failure}</p> : null}

      {result ? (
        <>
          <p className="text-sm">
            <strong>{result.rows.length}</strong> {result.rows.length === 1 ? "differenza" : "differenze"} su {result.people}{" "}
            {result.people === 1 ? "persona" : "persone"} in {result.events} {result.events === 1 ? "evento" : "eventi"}.
          </p>
          {result.errors.length ? (
            <ul className="rounded-xl bg-[#fdf3e1] p-3 text-sm">
              {result.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : null}
          {result.rows.length ? (
            <MembershipComparisonTable rows={result.rows} />
          ) : <p className="text-sm text-[#326941]">Nessuna differenza: i due calcoli coincidono.</p>}
        </>
      ) : null}
    </section>
  );
}
