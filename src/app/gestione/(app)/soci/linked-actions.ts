"use server";

// Fase C audit anagrafica: azioni della riga gialla nella pagina evento.
// Non scrivono nel registro direttamente: riusano i flussi esistenti
// (abbinamento iscrizioni di Ale, intestatario e partner dei biglietti TT) e
// il registro gw_person_sources li segue con i trigger della migrazione 051.

import { savePeonyHolderAction, savePeonyPartnerAction } from "@/app/gestione/(app)/peony/actions";
import { displayName } from "@/lib/gestionale/format";
import { searchPeople } from "@/lib/gestionale/people";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson, loadPeople } from "@/lib/gestionale/server/data";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { createPersonWithAliases, confirmMatch, rejectMatch, resolveMatch, updatePerson } from "@/lib/gestionale/server/mutations";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import type { ActionResult, PersonFields } from "@/lib/gestionale/types";
import { asText, isUuidLike } from "@/lib/gestionale/validation";

export type LinkSearchResult = { id: string; name: string; detail: string | null };

export type EventSourceTarget =
  | { kind: "iscrizione"; bookingId: string; participantId: string }
  | { kind: "biglietto"; eventId: string; ticketId: string; role: "intestatario" | "partner" };

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };

function isTarget(value: unknown): value is EventSourceTarget {
  if (!value || typeof value !== "object") return false;
  const t = value as Record<string, unknown>;
  if (t.kind === "iscrizione") return isUuidLike(t.bookingId) && isUuidLike(t.participantId);
  if (t.kind === "biglietto") {
    return isUuidLike(t.eventId) && typeof t.ticketId === "string" && t.ticketId.length > 0 && t.ticketId.length <= 200 &&
      (t.role === "intestatario" || t.role === "partner");
  }
  return false;
}

/** Ricerca nell'anagrafica per la riga gialla: nome, cognome, nickname o email. */
export async function searchPeopleForLinkAction(query: string): Promise<ActionResult<LinkSearchResult[]>> {
  await requireAdmin();
  const text = asText(query, 100).trim();
  if (text.length < 2) return { ok: true, data: [] };
  const people = await loadPeople();
  return {
    ok: true,
    data: searchPeople(people, text, 8).map((p) => ({
      id: p.id,
      name: displayName(p),
      detail: [p.nickname && p.first_name ? `"${p.nickname}"` : null, p.email].filter(Boolean).join(" · ") || null,
    })),
  };
}

/** Stato attuale del partecipante, letto dal database (versione aggiornata). */
async function participantState(bookingId: string, participantId: string) {
  const { data, error } = await getGestionaleDb().from("gw_booking_participants")
    .select("id,person_id,match_status,booking_id,gw_bookings!inner(version)")
    .eq("id", participantId).eq("booking_id", bookingId).is("removed_at", null).maybeSingle();
  if (error || !data) return null;
  const booking = Array.isArray(data.gw_bookings) ? data.gw_bookings[0] : data.gw_bookings;
  return { personId: data.person_id as string, matchStatus: data.match_status as string, version: Number(booking?.version) };
}

/** "È lei": collega la fonte alla persona scelta. */
export async function linkEventSourceAction(input: { target: EventSourceTarget; personId: string }): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isTarget(input?.target) || !isUuidLike(input.personId)) return INVALID;
  const { target, personId } = input;

  if (target.kind === "biglietto") {
    const save = target.role === "intestatario" ? savePeonyHolderAction : savePeonyPartnerAction;
    const result = await save(target.eventId, target.ticketId, { kind: "person", id: personId });
    return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Non riesco a salvare l'abbinamento." };
  }

  const state = await participantState(target.bookingId, target.participantId);
  if (!state) return { ok: false, error: "Iscrizione non trovata. Ricarica la pagina." };
  let ref = { bookingId: target.bookingId, participantId: target.participantId, version: state.version };

  if (state.matchStatus === "automatico" && state.personId === personId) {
    const confirmed = await confirmMatch(operator.id, ref);
    if (!confirmed.ok) return confirmed;
  } else if (state.matchStatus === "confermato") {
    if (state.personId !== personId) {
      return { ok: false, error: "Questa iscrizione è già confermata: cambia la persona dalla scheda dell'iscrizione." };
    }
  } else {
    if (state.matchStatus === "automatico") {
      // "Non è questa persona", poi collega quella scelta (flusso D20 esistente).
      const rejected = await rejectMatch(operator.id, ref);
      if (!rejected.ok) return rejected;
      ref = { ...ref, version: Number(rejected.data) };
    }
    const linked = await resolveMatch(operator.id, ref, "collega", personId);
    if (!linked.ok) return linked;
  }
  refreshGestione();
  return { ok: true };
}

/** "È una persona nuova": tiene i dati inseriti come nuova scheda. */
export async function newPersonForEventSourceAction(input: {
  target: EventSourceTarget;
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isTarget(input?.target)) return INVALID;
  const firstName = asText(input.firstName, 80).trim();
  const lastName = asText(input.lastName, 80).trim();
  const email = asText(input.email, 200).trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Email non valida." };
  if (!email && !(firstName && lastName)) {
    return { ok: false, error: "Indica almeno l'email oppure nome e cognome." };
  }
  const { target } = input;

  if (target.kind === "iscrizione") {
    const state = await participantState(target.bookingId, target.participantId);
    if (!state) return { ok: false, error: "Iscrizione non trovata. Ricarica la pagina." };
    let ref = { bookingId: target.bookingId, participantId: target.participantId, version: state.version };
    if (state.matchStatus === "automatico") {
      const rejected = await rejectMatch(operator.id, ref);
      if (!rejected.ok) return rejected;
      ref = { ...ref, version: Number(rejected.data) };
    }
    if (state.matchStatus !== "confermato") {
      const created = await resolveMatch(operator.id, ref, "crea_nuova", null);
      if (!created.ok) return created;
    }
    // Completa la scheda (provvisoria o appena confermata) con i dati indicati.
    const after = await participantState(target.bookingId, target.participantId);
    if (!after) return { ok: false, error: "Iscrizione non trovata. Ricarica la pagina." };
    const person = await getPerson(after.personId);
    if (!person) return { ok: false, error: "Persona non trovata. Ricarica la pagina." };
    const fields: PersonFields = {
      first_name: firstName || person.first_name, last_name: lastName || person.last_name,
      nickname: person.nickname, email: email || person.email, instagram: person.instagram,
      phone: person.phone, teamartist_id: person.teamartist_id, notes: person.notes,
    };
    const updated = await updatePerson(operator.id, person.id, person.version, fields);
    if (!updated.ok) {
      return { ok: false, error: "Persona creata, ma non riesco a salvare i dati: completali dalla sua scheda." };
    }
    refreshGestione();
    return { ok: true };
  }

  const created = await createPersonWithAliases(operator.id, {
    first_name: firstName || null, last_name: lastName || null, email: email || null,
  }, []);
  if (!created.ok) return created;
  return linkEventSourceAction({ target, personId: created.data });
}
