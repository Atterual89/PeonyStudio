"use server";

import { createHash } from "node:crypto";
import { MAX_BOOK_FILE_SIZE, parseWorkbook, replaceMembersBook, validateMembersBook } from "@/lib/association/book-upload";

import {
  applyAssociationMembersSync,
  buildAssociationMembersSyncPreview,
  type AssociationMembersSyncPreview,
} from "@/lib/association/members-sync";
import {
  applyOfficialMembersBookSync,
  buildOfficialMembersBookSyncPreview,
  type OfficialMembersBookSyncPreview,
} from "@/lib/association/members-book-sync";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { clearMembershipCache } from "@/lib/gestionale/server/membership";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { todayInRome } from "@/lib/gestionale/workshops";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SourceSummary = {
  rows: number;
  creates: number;
  updates: number;
  unchanged: number;
  invalid: number;
};

type SyncPreview =
  | { ok: true; token: string; forms: SourceSummary; book: SourceSummary; warningCount: number }
  | { ok: false; message: string };

type SyncOutcome =
  | { ok: true; forms: { created: number; updated: number }; book: { created: number; updated: number }; warnings: number }
  | { ok: false; message: string };

const GOOGLE_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SHEET_RANGE",
  "GOOGLE_MEMBERS_BOOK_RANGE",
] as const;

function missingConfig(): boolean {
  return GOOGLE_ENV.some((name) => !process.env[name]?.trim());
}

function configError(): { ok: false; message: string } {
  return {
    ok: false,
    message: "Sincronizzazione soci non ancora configurata: sul progetto Vercel mancano le credenziali Google per il modulo e il libro soci. I dati già salvati rimangono disponibili; nessuna quota viene confermata automaticamente.",
  };
}

function sourceSummary(preview: AssociationMembersSyncPreview | OfficialMembersBookSyncPreview): SourceSummary {
  return {
    rows: preview.totalRows,
    creates: preview.wouldCreate,
    updates: preview.wouldUpdate,
    unchanged: preview.unchanged,
    invalid: preview.invalidRows,
  };
}

/** Token basato sui dati delle due sorgenti: applica solo il set effettivamente esaminato. */
function fingerprint(forms: AssociationMembersSyncPreview, book: OfficialMembersBookSyncPreview): string {
  const reduced = {
    forms: forms.validSourceRows.map((row) => [row.source_row_id, row.source_hash]),
    book: book.validSourceRows.map((row) => [row.source_row_id, row.source_hash]),
    formActions: forms.previewRows.map((row) => [row.source_row_id, row.action, row.existingMemberId]),
    bookActions: book.previewRows.map((row) => [row.rowNumber, row.action, row.existingMemberId]),
  };
  return createHash("sha256").update(JSON.stringify(reduced)).digest("hex");
}

async function loadPreview() {
  const db = createSupabaseAdminClient();
  const [forms, book] = await Promise.all([
    buildAssociationMembersSyncPreview(db),
    buildOfficialMembersBookSyncPreview(db),
  ]);
  // Un export parziale/malformato non deve mai alterare il registro dei soci.
  if (forms.totalRows < 1 || book.totalRows < 1 ||
      forms.validRows < Math.max(1, Math.floor(forms.totalRows * 0.7)) ||
      book.validRows < Math.max(1, Math.floor(book.totalRows * 0.7)) ||
      forms.errors.length > 0 || book.errors.length > 0) {
    throw new Error("Uno dei fogli è vuoto o contiene troppe righe non valide. Controllare le intestazioni e le risposte prima di aggiornare.");
  }
  const countFor = async (source: string) => {
    const result = await db.from("association_members")
      .select("id", { count: "exact", head: true })
      .eq("source", source);
    if (result.error) throw new Error("Non riesco a verificare la dimensione del registro già salvato.");
    return result.count ?? 0;
  };
  const currentYear = Math.max(2026, Number(todayInRome().slice(0, 4)));
  const countCurrentBook = async () => {
    const query = db.from("association_members").select("id", { count: "exact", head: true })
      .eq("source", "official_members_book");
    const result = currentYear === 2026
      ? await query.not("source_row_id", "like", "%:%")
      : await query.like("source_row_id", `${currentYear}:%`);
    if (result.error) throw new Error("Non riesco a verificare le righe del libro soci corrente.");
    return result.count ?? 0;
  };
  const [previousForms, previousBook] = await Promise.all([
    countFor("google_sheet"),
    countCurrentBook(),
  ]);
  if ((previousForms >= 30 && forms.validRows < previousForms * 0.75) ||
      (previousBook >= 30 && book.validRows < previousBook * 0.75)) {
    throw new Error("Uno dei fogli contiene molte meno righe rispetto al registro già salvato. Sincronizzazione bloccata per evitare aggiornamenti parziali.");
  }
  return { forms, book };
}

export async function previewSociSyncAction(): Promise<SyncPreview> {
  await requireAdmin();
  if (missingConfig()) return configError();
  try {
    const { forms, book } = await loadPreview();
    return {
      ok: true,
      token: fingerprint(forms, book),
      forms: sourceSummary(forms),
      book: sourceSummary(book),
      warningCount: forms.invalidRows + book.invalidRows,
    };
  } catch (error) {
    console.error("[gestionale] Anteprima sincronizzazione soci non riuscita", error);
    return { ok: false, message: "Impossibile leggere e confrontare le due fonti associative. Nessun dato modificato. Verifica le credenziali Google e la struttura dei fogli." };
  }
}

export async function applySociSyncAction(expectedToken: string): Promise<SyncOutcome> {
  await requireAdmin();
  if (missingConfig()) return configError();
  if (!/^[a-f0-9]{64}$/.test(expectedToken)) return { ok: false, message: "Anteprima scaduta. Ricarica prima i dati." };
  try {
    const { forms, book } = await loadPreview();
    if (fingerprint(forms, book) !== expectedToken) {
      return { ok: false, message: "Le fonti sono cambiate dopo l'anteprima: ripeti il controllo prima di aggiornare." };
    }

    const db = createSupabaseAdminClient();
    // Aggiorniamo prima il libro ufficiale. Nessuna cancellazione automatica.
    const officialReport = await applyOfficialMembersBookSync(db, { removeStaleRows: false });
    const formReport = await applyAssociationMembersSync(db, { removeStaleRows: false });
    await clearMembershipCache();
    refreshGestione();

    if (officialReport.errors.length || formReport.errors.length) {
      console.warn("[gestionale] Sincronizzazione soci con righe da controllare", {
        official: officialReport.errors.length,
        forms: formReport.errors.length,
      });
      return {
        ok: false,
        message: `Aggiornamento parziale: libro soci ${officialReport.created} nuovi, ${officialReport.updated} modificati; moduli ${formReport.created} nuovi, ${formReport.updated} modificati. Alcune righe richiedono controllo. Nessuna riga rimossa.`,
      };
    }
    return {
      ok: true,
      forms: { created: formReport.created, updated: formReport.updated },
      book: { created: officialReport.created, updated: officialReport.updated },
      warnings: forms.invalidRows + book.invalidRows,
    };
  } catch (error) {
    console.error("[gestionale] Errore sincronizzazione soci", error);
    return {
      ok: false,
      message: "La sincronizzazione non è stata completata. I dati precedenti restano consultabili. Controlla il log prima di ripetere: alcune righe potrebbero essere state aggiornate.",
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
