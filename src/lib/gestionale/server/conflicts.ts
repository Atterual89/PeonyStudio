import "server-only";

import { CONFLICT_MESSAGE, conflictText } from "@/lib/gestionale/errors";
import { PARTY_LABELS, partyOfRole } from "@/lib/gestionale/labels";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import type { ActionResult, OperatorRole } from "@/lib/gestionale/types";

// 4g (#19): sul conflitto di versione si dice chi ha appena cambiato i dati,
// dall'ultima riga dello storico di quella riga. Come D25: solo Peony / Ale
// (dal ruolo), mai il nome dell'operatore; "Hai appena cambiato" se è stato
// lo stesso operatore da un'altra schermata.

async function lastChangedBy(entityId: string, operatorId: string): Promise<string | null> {
  const db = getGestionaleDb();
  const { data } = await db
    .from("gw_audit_log")
    .select("operator_id")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(1);
  const author = (data?.[0] as { operator_id: string | null } | undefined)?.operator_id ?? null;
  if (author === operatorId) return "io";
  if (!author) return PARTY_LABELS.peony;
  const { data: operator } = await db.from("gw_operators").select("role").eq("id", author).maybeSingle();
  return partyOfRole((operator as { role: OperatorRole } | null)?.role ?? null);
}

/** Se il risultato è un conflitto, lo riscrive con chi ha cambiato `what` ("questa iscrizione", "il prezzo del workshop"). */
export async function explainConflict<T>(result: ActionResult<T>, entityId: string, operatorId: string, what: string): Promise<ActionResult<T>> {
  if (result.ok || result.error !== CONFLICT_MESSAGE) return result;
  try {
    return { ok: false, error: conflictText(await lastChangedBy(entityId, operatorId), what) };
  } catch {
    return result;
  }
}
