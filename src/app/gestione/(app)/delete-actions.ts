"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";

import { requireAdmin, requireOperator } from "@/lib/gestionale/server/auth";
import { getWorkshopView } from "@/lib/gestionale/server/data";
import {
  deleteBooking,
  deleteBookingWithPayments,
  deletePayment,
  deletePerson,
  deleteWorkshop,
  restoreDeleted,
  restoreMembershipContact,
  restorePersonAlias,
  type DeletedEntity,
} from "@/lib/gestionale/server/mutations";
import type { ActionResult } from "@/lib/gestionale/types";
import { asText, isUuidLike, isVersion } from "@/lib/gestionale/validation";

// Eliminazioni (Fase 4b, D22): solo per correggere un errore di inserimento.
// Pagamenti e iscrizioni: Ale e admin (requireOperator). Persone e workshop:
// solo admin (requireAdmin: all'organizzatrice 404). Le condizioni (soldi,
// iscrizioni attive, Ticket Tailor, nome) le controlla anche il database.
// Spese, trasferimenti e riporti: w/accounts-actions.ts.

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };

async function done<T>(result: ActionResult<T>): Promise<ActionResult> {
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

/** Pagamento (con la catena della Modifica). Lo stato automatico si ricalcola nel database. */
export async function deletePaymentAction(input: { paymentId: string }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.paymentId)) return INVALID;
  return done(await deletePayment(operator.id, input.paymentId));
}

/** Iscrizione: solo se non ha soldi (pagato netto 0). */
export async function deleteBookingAction(input: { bookingId: string; version: number }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.bookingId) || !isVersion(input.version)) return INVALID;
  return done(await deleteBooking(operator.id, input.bookingId, input.version));
}

/**
 * 4e (#21): iscrizione inserita per errore con dei pagamenti: tutto insieme,
 * un solo "Annulla". `expectedCents` = pagato netto mostrato nella conferma
 * (il database lo ricontrolla).
 */
export async function deleteBookingWithPaymentsAction(input: { bookingId: string; version: number; expectedCents: number }): Promise<ActionResult> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.bookingId) || !isVersion(input.version) || !Number.isInteger(input.expectedCents)) return INVALID;
  return done(await deleteBookingWithPayments(operator.id, input.bookingId, input.version, input.expectedCents));
}

/** Solo admin: persona senza iscrizioni attive. */
export async function deletePersonAction(input: { personId: string; version: number }): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.personId) || !isVersion(input.version)) return INVALID;
  return done(await deletePerson(operator.id, input.personId, input.version));
}

/** Solo admin: workshop non collegato a Ticket Tailor, confermato scrivendo il nome. */
export async function deleteWorkshopAction(input: { workshopId: string; version: number; confirmName: string }): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.workshopId) || !isVersion(input.version)) return INVALID;
  const workshop = await getWorkshopView(input.workshopId);
  if (!workshop) return { ok: false, error: "Workshop non trovato. Ricarica la pagina." };
  if (workshop.event_id) return { ok: false, error: "Il workshop arriva da Ticket Tailor: non si può eliminare." };
  return done(await deleteWorkshop(operator.id, workshop.id, input.version, asText(input.confirmName, 300)));
}

const OPERATOR_ENTITIES: readonly DeletedEntity[] = ["payment", "booking", "expense", "transfer", "carryover"];
const ADMIN_ENTITIES: readonly DeletedEntity[] = ["person", "workshop"];

/** "Annulla" del messaggio "Eliminato": persone, workshop, richieste di associazione e altri nomi solo per gli admin. */
export async function restoreDeletedAction(input: { entity: string; id: string }): Promise<ActionResult> {
  if (input?.entity === "membership_contact") {
    // 4d (migrazione 023): contatti per le richieste di associazione.
    const operator = await requireAdmin();
    if (!isUuidLike(input.id)) return INVALID;
    return done(await restoreMembershipContact(operator.id, input.id));
  }
  if (input?.entity === "person_alias") {
    // 4e (#23, migrazione 024): altri nomi delle persone.
    const operator = await requireAdmin();
    if (!isUuidLike(input.id)) return INVALID;
    return done(await restorePersonAlias(operator.id, input.id));
  }
  const entity = input?.entity as DeletedEntity;
  const isAdminEntity = ADMIN_ENTITIES.includes(entity);
  const operator = isAdminEntity ? await requireAdmin() : await requireOperator();
  if ((!isAdminEntity && !OPERATOR_ENTITIES.includes(entity)) || !isUuidLike(input?.id)) return INVALID;
  return done(await restoreDeleted(operator.id, entity, input.id));
}
