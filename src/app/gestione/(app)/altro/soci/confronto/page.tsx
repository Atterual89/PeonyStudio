export const maxDuration = 120;

import Link from "next/link";

import { formatShortDate } from "@/lib/gestionale/membership-rule";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { isLinkedMembershipEnabled } from "@/lib/gestionale/server/linked-membership";
import { compareLinkedMembership, type ComparisonRow } from "@/lib/gestionale/server/linked-membership-compare";
import { todayInRome } from "@/lib/gestionale/workshops";

const LABEL: Record<ComparisonRow["before"], string> = {
  verde: "In regola",
  rosso: "Non in regola",
  giallo: "Da chiarire",
  non_collegata: "Non collegata",
};
const COLOR: Record<ComparisonRow["before"], string> = {
  verde: "text-[#326941]",
  rosso: "text-[#9b2c2c]",
  giallo: "text-[#7a5212]",
  non_collegata: "text-[#5f524c]",
};

// Fase C audit anagrafica: chi cambierebbe colore con il nuovo calcolo.
export default async function ConfrontoStatoSociPage() {
  await requireAdmin();
  let result: Awaited<ReturnType<typeof compareLinkedMembership>> | null = null;
  let failure: string | null = null;
  try {
    result = await compareLinkedMembership(todayInRome());
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
        Eventi degli ultimi 30 giorni e dei prossimi 60. Qui compaiono solo le persone il cui pallino cambia passando dal calcolo
        attuale (email e nome confrontati a ogni caricamento) a quello nuovo (collegamenti salvati).
        {isLinkedMembershipEnabled() ? " Il nuovo calcolo è già attivo nelle pagine evento." : " Il nuovo calcolo non è ancora attivo nelle pagine evento."}
      </p>

      {failure ? <p role="alert" className="rounded-xl bg-[#fdf3e1] p-3 text-sm">{failure}</p> : null}

      {result ? (
        <>
          <p className="text-sm">
            <strong>{result.rows.length}</strong> differenze su {result.people} persone in {result.events} eventi.
          </p>
          {result.errors.length ? (
            <ul className="rounded-xl bg-[#fdf3e1] p-3 text-sm">
              {result.errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          ) : null}
          {result.rows.length ? (
            <div className="overflow-x-auto rounded-xl bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[#5f524c]">
                    <th scope="col" className="px-3 py-2">Evento</th>
                    <th scope="col" className="px-3 py-2">Persona</th>
                    <th scope="col" className="px-3 py-2">Oggi</th>
                    <th scope="col" className="px-3 py-2">Nuovo</th>
                    <th scope="col" className="px-3 py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`${row.eventId}-${row.name}-${index}`} className="border-t border-[#211815]/10">
                      <td className="px-3 py-2">
                        <Link prefetch={false} href={row.href} className="underline">{row.eventName}</Link>
                        <span className="block text-xs text-[#5f524c]">{row.eventDate ? formatShortDate(row.eventDate) : ""}</span>
                      </td>
                      <td className="px-3 py-2 font-semibold">{row.name}</td>
                      <td className={`px-3 py-2 ${COLOR[row.before]}`}>{LABEL[row.before]}</td>
                      <td className={`px-3 py-2 font-semibold ${COLOR[row.after]}`}>{LABEL[row.after]}</td>
                      <td className="px-3 py-2 text-[#5f524c]">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-[#326941]">Nessuna differenza: i due calcoli coincidono.</p>}
        </>
      ) : null}
    </section>
  );
}
