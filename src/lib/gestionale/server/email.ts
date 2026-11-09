import "server-only";

import { getGestionaleDb } from "./db";
import type { WorkshopEmailData } from "../email/types";
import type { WorkshopView } from "../types";

export type EmailSendRow = {
  id: string;
  personId: string;
  kind: "partner" | "partner_reminder" | "workshop_details";
  number: number;
  sentOn: string;
};

export type EmailSavedFields = { version: number; fields: Partial<WorkshopEmailData> };
export type EmailDefaults = { version: number; fields: Partial<WorkshopEmailData> };

function fail(error: { message: string } | null): never {
  throw new Error("Gestionale Email: " + (error?.message || "errore sconosciuto"));
}

export async function loadEmailState(workshop: WorkshopView): Promise<{
  workshopFields: EmailSavedFields;
  defaults: EmailDefaults;
  sends: EmailSendRow[];
  ticketTailorFields: Partial<WorkshopEmailData>;
}> {
  const db = getGestionaleDb();
  const [texts, settings, sends] = await Promise.all([
    db.from("gw_email_texts").select("fields,version").eq("workshop_id", workshop.id).maybeSingle(),
    db.from("gw_settings").select("fields,version").eq("key", "email_defaults").maybeSingle(),
    db.from("gw_email_sends").select("id,person_id,kind,number,sent_on").eq("workshop_id", workshop.id).is("deleted_at", null).order("sent_on", { ascending: false }),
  ]);
  if (texts.error) fail(texts.error);
  if (settings.error) fail(settings.error);
  if (sends.error) fail(sends.error);
  const ticketTailorFields: Partial<WorkshopEmailData> = {};
  // LuXuria participants are managed by Ale, but a linked Ticket Tailor event
  // remains the source of public workshop description and start/end times.
  // Never auto-match workshop names: use only the explicit event_id link.
  if (workshop.event_id) {
    const linked = await db.from("events")
      .select("source,raw_payload").eq("id",workshop.event_id).maybeSingle();
    if (linked.error) fail(linked.error);
    const raw=linked.data?.source==="ticket_tailor" ? linked.data.raw_payload : null;
    const normalized=raw && typeof raw==="object" && !Array.isArray(raw) &&
      "normalized" in raw && raw.normalized && typeof raw.normalized==="object" &&
      !Array.isArray(raw.normalized) ? raw.normalized as Record<string,unknown> : null;
    if (normalized) {
      const start=typeof normalized.startTime==="string" && /^\d{2}:\d{2}$/.test(normalized.startTime) &&
        normalized.startTime!=="00:00" ? normalized.startTime : null;
      const end=typeof normalized.endTime==="string" && /^\d{2}:\d{2}$/.test(normalized.endTime) &&
        normalized.endTime!=="00:00" ? normalized.endTime : null;
      if (start) ticketTailorFields.schedule=[
        "Ticket Tailor — event start: " + start + (end ? "; event end: " + end : ""),
      ];
      if (typeof normalized.description==="string" && normalized.description.trim())
        ticketTailorFields.extraNotes = "From Ticket Tailor: " + normalized.description.trim().slice(0,5500);
    }
  }
  return {
    workshopFields: { version: texts.data?.version ?? 0, fields: (texts.data?.fields ?? {}) as Partial<WorkshopEmailData> },
    defaults: { version: settings.data?.version ?? 0, fields: (settings.data?.fields ?? {}) as Partial<WorkshopEmailData> },
    ticketTailorFields,
    sends: (sends.data ?? []).map((s): EmailSendRow => ({
      id: s.id, personId: s.person_id, kind: s.kind, number: s.number, sentOn: s.sent_on,
    })),
  };
}

export type PreviousEmailConfig = { workshopId: string; fields: Partial<WorkshopEmailData> };

export async function loadPreviousEmailConfigs(workshopId: string): Promise<PreviousEmailConfig[]> {
  const { data, error } = await getGestionaleDb().from("gw_email_texts")
    .select("workshop_id,fields").neq("workshop_id", workshopId).limit(100);
  if (error) fail(error);
  return (data ?? []).map((row) => ({
    workshopId: row.workshop_id,
    fields: row.fields as Partial<WorkshopEmailData>,
  }));
}
