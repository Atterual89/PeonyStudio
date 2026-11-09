import "server-only";

import {
  PEONY_EMAIL_KINDS, defaultPeonyEmailTemplate,
  type PeonyEmailKind, type PeonyEmailTemplate,
} from "@/lib/gestionale/peony-email-html";
import { peonyEmailLanguage, type PeonyEmailEventContext, type PeonyEmailLanguage } from "@/lib/gestionale/peony-email-context";
import type { PeonyEmailDetailFields } from "@/lib/gestionale/peony-email-details";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { loadPeonyEventEmailPayload, type PeonyEvent } from "@/lib/gestionale/server/peony-events";
import { formatDateRange } from "@/lib/gestionale/format";

export type { PeonyEmailTemplate, PeonyEmailKind } from "@/lib/gestionale/peony-email-html";
export type PeonyEmailSend = {
  id: string;
  ticketId: string;
  sentOn: string;
  subject: string;
  kind: PeonyEmailKind;
};

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function timeField(value: unknown): string | null {
  const candidate = stringField(value);
  return candidate && /^\d{2}:\d{2}$/.test(candidate) ? candidate : null;
}

/** Read synchronized Ticket Tailor information; no runtime API call or speculative defaults. */
export async function loadPeonyEmailState(event: PeonyEvent): Promise<{
  templates: Record<PeonyEmailKind, PeonyEmailTemplate>;
  sends: PeonyEmailSend[];
  context: PeonyEmailEventContext;
  languageOverride: PeonyEmailLanguage | null;
  detailFields: PeonyEmailDetailFields;
}> {
  await requireAdmin();
  const [templateResult, sendsResult, eventResult, settingsResult] = await Promise.all([
    getGestionaleDb().from("gw_peony_email_kinds")
      .select("kind,subject,body").eq("event_id", event.id),
    getGestionaleDb().from("gw_peony_email_sends")
      .select("id,ticket_id,subject,kind,sent_on")
      .eq("event_id", event.id).order("sent_on", { ascending: false }).range(0,9999),
    loadPeonyEventEmailPayload(event.id),
    getGestionaleDb().from("gw_peony_email_settings")
      .select("language_override,detail_fields").eq("event_id",event.id).maybeSingle(),
  ]);
  if (templateResult.error) throw new Error("Email evento: " + templateResult.error.message);
  if (sendsResult.error) throw new Error("Storico email: " + sendsResult.error.message);

  const raw = eventResult?.raw_payload;
  const normalized = raw && typeof raw === "object" && !Array.isArray(raw) &&
    "normalized" in raw && raw.normalized && typeof raw.normalized === "object" &&
    !Array.isArray(raw.normalized) ? raw.normalized as Record<string, unknown> : {};
  const context: PeonyEmailEventContext = {
    category: event.category,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    startTime: timeField(normalized.startTime),
    endTime: timeField(normalized.endTime),
    description: stringField(normalized.description),
    bookingUrl: stringField(eventResult?.booking_url) ??
      stringField(normalized.bookingUrl),
  };
  const date = event.startsOn ? formatDateRange(event.startsOn, event.endsOn) : "data da definire";
  // Backward compatible read during staged deployments before migration 042.
  if (settingsResult.error && !["42P01","PGRST205","PGRST116"].includes(settingsResult.error.code ?? ""))
    throw new Error("Impostazioni email: " + settingsResult.error.message);
  const savedSettings=settingsResult.error ? null : settingsResult.data;
  const languageOverride = savedSettings?.language_override === "en" || savedSettings?.language_override === "it" ?
    savedSettings.language_override as PeonyEmailLanguage : null;
  const detailFields = (savedSettings?.detail_fields && typeof savedSettings.detail_fields === "object" && !Array.isArray(savedSettings.detail_fields) ?
    savedSettings.detail_fields : {}) as PeonyEmailDetailFields;
  const language = languageOverride ?? peonyEmailLanguage(event.title, context);
  const templates = Object.fromEntries(PEONY_EMAIL_KINDS.map(({ id }) => {
    const saved = (templateResult.data ?? []).find((row) => row.kind === id);
    return [id, saved ? { subject: saved.subject, body: saved.body }
      : defaultPeonyEmailTemplate(id, event.title, date, language)];
  })) as Record<PeonyEmailKind, PeonyEmailTemplate>;
  return {
    templates, context, languageOverride, detailFields,
    sends: (sendsResult.data ?? []).map((row) => ({
      id: row.id, ticketId: row.ticket_id,
      subject: row.subject, sentOn: row.sent_on,
      kind: row.kind as PeonyEmailKind,
    })),
  };
}
