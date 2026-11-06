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
  return {
    workshopFields: { version: texts.data?.version ?? 0, fields: (texts.data?.fields ?? {}) as Partial<WorkshopEmailData> },
    defaults: { version: settings.data?.version ?? 0, fields: (settings.data?.fields ?? {}) as Partial<WorkshopEmailData> },
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
