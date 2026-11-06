import "server-only";

import { buildAccounts, type AccountsData, type Carryover, type Expense, type Transfer } from "@/lib/gestionale/accounts";
import { requireOperator, requireOrganizer } from "@/lib/gestionale/server/auth";
import { listWorkshopsForCopy } from "@/lib/gestionale/server/data";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { loadLuxuriaEvents } from "@/lib/gestionale/server/events";
import { getRegistrations } from "@/lib/gestionale/server/registrations";
import { toOverviewRow, workshopRecap, type OverviewRecord, type WorkshopRecap } from "@/lib/gestionale/recap";
import { settlementStatusOf } from "@/lib/gestionale/settlement";
import type { BookingStatus, CarryoverStatus, ExpenseCategory, OperatorRole, Party, TransferStatus, WorkshopView } from "@/lib/gestionale/types";
import { isUuidLike } from "@/lib/gestionale/validation";

// Letture del tab Conti e degli export (Fase 4), per admin e organizzatrice
// (D18). Le prenotazioni arrivano da getRegistrations: solo entered_as e dati
// economici, mai gw_people. Le note fiscali di Ale NON si selezionano qui:
// le legge solo getTaxNotes, riservata all'organizzatrice (D7, Fase 4). Le
// righe eliminate (D22) non si leggono e non contano nel consuntivo.

function fail(context: string, error: { message: string }): never {
  throw new Error(`Gestionale (${context}): ${error.message}`);
}

// D25: di chi ha verificato e di chi ha inserito una spesa si legge solo il ruolo, mai il nome.
const SETTLEMENT_COLUMNS =
  "id, version, peony_pct, loss_peony_cents, settlement_status, verified_snapshot, verified_at, gw_operators!gw_workshops_verified_by_fkey(role)";
const EXPENSE_COLUMNS =
  "id, version, description, amount_cents, advanced_by, category, spent_on, created_at, gw_operators!gw_expenses_created_by_fkey(role)";
const TRANSFER_COLUMNS = "id, version, from_party, to_party, amount_cents, status, executed_on, notes, created_at";
const CARRYOVER_COLUMNS =
  "id, version, origin_workshop_id, destination_workshop_id, debtor, creditor, amount_cents, status, notes, created_at";

type Cents = number | string;
type RoleEmbed = { role: OperatorRole } | { role: OperatorRole }[] | null | undefined;

const roleOf = (embed: RoleEmbed): OperatorRole | null => (Array.isArray(embed) ? embed[0] : embed)?.role ?? null;

type ExpenseRecord = {
  id: string;
  version: number;
  description: string;
  amount_cents: Cents;
  advanced_by: Party;
  category: ExpenseCategory;
  spent_on: string | null;
  gw_operators?: RoleEmbed;
};
type TransferRecord = {
  id: string;
  version: number;
  from_party: Party;
  to_party: Party;
  amount_cents: Cents;
  status: TransferStatus;
  executed_on: string | null;
  notes: string | null;
};
type CarryoverRecord = {
  id: string;
  version: number;
  origin_workshop_id: string;
  destination_workshop_id: string;
  debtor: Party;
  creditor: Party;
  amount_cents: Cents;
  status: CarryoverStatus;
  notes: string | null;
};

function toExpense(row: ExpenseRecord): Expense {
  return {
    id: row.id,
    version: row.version,
    description: row.description,
    amountCents: Number(row.amount_cents),
    advancedBy: row.advanced_by,
    category: row.category,
    spentOn: row.spent_on,
    createdByRole: roleOf(row.gw_operators),
  };
}

function toTransfer(row: TransferRecord): Transfer {
  return {
    id: row.id,
    version: row.version,
    fromParty: row.from_party,
    toParty: row.to_party,
    amountCents: Number(row.amount_cents),
    status: row.status,
    executedOn: row.executed_on,
    notes: row.notes,
  };
}

/** Nomi dei workshop (dall'evento, se esiste ancora: D14), per i riporti. */
async function workshopNames(ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const [{ data, error }, events] = await Promise.all([
    getGestionaleDb().from("gw_workshops").select("id, event_id, name").in("id", [...new Set(ids)]).is("deleted_at", null),
    loadLuxuriaEvents(),
  ]);
  if (error) fail("workshop", error);
  const eventsById = new Map(events.map((event) => [event.id, event]));
  return new Map(
    ((data ?? []) as { id: string; event_id: string | null; name: string }[]).map((row) => [
      row.id,
      (row.event_id ? eventsById.get(row.event_id)?.name : undefined) ?? row.name,
    ]),
  );
}

/** Tutto il consuntivo del workshop: dati letti e risultato di computeSettlement. */
export async function getAccounts(workshop: WorkshopView): Promise<AccountsData | null> {
  await requireOperator();
  if (!isUuidLike(workshop.id)) return null;
  const db = getGestionaleDb();

  const [settings, registrations, expenses, transfers, carryovers] = await Promise.all([
    db.from("gw_workshops").select(SETTLEMENT_COLUMNS).eq("id", workshop.id).is("deleted_at", null).maybeSingle(),
    getRegistrations(workshop.id),
    db.from("gw_expenses").select(EXPENSE_COLUMNS).eq("workshop_id", workshop.id).is("deleted_at", null).order("spent_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
    db.from("gw_transfers").select(TRANSFER_COLUMNS).eq("workshop_id", workshop.id).is("deleted_at", null).order("created_at", { ascending: true }),
    db
      .from("gw_carryovers")
      .select(CARRYOVER_COLUMNS)
      .or(`origin_workshop_id.eq.${workshop.id},destination_workshop_id.eq.${workshop.id}`)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);
  if (settings.error) fail("consuntivo", settings.error);
  if (expenses.error) fail("spese", expenses.error);
  if (transfers.error) fail("trasferimenti", transfers.error);
  if (carryovers.error) fail("riporti", carryovers.error);
  if (!settings.data) return null;

  const carryoverRows = (carryovers.data ?? []) as CarryoverRecord[];
  const names = await workshopNames(
    carryoverRows.map((row) => (row.origin_workshop_id === workshop.id ? row.destination_workshop_id : row.origin_workshop_id)),
  );
  const toCarryover = (row: CarryoverRecord, otherId: string): Carryover => ({
    id: row.id,
    version: row.version,
    otherWorkshop: { id: otherId, name: names.get(otherId) ?? "Workshop" },
    debtor: row.debtor,
    creditor: row.creditor,
    amountCents: Number(row.amount_cents),
    status: row.status,
    notes: row.notes,
  });

  const row = settings.data as {
    id: string;
    version: number;
    peony_pct: number | string;
    loss_peony_cents: Cents | null;
    settlement_status: string;
    verified_snapshot: unknown;
    verified_at: string | null;
    gw_operators?: RoleEmbed;
  };

  return buildAccounts({
    workshop: {
      id: row.id,
      version: row.version,
      name: workshop.displayName,
      startsOn: workshop.startsOn,
      endsOn: workshop.endsOn,
      peonyPct: Number(row.peony_pct),
      lossPeonyCents: row.loss_peony_cents === null ? null : Number(row.loss_peony_cents),
      status: settlementStatusOf(row.settlement_status),
      verifiedSnapshot: row.verified_snapshot,
      verifiedAt: row.verified_at,
      verifiedByRole: roleOf(row.gw_operators),
    },
    registrations,
    expenses: ((expenses.data ?? []) as ExpenseRecord[]).map(toExpense),
    transfers: ((transfers.data ?? []) as TransferRecord[]).map(toTransfer),
    carryoversIn: carryoverRows
      .filter((c) => c.destination_workshop_id === workshop.id)
      .map((c) => toCarryover(c, c.origin_workshop_id)),
    carryoversOut: carryoverRows
      .filter((c) => c.origin_workshop_id === workshop.id)
      .map((c) => toCarryover(c, c.destination_workshop_id)),
  });
}

/** D7 (Fase 4): note fiscali personali di Ale, SOLO per l'organizzatrice (agli admin 404). */
export async function getTaxNotes(workshopId: string): Promise<string | null> {
  await requireOrganizer();
  if (!isUuidLike(workshopId)) return null;
  const { data, error } = await getGestionaleDb().from("gw_workshops").select("personal_tax_notes").eq("id", workshopId).maybeSingle();
  if (error) fail("note fiscali", error);
  return (data?.personal_tax_notes as string | null | undefined) ?? null;
}

/** Workshop di destinazione per "Riporta il residuo" (tutti tranne questo). */
export async function listCarryoverDestinations(excludeId: string): Promise<{ id: string; name: string; startsOn: string }[]> {
  await requireOperator();
  return (await listWorkshopsForCopy(excludeId)).map((w) => ({ id: w.id, name: w.displayName, startsOn: w.startsOn }));
}

// ---------------------------------------------------------------------------
// Home (D23): recap economico di tutti i workshop con UNA lettura aggregata
// (gw_economic_overview, migrazione 021), calcolato con le stesse funzioni
// del tab Conti (recap.ts). Nessun dato di persone.
// ---------------------------------------------------------------------------

export type WorkshopOverview = { recap: WorkshopRecap; statuses: BookingStatus[] };

/** Recap e stati delle prenotazioni (per i conteggi D15) di ogni workshop non eliminato. */
export async function loadEconomicOverview(): Promise<Map<string, WorkshopOverview>> {
  await requireOperator();
  const { data, error } = await getGestionaleDb().rpc("gw_economic_overview");
  if (error) fail("recap economico", error);
  return new Map(
    ((data ?? []) as OverviewRecord[]).map((record) => {
      const row = toOverviewRow(record);
      return [row.workshopId, { recap: workshopRecap(row), statuses: row.bookings.map((b) => b.status) }] as const;
    }),
  );
}
