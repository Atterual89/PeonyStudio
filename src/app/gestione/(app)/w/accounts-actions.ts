"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";

import { parseEuroToCents } from "@/lib/gestionale/format";
import { getAccounts } from "@/lib/gestionale/server/accounts";
import { requireAdmin, requireOperator, requireOrganizer } from "@/lib/gestionale/server/auth";
import { getWorkshopView } from "@/lib/gestionale/server/data";
import {
  createCarryover,
  createExpense,
  createTransfer,
  deleteCarryover,
  deleteExpense,
  deleteTransfer,
  setLossPeony,
  setPeonyPct,
  setSettlementStatus,
  setTaxNotes,
  setTransferExecuted,
  updateExpense,
  type ExpensePayload,
} from "@/lib/gestionale/server/mutations";
import { residualTransfer, settlementSnapshot, validateLossPeony } from "@/lib/gestionale/settlement";
import type { ActionResult, Party } from "@/lib/gestionale/types";
import { todayInRome } from "@/lib/gestionale/workshops";
import {
  asText,
  isExpenseCategory,
  isIsoDate,
  isParty,
  isSettlementStatus,
  isTransferStatus,
  isUuidLike,
  isVersion,
} from "@/lib/gestionale/validation";

// Tab Conti (Fase 4, D18): admin e organizzatrice possono gestire spese,
// trasferimenti, riporti, stato ed export (requireOperator). Le percentuali
// solo gli admin (requireAdmin: all'organizzatrice 404). Le note fiscali solo
// l'organizzatrice (requireOrganizer: agli admin 404). I limiti che dipendono
// dai totali si controllano ricalcolando il consuntivo sul server.

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };
const MAX_CENTS = 100_000_000;

function readAmount(value: unknown): number | null {
  const cents = parseEuroToCents(asText(value, 20));
  return cents === null || cents <= 0 || cents > MAX_CENTS ? null : cents;
}

function readDate(value: unknown): string | null | undefined {
  const text = asText(value, 10).trim();
  if (!text) return null;
  return isIsoDate(text) ? text : undefined;
}

async function loadAccounts(workshopId: string) {
  const workshop = await getWorkshopView(workshopId);
  return workshop ? getAccounts(workshop) : null;
}

// ---------------------------------------------------------------------------
// Spese
// ---------------------------------------------------------------------------

export type ExpenseFields = { amount: string; category: string; description: string; advancedBy: string; spentOn: string };

function readExpense(fields: ExpenseFields | undefined): ExpensePayload | { error: string } | null {
  const f = (fields ?? {}) as Partial<ExpenseFields>;
  const amount = readAmount(f.amount);
  if (amount === null) return { error: "Scrivi l'importo, ad esempio 120 o 120,50." };
  const description = asText(f.description, 200).trim();
  if (!description) return { error: "Scrivi una breve descrizione." };
  const spentOn = readDate(f.spentOn);
  if (!isExpenseCategory(f.category) || !isParty(f.advancedBy) || spentOn === undefined) return null;
  return { description, amount_cents: amount, advanced_by: f.advancedBy, category: f.category, spent_on: spentOn };
}

export async function addExpenseAction(input: { workshopId: string; fields: ExpenseFields }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.workshopId)) return INVALID;
  const payload = readExpense(input.fields);
  if (!payload) return INVALID;
  if ("error" in payload) return { ok: false, error: payload.error };

  const result = await createExpense(operator.id, input.workshopId, payload);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export async function updateExpenseAction(input: { id: string; version: number; fields: ExpenseFields }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.id) || !isVersion(input.version)) return INVALID;
  const payload = readExpense(input.fields);
  if (!payload) return INVALID;
  if ("error" in payload) return { ok: false, error: payload.error };

  const result = await updateExpense(operator.id, input.id, input.version, payload);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export async function deleteExpenseAction(input: { id: string; version: number }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.id) || !isVersion(input.version)) return INVALID;
  const result = await deleteExpense(operator.id, input.id, input.version);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Trasferimenti
// ---------------------------------------------------------------------------

export async function addTransferAction(input: {
  workshopId: string;
  fields: { fromParty: string; amount: string; status: string; executedOn: string; notes: string };
}): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.workshopId)) return INVALID;
  const f = input.fields ?? ({} as typeof input.fields);
  const amount = readAmount(f.amount);
  if (amount === null) return { ok: false, error: "Scrivi l'importo, ad esempio 950 o 950,50." };
  const executedOn = readDate(f.executedOn);
  if (!isParty(f.fromParty) || !isTransferStatus(f.status) || executedOn === undefined) return INVALID;
  const toParty: Party = f.fromParty === "peony" ? "redsabbath" : "peony";

  const result = await createTransfer(operator.id, input.workshopId, {
    from_party: f.fromParty,
    to_party: toParty,
    amount_cents: amount,
    status: f.status,
    executed_on: f.status === "eseguito" ? executedOn : null,
    notes: asText(f.notes, 500).trim() || null,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export async function markTransferExecutedAction(input: { id: string; version: number; executedOn?: string }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.id) || !isVersion(input.version)) return INVALID;
  const executedOn = readDate(input.executedOn);
  if (executedOn === undefined) return INVALID;
  const result = await setTransferExecuted(operator.id, input.id, input.version, executedOn);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/**
 * D24: "Registra trasferimento di X € (Ale → Peony)". Importo e direzione sono
 * quelli del residuo ATTUALE, ricalcolato qui; `expectedCents` è il residuo
 * che l'operatore ha confermato: se nel frattempo è cambiato, niente. Il
 * trasferimento è registrato come eseguito oggi e porta il residuo a 0.
 */
export async function settleResidualAction(input: { workshopId: string; expectedCents: number }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.workshopId) || !Number.isInteger(input.expectedCents)) return INVALID;
  const accounts = await loadAccounts(input.workshopId);
  if (!accounts) return INVALID;
  const residuo = accounts.settlement.residuo;
  if (residuo === null) return { ok: false, error: "Prima completa la ripartizione: l'importo da trasferire non è ancora calcolato." };
  if (residuo === 0) return { ok: false, error: "Non c'è niente da trasferire." };
  if (residuo !== input.expectedCents) return { ok: false, error: "L'importo da trasferire è cambiato: ricarica la pagina." };
  const transfer = residualTransfer(residuo)!;

  const result = await createTransfer(operator.id, input.workshopId, {
    from_party: transfer.fromParty,
    to_party: transfer.toParty,
    amount_cents: transfer.amountCents,
    status: "eseguito",
    executed_on: todayInRome(),
    notes: "conguaglio",
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export async function deleteTransferAction(input: { id: string; version: number }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.id) || !isVersion(input.version)) return INVALID;
  const result = await deleteTransfer(operator.id, input.id, input.version);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Riporti
// ---------------------------------------------------------------------------

/**
 * "Riporta il residuo su un altro workshop": importo e direzione sono quelli
 * del residuo ATTUALE, ricalcolato qui (non arrivano dal browser).
 */
export async function carryResidualAction(input: {
  workshopId: string;
  destinationId: string;
  notes: string;
}): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.workshopId) || !isUuidLike(input.destinationId) || input.workshopId === input.destinationId) {
    return INVALID;
  }
  const accounts = await loadAccounts(input.workshopId);
  if (!accounts) return INVALID;
  const residuo = accounts.settlement.residuo;
  if (residuo === null) return { ok: false, error: "Prima completa la ripartizione: l'importo da trasferire non è ancora calcolato." };
  if (residuo === 0) return { ok: false, error: "Non c'è niente da trasferire, quindi niente da riportare." };

  const result = await createCarryover(operator.id, {
    origin_workshop_id: input.workshopId,
    destination_workshop_id: input.destinationId,
    debtor: residuo > 0 ? "redsabbath" : "peony",
    creditor: residuo > 0 ? "peony" : "redsabbath",
    amount_cents: Math.abs(residuo),
    notes: asText(input.notes, 500).trim() || null,
  });
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

export async function deleteCarryoverAction(input: { id: string; version: number }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.id) || !isVersion(input.version)) return INVALID;
  const result = await deleteCarryover(operator.id, input.id, input.version);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ripartizione
// ---------------------------------------------------------------------------

/** D18: le percentuali le modificano SOLO gli admin. */
export async function setPeonyPctAction(input: { workshopId: string; version: number; peonyPct: string }): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.workshopId) || !isVersion(input.version)) return INVALID;
  const text = asText(input.peonyPct, 6).trim().replace(",", ".");
  const pct = Number(text);
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || pct < 0 || pct > 100) return { ok: false, error: "Percentuale tra 0 e 100." };

  const result = await setPeonyPct(operator.id, input.workshopId, input.version, pct);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** D6: perdita sostenuta da Peony, tra 0 e |Utile| (vuoto = da decidere). */
export async function setLossPeonyAction(input: { workshopId: string; version: number; loss: string }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.workshopId) || !isVersion(input.version)) return INVALID;
  const text = asText(input.loss, 20).trim();
  const loss = text ? parseEuroToCents(text) : null;
  if (text && loss === null) return { ok: false, error: "Importo non valido: scrivi ad esempio 100 o 100,50." };

  const accounts = await loadAccounts(input.workshopId);
  if (!accounts) return INVALID;
  const error = validateLossPeony(accounts.settlement, loss);
  if (error) return { ok: false, error };

  const result = await setLossPeony(operator.id, input.workshopId, input.version, loss);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stato del consuntivo
// ---------------------------------------------------------------------------

/** "Verificato" salva lo snapshot dei totali, ricalcolati qui al momento della verifica. */
export async function setSettlementStatusAction(input: { workshopId: string; version: number; status: string }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.workshopId) || !isVersion(input.version) || !isSettlementStatus(input.status)) return INVALID;

  let snapshot = null;
  if (input.status === "verificato") {
    const accounts = await loadAccounts(input.workshopId);
    if (!accounts) return INVALID;
    snapshot = settlementSnapshot(accounts.settlement, accounts.workshop.lossPeonyCents);
  }

  const result = await setSettlementStatus(operator.id, input.workshopId, input.version, input.status, snapshot);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Note fiscali personali di Ale (D7, Fase 4)
// ---------------------------------------------------------------------------

export async function setTaxNotesAction(input: { workshopId: string; version: number; notes: string }): Promise<ActionResult> {
  const operator = await requireOrganizer();
  if (!isUuidLike(input?.workshopId) || !isVersion(input.version)) return INVALID;
  const result = await setTaxNotes(operator.id, input.workshopId, input.version, asText(input.notes, 5000).trim() || null);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}
