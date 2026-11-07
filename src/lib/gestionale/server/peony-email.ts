import "server-only";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import type { PeonyEvent } from "@/lib/gestionale/server/peony-events";

export type PeonyEmailTemplate = { subject: string; body: string };
export type PeonyEmailSend = {
  id: string;
  ticketId: string;
  sentOn: string;
  subject: string;
};

export async function loadPeonyEmailState(event: PeonyEvent): Promise<{
  template: PeonyEmailTemplate;
  sends: PeonyEmailSend[];
}> {
  await requireAdmin();
  const [templateResult, sendsResult] = await Promise.all([
    getGestionaleDb().from("gw_peony_email_templates")
      .select("subject,body")
      .eq("event_id", event.id)
      .maybeSingle(),
    getGestionaleDb().from("gw_peony_email_sends")
      .select("id,ticket_id,subject,sent_on")
      .eq("event_id", event.id)
      .order("sent_on", { ascending: false })
      .limit(1000),
  ]);
  if (templateResult.error) throw new Error(`Email evento: ${templateResult.error.message}`);
  if (sendsResult.error) throw new Error(`Storico email: ${sendsResult.error.message}`);
  return {
    template: {
      subject: templateResult.data?.subject ?? `Informazioni per ${event.title}`,
      body: templateResult.data?.body ?? `Ciao,\n\nti scriviamo in merito all'evento ${event.title} di Peony Studio.\n\nA presto!\nPeony Studio`,
    },
    sends: (sendsResult.data ?? []).map((row) => ({
      id: row.id,
      ticketId: row.ticket_id,
      subject: row.subject,
      sentOn: row.sent_on,
    })),
  };
}
