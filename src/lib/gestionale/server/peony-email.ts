import "server-only";

import { PEONY_EMAIL_KINDS, defaultPeonyEmailTemplate, type PeonyEmailKind, type PeonyEmailTemplate } from "@/lib/gestionale/peony-email-html";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import type { PeonyEvent } from "@/lib/gestionale/server/peony-events";
import { formatDateRange } from "@/lib/gestionale/format";

export type { PeonyEmailTemplate, PeonyEmailKind } from "@/lib/gestionale/peony-email-html";
export type PeonyEmailSend = {
  id: string;
  ticketId: string;
  sentOn: string;
  subject: string;
  kind: PeonyEmailKind;
};

export async function loadPeonyEmailState(event: PeonyEvent): Promise<{
  templates: Record<PeonyEmailKind, PeonyEmailTemplate>;
  sends: PeonyEmailSend[];
}> {
  await requireAdmin();
  const [templateResult, sendsResult] = await Promise.all([
    getGestionaleDb().from("gw_peony_email_kinds")
      .select("kind,subject,body").eq("event_id", event.id),
    getGestionaleDb().from("gw_peony_email_sends")
      .select("id,ticket_id,subject,kind,sent_on")
      .eq("event_id", event.id).order("sent_on", { ascending: false }).limit(1000),
  ]);
  if (templateResult.error) throw new Error(`Email evento: ${templateResult.error.message}`);
  if (sendsResult.error) throw new Error(`Storico email: ${sendsResult.error.message}`);
  const date = event.startsOn ? formatDateRange(event.startsOn, event.endsOn) : "data da definire";
  const templates = Object.fromEntries(PEONY_EMAIL_KINDS.map(({ id }) => {
    const saved = (templateResult.data ?? []).find((row) => row.kind === id);
    return [id, saved ? { subject: saved.subject, body: saved.body }
      : defaultPeonyEmailTemplate(id, event.title, date)];
  })) as Record<PeonyEmailKind, PeonyEmailTemplate>;
  return {
    templates,
    sends: (sendsResult.data ?? []).map((row) => ({
      id: row.id, ticketId: row.ticket_id,
      subject: row.subject, sentOn: row.sent_on,
      kind: row.kind as PeonyEmailKind,
    })),
  };
}
