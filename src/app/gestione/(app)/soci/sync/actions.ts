"use server";

import { createHash } from "node:crypto";
import { isGoogleFormImportSuspicious } from "@/lib/association/form-import-integrity";
import { MAX_BOOK_FILE_SIZE, parseWorkbook, replaceMembersBook, validateMembersBook } from "@/lib/association/book-upload";
import {
  applyAssociationMembersSync,
  applyPreviewedGoogleFormRow,
  refreshGoogleFormCopyToCurrent,
  buildAssociationMembersSyncPreview,
  type AssociationMembersSyncPreview,
} from "@/lib/association/members-sync";
import { applyOfficialMembersBookSync } from "@/lib/association/members-book-sync";
import { buildGoogleFormReviewQueue, clearFormCases, doubtfulFormCases, type FormReviewCase } from "@/lib/gestionale/google-form-review";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { loadPeople } from "@/lib/gestionale/server/data";
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
  // Il database storico conserva anche copie duplicate degli stessi moduli.
  // La fonte Google restituisce UNA registrazione per identità, quindi
  // confrontiamo registrazioni distinte con registrazioni distinte.
  const previousUniqueForms = forms.existingUniqueRows;
  if (isGoogleFormImportSuspicious(forms.validRows, previousUniqueForms)) {
    throw new SociSyncError(
      `Dati Google potenzialmente incompleti: ${forms.validRows} registrazioni distinte lette, ${previousUniqueForms} registrazioni distinte già salvate. Controlla i fogli italiano e inglese. Nessuna cancellazione.`
    );
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
    // Verifica dopo la scrittura: un modulo Google può essere presente nella
    // fonte ma assente in Supabase (es. riga saltata da una sync parziale).
    // Non dichiarare "aggiornato" se anche una sola email manca.
    const storedEmails = new Set<string>();
    for (let offset = 0; offset < 10000; offset += 500) {
      const {data,error} = await db.from("association_members")
        .select("email").eq("source","google_sheet")
        .order("id",{ascending:true}).range(offset,offset+499);
      if (error) throw new SociSyncError("Impossibile verificare la completezza delle registrazioni importate.");
      for (const member of data??[]) {
        if (member.email) storedEmails.add(member.email.trim().toLowerCase());
      }
      if ((data??[]).length < 500) break;
    }
    const missingForms = forms.validSourceRows.filter(row =>
      row.email && !storedEmails.has(row.email.trim().toLowerCase()));
    await clearMembershipCache();
    refreshGestione();
    if (missingForms.length) {
      console.error("[gestionale] Moduli Google non importati",missingForms.map(row=>row.source_row_id));
      return {ok:false,message:`Sincronizzazione incompleta: ${missingForms.length} moduli Google ancora assenti nel database. Nessuna registrazione precedente è stata cancellata.`};
    }
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

export type ClearFormsImport =
  | { ok: true; consolidated: number; created: number; updated: number; failed: number; toClarify: number }
  | { ok: false; message: string };

type Db = ReturnType<typeof createSupabaseAdminClient>;

async function loadReviewCases(db: Db, forms: AssociationMembersSyncPreview) {
  const [people, membersResponse] = await Promise.all([
    loadPeople(),
    db.from("association_members")
      .select("id,source,source_row_id,first_name,last_name,email,membership_status,contact,membership_starts_at,membership_expires_at")
      .in("source", ["google_sheet", "manual_override", "manual_form"]).order("id").range(0, 9999),
  ]);
  if (membersResponse.error) throw new SociSyncError("Impossibile leggere i moduli già salvati. Nessun dato modificato.");
  return buildGoogleFormReviewQueue({ preview: forms, members: membersResponse.data ?? [], people });
}

/**
 * Copie dello stesso modulo Google con la stessa persona: tiene la versione
 * attuale e archivia le altre (gw_consolidate_identical_google_form_copies,
 * migrazione 047: blocca se nomi, email o dati differiscono, o se le copie
 * sono collegate a persone diverse). I conflitti di identità non si toccano.
 */
async function consolidateDuplicateCopies(db: Db, operatorId: string, forms: AssociationMembersSyncPreview, cases: readonly FormReviewCase[]) {
  let consolidated = 0, failed = 0;
  for (const item of cases) {
    if (item.kind !== "duplicate" || !item.sourceRowId) continue;
    const hash = forms.validSourceRows.find((row) => row.source_row_id === item.sourceRowId)?.source_hash;
    if (!hash || !/^[a-f0-9]{64}$/.test(hash)) { failed += 1; continue; }
    const consolidate = () => db.rpc("gw_consolidate_identical_google_form_copies", {
      p_source_row_id: item.sourceRowId, p_operator_id: operatorId, p_expected_source_hash: hash,
    });
    let { data, error } = await consolidate();
    // Nessuna copia ha ancora la versione Google attuale: aggiornane una e riprova.
    if (error && /non è ancora importata/.test(error.message) &&
        await refreshGoogleFormCopyToCurrent(db, forms, item.sourceRowId)) {
      ({ data, error } = await consolidate());
    }
    if (error) {
      failed += 1;
      console.warn("[gestionale] Copie modulo lasciate alla revisione", item.sourceRowId, error.message);
    } else consolidated += Number(data) || 0;
  }
  if (consolidated) await dropStaleFormSources(db);
  return { consolidated, failed };
}

/**
 * Le copie archiviate non sono più fonti: toglie dal registro le righe
 * automatiche o da confermare che puntano a un modulo non più presente.
 * Le decisioni esplicite (confermato, rifiutato) restano.
 */
async function dropStaleFormSources(db: Db) {
  const sources: { id: string; source_ref: string }[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await db.from("gw_person_sources").select("id,source_ref")
      .eq("source_kind", "modulo_google").in("status", ["automatico", "da_confermare"])
      .order("id").range(offset, offset + 999);
    if (error) { console.error("[gestionale] Registro moduli non leggibile", error.code); return; }
    sources.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const existing = new Set<string>();
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await db.from("association_members").select("id")
      .eq("source", "google_sheet").order("id").range(offset, offset + 999);
    if (error) { console.error("[gestionale] Moduli non leggibili", error.code); return; }
    for (const row of data ?? []) existing.add(row.id as string);
    if ((data ?? []).length < 1000) break;
  }
  const stale = sources.filter((row) => !existing.has(row.source_ref)).map((row) => row.id);
  for (let i = 0; i < stale.length; i += 200) {
    const { error } = await db.from("gw_person_sources").delete().in("id", stale.slice(i, i + 200));
    if (error) console.error("[gestionale] Pulizia registro moduli non riuscita", error.code);
  }
}

/**
 * Passo 1 di Verifiche ("Aggiorna tutto"): legge i moduli Google, archivia le
 * copie doppie della stessa persona e importa da soli i moduli chiari
 * (nessuna persona o una sola persona possibile). Il database crea o collega
 * la scheda (trigger 045 e registro 051); omonimi, email diverse e copie con
 * dati diversi restano in "Persone da chiarire". Quote e pagamenti non cambiano.
 */
export async function importClearGoogleFormsAction(): Promise<ClearFormsImport> {
  const operator = await requireAdmin();
  if (missingConfig()) return configError();
  try {
    const db = createSupabaseAdminClient();
    let { forms } = await loadPreview();
    let cases = await loadReviewCases(db, forms);
    const copies = await consolidateDuplicateCopies(db, operator.id, forms, cases);
    if (copies.consolidated) {
      // Le righe archiviate cambiano cosa va creato o aggiornato: rileggi.
      ({ forms } = await loadPreview());
      cases = await loadReviewCases(db, forms);
    }
    let created = 0, updated = 0, failed = 0;
    for (const item of clearFormCases(cases)) {
      try {
        const result = await applyPreviewedGoogleFormRow(db, forms, item.sourceRowId!, item.sourceHash!);
        if (result.kind === "created") created += 1;
        else if (result.kind === "updated") updated += 1;
      } catch (error) {
        // Bloccato dai controlli (es. email diversa dalla riga esistente): resta da chiarire.
        failed += 1;
        console.warn("[gestionale] Modulo Google lasciato alla revisione", item.sourceRowId, error instanceof Error ? error.message : error);
      }
    }
    if (created || updated || copies.consolidated) {
      await clearMembershipCache();
      refreshGestione();
    }
    return { ok: true, consolidated: copies.consolidated, created, updated, failed, toClarify: doubtfulFormCases(cases).length + failed };
  } catch (error) {
    console.error("[gestionale] Importazione automatica moduli Google non riuscita", error);
    return { ok: false, message: error instanceof SociSyncError ? error.message : "Impossibile leggere i moduli Google. Nessun dato modificato." };
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

