// Etichette dell'interfaccia del gestionale: UNICO punto in cui sono definite.
// I valori interni degli enum Postgres non cambiano (D16, D17).

import type {
  BookingStatus,
  ExpenseCategory,
  InvoiceStatus,
  OperatorRole,
  Party,
  PaymentKind,
  PaymentMethod,
  PaymentType,
  SettlementStatus,
  TransferStatus,
} from "./types";

/** D17: la parte `redsabbath` si chiama "Ale" in tutta l'interfaccia e negli export. */
export const PARTY_LABELS: Record<Party, string> = {
  peony: "Peony",
  redsabbath: "Ale",
};

/** D16, nell'ordine in cui si mostrano. */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  interessato: "Interessato",
  prenotato: "Prenotato a parola",
  acconto: "Acconto pagato",
  saldato: "Saldato",
  lista_attesa: "Lista d'attesa",
  cancellato: "Cancellato",
};

/** 3b: stati che l'admin può scegliere creando un'iscrizione (niente stati economici). */
export const ADMIN_BOOKING_STATUSES: readonly BookingStatus[] = ["interessato", "prenotato", "lista_attesa"];

/** "Confermati" (filtri, riepiloghi, copia email, appello) = prenotato + acconto + saldato. */
export const CONFIRMED_STATUSES: readonly BookingStatus[] = ["prenotato", "acconto", "saldato"];

export function isConfirmed(status: BookingStatus): boolean {
  return CONFIRMED_STATUSES.includes(status);
}

export const ORPHAN_EVENT_LABEL = "Evento non più su Ticket Tailor";
export const UNLINKED_EVENT_LABEL = "Non collegato a Ticket Tailor";

/**
 * 3b: chi ha inserito l'iscrizione, come lo vedono Ale e gli admin: "Peony"
 * per gli admin (e gli script), "Ale" per l'organizzatrice. Mai il nome
 * dell'operatore.
 */
export function insertedByLabel(role: OperatorRole | null): string {
  return `Inserito da ${role === "organizzatrice" ? PARTY_LABELS.redsabbath : PARTY_LABELS.peony}`;
}

/** D25: "inserita da Peony/Ale" (spese), come insertedByLabel; mai il nome dell'operatore. */
export function partyOfRole(role: OperatorRole | null): string {
  return role === "organizzatrice" ? PARTY_LABELS.redsabbath : PARTY_LABELS.peony;
}

/** D25: "da Peony/Ale" accanto allo stato Verificato. */
export function verifiedByLabel(role: OperatorRole | null): string {
  return `da ${partyOfRole(role)}`;
}

/** 4e (#11): dopo il collegamento lo stato è ancora "Non collegata" (omonimi senza email nel libro soci). */
export const HOMONYMS_WARNING = "Nel libro soci ci sono più persone con questo nome: serve l'email.";

/** D18 (4e: sempre "Ale" nell'interfaccia). */
export const ROLE_LABELS: Record<OperatorRole, string> = {
  admin: "Admin",
  organizzatrice: PARTY_LABELS.redsabbath,
};

/** 4g (#1): sotto l'errore del PIN (il messaggio d'errore resta generico per sicurezza). */
export const PIN_HELP = "Se non riesci a entrare, aspetta 15 minuti o scrivi a Laura.";

/**
 * 4e (gruppo 5): parole comuni dell'interfaccia, uguali ovunque.
 * - "Chiudi" nei moduli; "Annulla" solo per tornare indietro dopo un'eliminazione (4g: niente "Storna");
 * - "Salva" per i dati, "Registra" per soldi e contatti, "Conferma" solo nelle conferme sul posto;
 * - "Collega" solo per il libro soci, "Abbina" per le persone del gestionale;
 * - "quota associativa" per l'associazione, "quota" per il workshop;
 * - "Rimane" = Entrate − Uscite, "Da trasferire" = residuo della Divisione Peony / Ale;
 * - messaggi di esito con il punto ("Salvato.", "Note salvate.").
 */
export const UI_LABELS = {
  close: "Chiudi",
  undo: "Annulla",
  save: "Salva",
  confirm: "Conferma",
  saved: "Salvato.",
  revokeValidation: "Revoca validazione",
  markMembershipPaid: "Segna quota associativa pagata",
  missingEmail: "Email mancante",
} as const;

/** D21, nell'ordine dei pulsanti. */
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  acconto: "Acconto",
  saldo: "Saldo",
  altro: "Altro",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  paypal: "PayPal",
  contanti: "Contanti",
  bonifico: "Bonifico",
  altro: "Altro",
};

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  pagamento: "Pagamento",
  rimborso: "Rimborso",
  rettifica: "Correzione",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  non_richiesta: "Fattura non richiesta",
  richiesta: "Fattura richiesta",
  emessa: "Fattura emessa",
};

/**
 * D18: ripiego se una persona non ha entered_as. Non dovrebbe capitare: per le
 * iscrizioni degli admin entered_as è il nickname o il nome (migrazione 013).
 */
export const ADMIN_ENTRY_LABEL = "Inserita da un admin";

/** Fase 4: categorie delle spese, nell'ordine dei pulsanti. */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  viaggi: "Viaggi",
  vitto: "Vitto",
  alloggio: "Alloggio",
  sala: "Sala",
  materiali: "Materiali",
  altro: "Altro",
};

/** Stato del consuntivo (D24: solo questi due; Saldato si deduce dal residuo). */
export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  provvisorio: "Provvisorio",
  verificato: "Verificato",
};

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  da_eseguire: "Da eseguire",
  eseguito: "Eseguito",
};
