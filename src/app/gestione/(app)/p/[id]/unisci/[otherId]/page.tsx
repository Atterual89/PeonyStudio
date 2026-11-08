import Link from "next/link";
import { notFound } from "next/navigation";

import { MergeForm } from "@/components/gestionale/MergeForm";
import { Notice } from "@/components/gestionale/ui";
import { displayName } from "@/lib/gestionale/format";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson } from "@/lib/gestionale/server/data";
import { memberKeyOfPerson } from "@/lib/gestionale/member-key";
import { getMemberSummary } from "@/lib/gestionale/server/membership";

export default async function UnisciPage({ params }: { params: Promise<{ id: string; otherId: string }> }) {
  await requireAdmin();
  const { id, otherId } = await params;

  const [primary, secondary] = await Promise.all([getPerson(id), getPerson(otherId)]);
  if (!primary || !secondary || primary.id === secondary.id) notFound();

  const memberKeys = [memberKeyOfPerson(primary), memberKeyOfPerson(secondary)].filter((v): v is string => Boolean(v));
  const members = await Promise.all(memberKeys.map(getMemberSummary));
  const memberLabels = Object.fromEntries(
    members
      .filter((m) => m !== null)
      .map((m) => [m.id, [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email || "Socio"]),
  );

  return (
    <section className="max-w-3xl">
      <Link prefetch={false} href={`/gestione/p/${primary.id}`} className="text-sm text-[#5f524c] underline">
        ← {displayName(primary)}
      </Link>
      <h1 className="mt-2 font-serif text-xl font-medium">Unisci schede</h1>
      <p className="mt-1 text-[#5f524c]">
        Principale: <strong>{displayName(primary)}</strong> · da unire: <strong>{displayName(secondary)}</strong>
      </p>
      <p className="mt-3 rounded-xl border border-[#a8583e]/20 bg-[#f8f3ea] p-3 text-sm">
        I nomi usati per l'iscrizione possono essere diversi dal nome anagrafico e resteranno nello storico del workshop.
        Unisci solo se tutte le iscrizioni della seconda scheda appartengono alla stessa persona.
        Se un nome come «Pavel/Maru» indica due persone distinte, verifica prima il partecipante effettivo.
      </p>

      <div className="mt-5">
        {primary.merged_into || secondary.merged_into ? (
          <Notice tone="warning">Una delle due schede è già stata unita.</Notice>
        ) : (
          <MergeForm primary={primary} secondary={secondary} memberLabels={memberLabels} />
        )}
      </div>
    </section>
  );
}
