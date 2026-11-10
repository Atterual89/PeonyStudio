/** Controlli non distruttivi sull'integrità dell'importazione dei moduli Google. */

type StoredForm = {
  id: string;
  source_row_id: string | null;
  email: string | null;
};

/**
 * Ogni risposta Google ha un source_row_id stabile.
 * Lo storico può contenere più copie della stessa risposta: non sono
 * registrazioni aggiuntive e non devono far scattare falsi allarmi.
 * La email è un fallback solo per le vecchie righe senza source_row_id.
 */
export function distinctStoredGoogleForms(rows: readonly StoredForm[]): number {
  return new Set(rows.map(row =>
    row.source_row_id?.trim() ||
    (row.email?.trim() ? `email:${row.email.trim().toLowerCase()}` : `id:${row.id}`)
  )).size;
}

/** Il confronto ha senso solo tra numeri di registrazioni *distinte*. */
export function isGoogleFormImportSuspicious(currentUnique: number, previousUnique: number): boolean {
  return previousUnique >= 30 && currentUnique < previousUnique * 0.75;
}
