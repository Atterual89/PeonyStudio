// Storico modifiche (Fase 5, D27, /gestione/altro/storico), puro: tipi del
// filtro, descrizione della riga ("Pagamento 250 € — Corvo — Level 2+"),
// azione e differenze prima / dopo campo per campo. Le chiavi sensibili (PIN,
// hash, token, note fiscali D7) non si mostrano mai, anche se ci fossero.
// Per l'organizzatrice il filtro vero è lato server (gw_audit_list): qui solo
// le etichette.

import { formatCents, formatDate } from "./format";
import {
  BOOKING_STATUS_LABELS,
  EXPENSE_CATEGORY_LABELS,
  INVOICE_STATUS_LABELS,
  PARTY_LABELS,
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  SETTLEMENT_STATUS_LABELS,
  TRANSFER_STATUS_LABELS,
} from "./labels";
import { partyOfRole } from "./labels";
import { PERSON_FIELD_LABELS, type OperatorRole } from "./types";

export type AuditKind = "anagrafica" | "iscrizioni" | "pagamenti" | "spese" | "trasferimenti" | "riporti" | "conti" | "accessi";

/** Stessi valori di gw_audit_kind (migrazione 027). */
export const AUDIT_KINDS: readonly { key: AuditKind; label: string }[] = [
  { key: "anagrafica", label: "Anagrafica" },
  { key: "iscrizioni", label: "Iscrizioni" },
  { key: "pagamenti", label: "Pagamenti" },
  { key: "spese", label: "Spese" },
  { key: "trasferimenti", label: "Trasferimenti" },
  { key: "riporti", label: "Riporti" },
  { key: "conti", label: "Stato dei conti" },
  { key: "accessi", label: "Accessi" },
];

/** D27: i tipi che vede l'organizzatrice (lo stesso elenco è in gw_audit_list). */
export const ORGANIZER_AUDIT_KINDS: readonly AuditKind[] = ["iscrizioni", "pagamenti", "spese", "trasferimenti", "riporti", "conti"];

export function auditKindsFor(role: OperatorRole): readonly { key: AuditKind; label: string }[] {
  return role === "admin" ? AUDIT_KINDS : AUDIT_KINDS.filter((kind) => ORGANIZER_AUDIT_KINDS.includes(kind.key));
}

export function isAuditKind(value: unknown, role: OperatorRole = "admin"): value is AuditKind {
  return auditKindsFor(role).some((kind) => kind.key === value);
}

export const AUDIT_PAGE_SIZE = 50;

type Json = Record<string, unknown>;

/** Una riga di gw_audit_list. */
export type AuditEntry = {
  id: number;
  createdAt: string;
  /** Solo per gli admin; all'organizzatrice arriva solo il ruolo (D25). */
  operatorName: string | null;
  operatorRole: OperatorRole | null;
  entity: string;
  action: string;
  before: Json | null;
  after: Json | null;
  workshopId: string | null;
  workshopName: string | null;
  subject: string | null;
};

const ENTITY_LABELS: Record<string, string> = {
  person: "Persona",
  person_alias: "Altro nome",
  membership_contact: "Richiesta di associazione",
  booking: "Iscrizione",
  payment: "Pagamento",
  expense: "Spesa",
  transfer: "Trasferimento",
  carryover: "Riporto",
  workshop: "Workshop",
  session: "Accesso",
  operator: "Operatore",
  login_unlock: "Sblocco accessi",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "Inserimento",
  update: "Modifica",
  delete: "Eliminazione",
  merge: "Unione",
  login: "Accesso",
  logout: "Uscita",
  export: "Esportazione",
};

/** Mai mostrate (difesa in profondità: le funzioni gw_* non le scrivono). */
const SENSITIVE_KEY = /pin|hash|token|personal_tax_notes/i;

/** Chiavi tecniche: non dicono niente a chi legge lo storico. */
const TECHNICAL_KEYS = new Set([
  "id",
  "version",
  "created_at",
  "updated_at",
  "created_by",
  "deleted_by",
  "workshop_id",
  "booking_id",
  "participant_id",
  "person_id",
  "event_id",
  "corrects_payment_id",
  "origin_workshop_id",
  "destination_workshop_id",
  "verified_by",
]);

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

/** Toglie le chiavi sensibili (anche annidate). */
export function cleanAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanAuditValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Json)
        .filter(([key]) => !isSensitiveKey(key))
        .map(([key, inner]) => [key, cleanAuditValue(inner)]),
    );
  }
  return value;
}

const FIELD_LABELS: Record<string, string> = {
  ...PERSON_FIELD_LABELS,
  name: "Nome",
  starts_on: "Inizio",
  ends_on: "Fine",
  description: "Descrizione",
  capacity: "Capienza",
  default_fee_cents: "Prezzo del workshop",
  peony_pct: "Percentuale Peony",
  loss_peony_cents: "Perdita sostenuta da Peony",
  settlement_status: "Stato del consuntivo",
  verified_at: "Verificato il",
  verified_snapshot: "Totali verificati",
  status: "Stato",
  agreed_fee_cents: "Prezzo",
  fee_custom: "Prezzo speciale",
  invoice_status: "Fattura",
  present: "Presente",
  entered_as: "Scritto da Ale",
  entered_email: "Email scritta da Ale",
  match_status: "Abbinamento",
  is_primary: "Principale",
  participants: "Persone",
  kind: "Movimento",
  amount_cents: "Importo",
  payment_type: "Tipo",
  method: "Metodo",
  paid_on: "Data",
  received_by: "Incassato da",
  category: "Categoria",
  advanced_by: "Pagata da",
  spent_on: "Data",
  from_party: "Da",
  to_party: "A",
  executed_on: "Eseguito il",
  debtor: "Debitore",
  creditor: "Creditore",
  association_member_id: "Validazione manuale collegata",
  membership_email: "Socio collegato (email)",
  merged_into: "Unita a",
  deleted_at: "Eliminata il",
  alias: "Altro nome",
  sent_on: "Inviata il",
  note: "Nota",
  display_name: "Nome di accesso",
  active: "Attivo",
  role: "Ruolo",
  pagato_cents: "Pagato",
  nota: "Nota",
  origine: "Origine",
  eliminato: "Eliminato",
  ripristinato: "Ripristinato",
  expires_at: "Scade il",
};

const ENUM_LABELS: Record<string, Record<string, string>> = {
  status: { ...BOOKING_STATUS_LABELS, ...TRANSFER_STATUS_LABELS },
  settlement_status: { ...SETTLEMENT_STATUS_LABELS, da_conguagliare: "Verificato", conguagliato: "Verificato" },
  invoice_status: INVOICE_STATUS_LABELS,
  kind: PAYMENT_KIND_LABELS,
  payment_type: PAYMENT_TYPE_LABELS,
  method: PAYMENT_METHOD_LABELS,
  category: EXPENSE_CATEGORY_LABELS,
  received_by: PARTY_LABELS,
  advanced_by: PARTY_LABELS,
  from_party: PARTY_LABELS,
  to_party: PARTY_LABELS,
  debtor: PARTY_LABELS,
  creditor: PARTY_LABELS,
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replaceAll("_", " ");
}

/** Valore leggibile di un campo. */
export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (key.endsWith("_cents") && (typeof value === "number" || /^-?\d+$/.test(String(value)))) return formatCents(Number(value));
  if (key === "peony_pct") return `${value}%`;
  if (typeof value === "string") {
    const labels = ENUM_LABELS[key];
    if (labels?.[value]) return labels[value];
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value.slice(0, 10));
    return value;
  }
  if (key === "participants" && Array.isArray(value)) {
    const people = value as Json[];
    const active = people.filter((p) => !p.removed_at);
    return active.map((p) => (typeof p.entered_as === "string" && p.entered_as) || "persona").join(" + ") || "—";
  }
  return JSON.stringify(cleanAuditValue(value));
}

export type AuditChange = { key: string; label: string; before: string; after: string };

/**
 * Campi cambiati, con prima e dopo leggibili. Inserimento: i campi valorizzati
 * del dopo; eliminazione con la riga intera prima: i campi del prima. Le
 * chiavi tecniche e quelle sensibili non compaiono.
 */
export function auditChanges(before: Json | null, after: Json | null): AuditChange[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys
    .filter((key) => !TECHNICAL_KEYS.has(key) && !isSensitiveKey(key))
    .filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null))
    .filter((key) => {
      if (before && after) return true;
      // Su un inserimento (o un'eliminazione con la sola riga prima) i campi vuoti non dicono niente.
      const value = (before ?? after)?.[key];
      return value !== null && value !== undefined && value !== "";
    })
    .map((key) => ({
      key,
      label: fieldLabel(key),
      before: formatAuditValue(key, before?.[key]),
      after: formatAuditValue(key, after?.[key]),
    }));
}

function amountOf(entry: Pick<AuditEntry, "before" | "after">): number | null {
  const raw = entry.after?.amount_cents ?? entry.before?.amount_cents;
  return typeof raw === "number" || (typeof raw === "string" && /^-?\d+$/.test(raw)) ? Number(raw) : null;
}

/** "Pagamento 250 € — Corvo — Level 2+" · "Spesa 50 € — Sala prove — Level 2+" · "Persona — Corvo". */
export function auditWhat(entry: Pick<AuditEntry, "entity" | "before" | "after" | "subject" | "workshopName">): string {
  let what = ENTITY_LABELS[entry.entity] ?? entry.entity;
  const row = entry.after ?? entry.before;
  if (entry.entity === "payment") {
    const kind = row?.kind;
    if (typeof kind === "string" && kind in PAYMENT_KIND_LABELS) what = PAYMENT_KIND_LABELS[kind as keyof typeof PAYMENT_KIND_LABELS];
  }
  if (entry.entity === "booking" && isPresenceChange(entry)) what = "Presenza";
  const amount = ["payment", "expense", "transfer", "carryover"].includes(entry.entity) ? amountOf(entry) : null;
  if (amount !== null) what += ` ${formatCents(Math.abs(amount))}`;

  const detail =
    entry.subject ??
    (entry.entity === "expense" && typeof row?.description === "string" ? row.description : null) ??
    (entry.entity === "person_alias" && typeof row?.alias === "string" ? row.alias : null);
  return [what, detail, entry.workshopName].filter(Boolean).join(" — ");
}

/** La riga è solo la spunta "Presente" (gw_set_present). */
function isPresenceChange(entry: Pick<AuditEntry, "after">): boolean {
  const keys = Object.keys(entry.after ?? {});
  return keys.length === 1 && keys[0] === "present";
}

/** Azione leggibile: "Inserimento", "Modifica", "Eliminazione", "Ripristino", "Segnata presente"… */
export function auditActionLabel(entry: Pick<AuditEntry, "entity" | "action" | "after">): string {
  if (entry.action === "update" && entry.after?.ripristinato) return "Ripristino";
  if (entry.action === "delete" || entry.after?.eliminato === true) return "Eliminazione";
  if (entry.entity === "booking" && isPresenceChange(entry)) return entry.after?.present ? "Segnata presente" : "Tolta la presenza";
  if (entry.entity === "operator" && entry.after?.pin_changed) return "PIN cambiato";
  return ACTION_LABELS[entry.action] ?? entry.action;
}

/**
 * Chi ha fatto la modifica: agli admin il nome; all'organizzatrice solo
 * Peony o Ale (partyOfRole, D25). "Script" per le operazioni da terminale.
 */
export function auditOperator(entry: Pick<AuditEntry, "operatorName" | "operatorRole">): string {
  if (entry.operatorName) return entry.operatorName;
  return entry.operatorRole ? partyOfRole(entry.operatorRole) : "Script";
}
