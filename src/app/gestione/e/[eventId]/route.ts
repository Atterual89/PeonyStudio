import { redirect } from "next/navigation";

import { requireOperator } from "@/lib/gestionale/server/auth";
import { getLuxuriaEvent } from "@/lib/gestionale/server/events";
import { ensureWorkshopForEvent } from "@/lib/gestionale/server/mutations";

// D14: apertura di un evento LuXuria dalla dashboard. Crea (se manca) la riga
// gw_workshops collegata, aggiorna la copia di nome e date, e apre il
// dettaglio. Nella dashboard il link è un <a> semplice, senza prefetch, così
// la riga si crea solo quando qualcuno apre davvero l'evento.

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const operator = await requireOperator();
  const { eventId } = await params;

  const event = await getLuxuriaEvent(eventId);
  if (!event) redirect("/gestione");

  const result = await ensureWorkshopForEvent(operator.id, event);
  if (!result.ok) {
    console.error("Gestionale apertura evento:", result.error);
    redirect("/gestione?errore=evento");
  }

  redirect(`/gestione/w/${result.data}`);
}
