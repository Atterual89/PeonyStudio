"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";

import { requireOperator } from "@/lib/gestionale/server/auth";
import { setPresent } from "@/lib/gestionale/server/mutations";
import type { ActionResult } from "@/lib/gestionale/types";
import { isUuidLike, isVersion } from "@/lib/gestionale/validation";

// D27 (Fase 5): spunta "Presente", una per iscrizione, sulla riga chiusa del
// tab Iscrizioni di Ale e del tab Partecipanti (requireOperator: tutti e due i
// ruoli). Non cambia lo stato dell'iscrizione né i dati associativi; restituisce
// solo la nuova versione.

export async function setPresentAction(input: { bookingId: string; version: number; present: boolean }): Promise<ActionResult<{ version: number }>> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.bookingId) || !isVersion(input.version) || typeof input.present !== "boolean") {
    return { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };
  }
  const result = await setPresent(operator.id, input.bookingId, input.version, input.present);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { version: result.data } };
}
