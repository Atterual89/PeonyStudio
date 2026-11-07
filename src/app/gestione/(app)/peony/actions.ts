"use server";

import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { getPeonyEvent, isActivePeonyTicket } from "@/lib/gestionale/server/peony-events";
import { todayInRome } from "@/lib/gestionale/workshops";
import { PEONY_EMAIL_KINDS, type PeonyEmailKind } from "@/lib/gestionale/peony-email-html";

export type PeonyActionResult = { ok: true } | { ok: false; error: string };

const validKind = (kind: unknown): kind is PeonyEmailKind =>
  typeof kind === "string" && PEONY_EMAIL_KINDS.some((item) => item.id === kind);

/** Non modifica mai i biglietti o le presenze Ticket Tailor. */
export async function savePeonyEmailTemplate(
  eventId: string,
  kind: PeonyEmailKind,
  subject: string,
  body: string,
): Promise<PeonyActionResult> {
  const operator = await requireAdmin();
  if (!validKind(kind) || !(await getPeonyEvent(eventId)))
    return { ok: false, error: "Evento o tipo di email non disponibile." };
  if (typeof subject !== "string" || typeof body !== "string" ||
      !subject.trim() || subject.length > 300 || body.length > 30000) {
    return { ok: false, error: "Indica un oggetto (max 300 caratteri) e un testo (max 30.000)." };
  }
  const { error } = await getGestionaleDb().from("gw_peony_email_kinds")
    .upsert({ event_id: eventId, kind, subject: subject.trim(), body,
      updated_by: operator.id, updated_at: new Date().toISOString() },
    { onConflict: "event_id,kind" });
  if (error) return { ok: false, error: "Impossibile salvare il modello email." };
  refreshGestione();
  return { ok: true };
}

export async function markPeonyEmailSent(
  eventId: string,
  ticketIds: string[],
  kind: PeonyEmailKind,
  subject: string,
): Promise<PeonyActionResult> {
  const operator = await requireAdmin();
  const event = await getPeonyEvent(eventId);
  if (!event || !validKind(kind) || !Array.isArray(ticketIds) ||
      ticketIds.length === 0 || ticketIds.length > 200 ||
      ticketIds.some((id) => typeof id !== "string" || !id || id.length > 200) ||
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
  const { error } = await getGestionaleDb().from("gw_peony_email_sends")
    .upsert(ids.map((id) => ({
      event_id: eventId, ticket_id: id,
      kind, subject: subject.trim(), sent_on: todayInRome(), created_by: operator.id,
    })), { onConflict: "event_id,ticket_id,kind,subject,sent_on", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Impossibile registrare le email inviate." };
  refreshGestione();
  return { ok: true };
}
