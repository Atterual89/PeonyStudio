import "server-only";

import { refresh, revalidatePath } from "next/cache";

/**
 * Dopo ogni scrittura (4d): invalida tutte le pagine del gestionale e
 * aggiorna subito quella aperta (riga chiusa, blocco aperto, riepiloghi e
 * filtri) senza ricaricare. Da chiamare solo nelle server action.
 */
export function refreshGestione(): void {
  revalidatePath("/gestione", "layout");
  refresh();
}
