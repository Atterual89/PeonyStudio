"use server";

import { createHash } from "node:crypto";

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

function configError(): SyncPreview {
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
  const [previousForms, previousBook] = await Promise.all([
    countFor("google_sheet"),
    countFor("official_members_book"),
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
