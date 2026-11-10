"use server";

import { createHash } from "node:crypto";
import { MAX_BOOK_FILE_SIZE, parseWorkbook, replaceMembersBook, validateMembersBook } from "@/lib/association/book-upload";
import {
  applyAssociationMembersSync,
  buildAssociationMembersSyncPreview,
  type AssociationMembersSyncPreview,
} from "@/lib/association/members-sync";
import { applyOfficialMembersBookSync, buildOfficialMembersBookSyncPreview } from "@/lib/association/members-book-sync";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { clearMembershipCache } from "@/lib/gestionale/server/membership";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SourceSummary = {
  rows: number;
  creates: number;
  updates: number;
  unchanged: number;
  invalid: number;
};

type SyncPreview =
  | { ok: true; token: string; forms: SourceSummary; warningCount: number }
  | { ok: false; message: string };

type SyncOutcome =
  | { ok: true; forms: { created: number; updated: number }; warnings: number }
  | { ok: false; message: string };

// Le risposte dei moduli Google non dipendono dal Libro Soci TeamArtist,
// il quale viene importato separatamente dall'admin.
const GOOGLE_FORM_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SHEET_RANGE",
] as const;

class SociSyncError extends Error {}

function missingConfig(): boolean {
  return GOOGLE_FORM_ENV.some((name) => !process.env[name]?.trim());
}

function configError(): { ok: false; message: string } {
  return {
    ok: false,
    message: "Moduli Google non collegati al gestionale: mancano le credenziali o l'intervallo del foglio sul server. Configura le variabili Google nell'hosting effettivo del sito. Nessun dato modificato.",
  };
}

function sourceSummary(preview: AssociationMembersSyncPreview): SourceSummary {
  return {
    rows: preview.totalRows,
    creates: preview.wouldCreate,
    updates: preview.wouldUpdate,
    unchanged: preview.unchanged,
    invalid: preview.invalidRows,
  };
}

function fingerprint(forms: AssociationMembersSyncPreview): string {
  const reduced = {
    forms: forms.validSourceRows.map((row) => [row.source_row_id, row.source_hash]),
    actions: forms.previewRows.map((row) => [row.source_row_id, row.action, row.existingMemberId]),
  };
  return createHash("sha256").update(JSON.stringify(reduced)).digest("hex");
}

async function loadPreview() {
  const db = createSupabaseAdminClient();
  let forms: AssociationMembersSyncPreview;
  try {
    forms = await buildAssociationMembersSyncPreview(db);
  } catch (error) {
    console.error("[gestionale] Lettura risposte Google (IT/EN) non riuscita", error);
    throw new SociSyncError("Impossibile leggere le domande di associazione dai moduli Google (italiano o inglese). Verifica condivisione e accesso del service account a entrambi i fogli.");
  }
  if (forms.totalRows < 1 || forms.validRows < Math.max(1, Math.floor(forms.totalRows * 0.7)) || forms.errors.length > 0) {
    throw new SociSyncError("Il foglio delle domande Google è vuoto o non ha intestazioni e righe compatibili. Nessuna registrazione modificata.");
  }
  const result = await db.from("association_members")
    .select("id", { count: "exact", head: true })
    .eq("source", "google_sheet");
  if (result.error) {
    console.error("[gestionale] Conteggio domande salvate non riuscito", result.error.code);
    throw new SociSyncError("Impossibile confrontare le domande Google con i dati già salvati nel database. Nessun dato modificato.");
  }
  const previousForms = result.count ?? 0;
  if (previousForms >= 30 && forms.validRows < previousForms * 0.75) {
    throw new SociSyncError(`Dati Google incompleti: ${forms.validRows} risposte valide lette, ${previousForms} registrazioni già salvate. Controlla i fogli italiano e inglese e gli intervalli di lettura. Sincronizzazione sospesa per sicurezza: nessuna cancellazione.`);
  }
  return { forms };
}

export async function previewSociSyncAction(): Promise<SyncPreview> {
  await requireAdmin();
  if (missingConfig()) return configError();
  try {
    const { forms } = await loadPreview();
    return {
      ok: true,
      token: fingerprint(forms),
      forms: sourceSummary(forms),
      warningCount: forms.invalidRows,
    };
  } catch (error) {
    console.error("[gestionale] Anteprima sincronizzazione domande Google non riuscita", error);
    return { ok: false, message: error instanceof SociSyncError ? error.message : "Impossibile preparare la sincronizzazione delle domande Google. Nessun dato modificato." };
  }
}

export async function applySociSyncAction(expectedToken: string): Promise<SyncOutcome> {
  await requireAdmin();
  if (missingConfig()) return configError();
  if (!/^[a-f0-9]{64}$/.test(expectedToken)) return { ok: false, message: "Anteprima scaduta. Ricarica prima i dati." };
  try {
    const { forms } = await loadPreview();
    if (fingerprint(forms) !== expectedToken) {
      return { ok: false, message: "Le domande Google sono cambiate dopo l'anteprima: ripeti il controllo prima di aggiornare." };
    }
    const db = createSupabaseAdminClient();
    // Le domande non provano il pagamento; le validazioni manuali e il libro
    // ufficiale restano invariati. Nessuna riga viene rimossa.
    const report = await applyAssociationMembersSync(db, { removeStaleRows: false });
    await clearMembershipCache();
    refreshGestione();
    if (report.errors.length) {
      console.warn("[gestionale] Domande Google con righe da controllare", report.errors.length);
      return { ok: false, message: `Aggiornamento parziale: ${report.created} domande nuove, ${report.updated} modificate. Alcune righe richiedono verifica; nessuna cancellazione.` };
    }
    return {
      ok: true,
      forms: { created: report.created, updated: report.updated },
      warnings: forms.invalidRows,
    };
  } catch (error) {
    console.error("[gestionale] Sincronizzazione domande Google non riuscita", error);
    return {
      ok: false,
      message: "Sincronizzazione non completata. I dati precedenti sono consultabili; controlla le registrazioni prima di riprovare.",
    };
  }
}

/** Carica l'export XLSX Team Artist da Gestione: backup del foglio Google e sync non distruttiva. */
export async function uploadSociBookAction(formData: FormData):
  Promise<{ ok: true; rows: number; created: number; updated: number; backup: string } | { ok: false; message: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx"))
    return { ok: false, message: "Seleziona l'export .xlsx del Libro Soci di Team Artist." };
  if (file.size <= 0 || file.size > MAX_BOOK_FILE_SIZE)
    return { ok: false, message: "File vuoto o superiore a 12 MB." };
  if (["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GOOGLE_SHEET_ID"].some((name) => !process.env[name]?.trim()))
    return { ok: false, message: "Collegamento al Google Sheet non configurato in produzione." };

  let uploaded = false;
  try {
    const values = parseWorkbook(Buffer.from(await file.arrayBuffer()));
    validateMembersBook(values);
    const upload = await replaceMembersBook(values); // Salva una copia del tab prima di modificarlo.
    uploaded = true;
    const report = await applyOfficialMembersBookSync(createSupabaseAdminClient(), { removeStaleRows: false });
    await clearMembershipCache();
    refreshGestione();
    if (report.errors.length) {
      return { ok: false, message: `Libro Google aggiornato (backup "${upload.backupTitle}"), ma ${report.errors.length} righe richiedono un controllo. Le righe esistenti non sono state rimosse.` };
    }
    return { ok: true, rows: upload.importedRows, created: report.created, updated: report.updated, backup: upload.backupTitle };
  } catch (error) {
    console.error("[gestionale] Caricamento libro soci Team Artist non riuscito", error);
    return { ok: false, message: uploaded
      ? "Libro Google sostituito e backup creato, ma non è stato possibile completare la sincronizzazione nel database. Non ricaricare il file prima di verificare."
      : error instanceof Error ? error.message : "Caricamento non riuscito. Nessun dato modificato." };
  }
}


/**
 * Allinea il libro soci ufficiale dalla copia Google dell'export Team Artist.
 * Non è la lettura delle domande di associazione: le due fonti restano distinte.
 * La lettura e la scrittura avvengono solo su richiesta dell'admin, mai durante
 * il caricamento iniziale di Verifiche. Nessuna riga storica viene eliminata.
 */
export async function syncOfficialBookAction(): Promise<
  | { ok: true; rows: number; created: number; updated: number; unchanged: number }
  | { ok: false; message: string }
> {
  await requireAdmin();
  if (["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEET_ID", "GOOGLE_MEMBERS_BOOK_RANGE"].some(name => !process.env[name]?.trim())) {
    return { ok: false, message: "Libro soci Team Artist non collegato al foglio Google: configurazione incompleta sul server. Nessun dato modificato." };
  }
  try {
    const db = createSupabaseAdminClient();
    const [preview, previous] = await Promise.all([
      buildOfficialMembersBookSyncPreview(db),
      db.from("association_members").select("id", { count: "exact", head: true })
        .eq("source", "official_members_book"),
    ]);
    if (previous.error) {
      return { ok: false, message: "Impossibile verificare lo storico del libro soci: sincronizzazione sospesa." };
    }
    const existing = previous.count ?? 0;
    if (preview.errors.length || !preview.validRows || preview.invalidRows > Math.max(5, preview.totalRows * 0.1)) {
      return { ok: false, message: "Libro soci Google incompleto o con colonne non riconosciute. Controlla il foglio prima di riprovare: nessun dato modificato." };
    }
    if (existing >= 30 && preview.validRows < existing * 0.75) {
      return { ok: false, message: `Libro soci più corto dello storico (${preview.validRows}/${existing} righe). Importazione bloccata per evitare incongruenze.` };
    }
    if (!preview.wouldCreate && !preview.wouldUpdate) {
      return { ok: true, rows: preview.validRows, created: 0, updated: 0, unchanged: preview.unchanged };
    }
    const result = await applyOfficialMembersBookSync(db, { removeStaleRows: false });
    await clearMembershipCache();
    refreshGestione();
    if (result.errors.length) {
      return { ok: false, message: `Allineamento parziale: ${result.created} nuove, ${result.updated} aggiornate; ${result.errors.length} righe da controllare. Nessuna riga cancellata.` };
    }
    return {
      ok: true, rows: result.validRows, created: result.created,
      updated: result.updated, unchanged: result.unchanged,
    };
  } catch (error) {
    console.error("[gestionale] Allineamento libro soci da Google fallito", error instanceof Error ? error.message : error);
    return { ok: false, message: "Non riesco a leggere il libro soci ufficiale dal foglio Google. Verifica accessi del service account e intervallo Team Artist. Nessun dato è stato eliminato." };
  }
}
