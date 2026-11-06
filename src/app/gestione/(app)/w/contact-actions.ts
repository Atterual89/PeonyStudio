"use server";

import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { bccList, isRequestGroup, peopleInGroup, type ContactGroup } from "@/lib/gestionale/contacts";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson, getWorkshopBookings, getWorkshopView } from "@/lib/gestionale/server/data";
import { getMembershipBadges } from "@/lib/gestionale/server/membership";
import {
  addMembershipContact,
  addMembershipContacts,
  deleteMembershipContact,
} from "@/lib/gestionale/server/mutations";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import type { ActionResult } from "@/lib/gestionale/types";
import { asText, isIsoDate, isUuidLike } from "@/lib/gestionale/validation";
import { todayInRome } from "@/lib/gestionale/workshops";

// Richieste di associazione (4d, parte B, migrazione 023): l'admin registra
// che ha mandato (da Gmail) la richiesta di iscrizione o un sollecito a chi
// non è in regola per il periodo del workshop. Solo admin (requireAdmin:
// all'organizzatrice 404). Periodo e numero del sollecito li decide il server.

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };

async function periodOf(workshopId: unknown) {
  if (!isUuidLike(workshopId)) return null;
  const workshop = await getWorkshopView(workshopId);
  const period = workshop ? membershipPeriodFor(workshop.startsOn) : null;
  return workshop && period ? { workshop, periodKey: period.paymentsFrom } : null;
}

function sentOnError(sentOn: unknown): string | null {
  if (!isIsoDate(sentOn)) return "Data non valida.";
  return sentOn > todayInRome() ? "La data non può essere nel futuro." : null;
}

/** "Segna richiesta inviata" / "Segna sollecito N" per una persona. */
export async function addContactAction(input: {
  personId: string;
  workshopId: string;
  sentOn: string;
  note: string;
}): Promise<ActionResult<{ number: number }>> {
  const operator = await requireAdmin();
  const target = await periodOf(input?.workshopId);
  if (!target || !isUuidLike(input.personId)) return INVALID;
  const dateError = sentOnError(input.sentOn);
  if (dateError) return { ok: false, error: dateError };

  const person = await getPerson(input.personId);
  if (!person || person.merged_into) return INVALID;
  const badge = (await getMembershipBadges([person], target.workshop.startsOn)).get(person.id);
  if (badge?.kind === "in_regola") return { ok: false, error: "È già in regola per questo periodo: niente da registrare." };

  const result = await addMembershipContact(operator.id, person.id, target.periodKey, input.sentOn, asText(input.note, 500).trim() || null);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { number: result.data.number } };
}

/**
 * "Registra come inviata (N)": richiesta (o sollecito successivo) con la data
 * di oggi per le persone spuntate (4e, #12). Il gruppo si ricalcola sul
 * server: si registrano solo le persone indicate che sono ancora nel gruppo e
 * hanno email. D26: mai per le non collegate al libro soci.
 */
export async function markGroupSentAction(input: {
  workshopId: string;
  group: ContactGroup;
  personIds: string[];
  includeInterested?: boolean;
}): Promise<ActionResult<{ count: number }>> {
  const operator = await requireAdmin();
  const target = await periodOf(input?.workshopId);
  if (
    !target ||
    !isRequestGroup(input.group) ||
    (input.includeInterested !== undefined && typeof input.includeInterested !== "boolean") ||
    !Array.isArray(input.personIds) ||
    input.personIds.length > 500 ||
    !input.personIds.every(isUuidLike)
  ) {
    return INVALID;
  }

  const copied = new Set(input.personIds);
  const people = bccList(peopleInGroup(await getWorkshopBookings(target.workshop), input.group, { includeInterested: input.includeInterested }))
    .withEmail.map((entry) => entry.person.id)
    .filter((id) => copied.has(id));
  if (people.length === 0) return { ok: false, error: "Nessuna persona da segnare: ricarica la pagina." };

  const result = await addMembershipContacts(operator.id, people, target.periodKey, todayInRome());
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true, data: { count: result.data } };
}

/** Elimina un contatto registrato per errore (menu "…", conferma sul posto; "Annulla" con restoreDeletedAction). */
export async function deleteContactAction(input: { id: string }): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.id)) return INVALID;
  const result = await deleteMembershipContact(operator.id, input.id);
  if (!result.ok) return result;
  refreshGestione();
  return { ok: true };
}

