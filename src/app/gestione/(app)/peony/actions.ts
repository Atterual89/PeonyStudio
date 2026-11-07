"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { getPeonyEvent, isActivePeonyTicket } from "@/lib/gestionale/server/peony-events";
import { todayInRome } from "@/lib/gestionale/workshops";

export type PeonyActionResult = { ok: true } | { ok: false; error: string };

async function validTicket(eventId: string, ticketId: string): Promise<boolean> {
  const event = await getPeonyEvent(eventId); // requireAdmin anche nelle chiamate dirette
  if (!event || !ticketId || ticketId.length > 200) return false;
  const { data, error } = await getGestionaleDb()
    .from("ticket_tailor_issued_tickets")
    .select("status")
    .eq("ticket_tailor_event_id", event.ticketTailorEventId)
    .eq("ticket_tailor_issued_ticket_id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data && isActivePeonyTicket(data.status));
}

export async function setPeonyPresence(
  eventId: string,
  ticketId: string,
  present: boolean,
): Promise<PeonyActionResult> {
  const operator = await requireAdmin();
  if (typeof present !== "boolean" || !(await validTicket(eventId, ticketId))) {
    return { ok: false, error: "Biglietto non valido o non appartenente all'evento." };
  }
  const { error } = await getGestionaleDb()
    .from("gw_peony_checkins")
    .upsert({
      event_id: eventId,
      ticket_id: ticketId,
      present,
      updated_at: new Date().toISOString(),
      updated_by: operator.id,
    }, { onConflict: "event_id,ticket_id" });
  if (error) return { ok: false, error: "Impossibile aggiornare la presenza." };
  refreshGestione();
  return { ok: true };
}

export async function savePeonyEmailTemplate(
  eventId: string,
  subject: string,
  body: string,
): Promise<PeonyActionResult> {
  const operator = await requireAdmin();
  if (!(await getPeonyEvent(eventId))) return { ok: false, error: "Evento non disponibile." };
  if (typeof subject !== "string" || typeof body !== "string" ||
      !subject.trim() || subject.length > 300 || body.length > 30000) {
    return { ok: false, error: "Indica un oggetto (max 300 caratteri) e un testo (max 30.000)." };
  }
  const { error } = await getGestionaleDb()
    .from("gw_peony_email_templates")
    .upsert({
      event_id: eventId,
      subject: subject.trim(),
      body,
      updated_by: operator.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id" });
  if (error) return { ok: false, error: "Impossibile salvare il modello email." };
  refreshGestione();
  return { ok: true };
}

export async function markPeonyEmailSent(
  eventId: string,
  ticketIds: string[],
  subject: string,
): Promise<PeonyActionResult> {
  const operator = await requireAdmin();
  const event = await getPeonyEvent(eventId);
  if (!event || !Array.isArray(ticketIds) || ticketIds.length === 0 || ticketIds.length > 200 ||
      ticketIds.some((item) => typeof item !== "string" || !item || item.length > 200) ||
      typeof subject !== "string" || !subject.trim() || subject.length > 300) {
    return { ok: false, error: "Destinatari o oggetto non validi." };
  }
  const ids = [...new Set(ticketIds)];
  const { data, error: ticketsError } = await getGestionaleDb()
    .from("ticket_tailor_issued_tickets")
    .select("ticket_tailor_issued_ticket_id,status,holder_email")
    .eq("ticket_tailor_event_id", event.ticketTailorEventId)
    .in("ticket_tailor_issued_ticket_id", ids);
  if (ticketsError || data?.length !== ids.length ||
      data.some((row) => !isActivePeonyTicket(row.status) || !row.holder_email?.includes("@"))) {
    return { ok: false, error: "Alcuni biglietti non sono validi o non hanno email." };
  }
  const { error } = await getGestionaleDb()
    .from("gw_peony_email_sends")
    .upsert(ids.map((id) => ({
      event_id: eventId,
      ticket_id: id,
      subject: subject.trim(),
      sent_on: todayInRome(),
      created_by: operator.id,
    })), { onConflict: "event_id,ticket_id,subject,sent_on", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Impossibile registrare le email inviate." };
  refreshGestione();
  return { ok: true };
}
