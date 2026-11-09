"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { getWorkshopBookings, getWorkshopView } from "@/lib/gestionale/server/data";
import { emailRecipients } from "@/lib/gestionale/email/recipients";
import type { EmailSendRow } from "@/lib/gestionale/server/email";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { todayInRome } from "@/lib/gestionale/workshops";
import { isIsoDate, isUuidLike } from "@/lib/gestionale/validation";
import { WORKSHOP_EMAIL_KEYS, GLOBAL_EMAIL_KEYS, type WorkshopEmailData } from "@/lib/gestionale/email/types";
import type { ActionResult } from "@/lib/gestionale/types";

const INVALID: ActionResult<never> = { ok: false, error: "Dati non validi. Ricarica la pagina e riprova." };
const TEXT_FIELDS = ["title","dateLabel","location","intercom","mapsUrl","membershipFormUrl","membershipDeadline","intro","ropes","clothing","arrival","extraNotes","signature","emergencyContact","associationName","associationPresident","associationVicePresident","transferInstructions","lunchMapUrl"] as const;
const ARRAY_FIELDS = ["program","prerequisitesRiggers","prerequisitesModels","schedule","accessInfo","lunchInfo","venueRules","photoPolicy"] as const;
const VALID_TYPES = ["partner","partner_reminder","workshop_details"] as const;

function validateFields(value: unknown): Partial<WorkshopEmailData> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, string | string[] | number> = {};
  for (const name of TEXT_FIELDS) {
    const field = source[name];
    if (field !== undefined) {
      if (typeof field !== "string" || field.length > 5000) return null;
      result[name] = field.trim();
    }
  }
  for (const name of ARRAY_FIELDS) {
    const field = source[name];
    if (field !== undefined) {
      if (!Array.isArray(field) || field.length > 100 || !field.every((v) => typeof v === "string" && v.length <= 500)) return null;
      result[name] = field.map((v: string) => v.trim()).filter(Boolean);
    }
  }
  if (source.membershipFeeEuro !== undefined) {
    if (typeof source.membershipFeeEuro !== "number" || !Number.isInteger(source.membershipFeeEuro) || source.membershipFeeEuro < 0 || source.membershipFeeEuro > 1000) return null;
    result.membershipFeeEuro = source.membershipFeeEuro;
  }
  if (result.mapsUrl && !/^https:\/\/(?:maps\.app\.goo\.gl|www\.google\.com|google\.com)\//i.test(String(result.mapsUrl))) return null;
  if (result.membershipFormUrl && !/^https:\/\/(?:forms\.gle|docs\.google\.com)\//i.test(String(result.membershipFormUrl))) return null;
  if (result.lunchMapUrl && !/^https:\/\/www\.google\.com\/maps\//i.test(String(result.lunchMapUrl))) return null;
  return result as Partial<WorkshopEmailData>;
}

function rpcFailure(error: { message: string; code?: string | null }): ActionResult<never> {
  if (error.code === "GW409") return { ok: false, error: "I dati sono cambiati. Ricarica e riprova." };
  console.error("Gestionale Email RPC:", error.code, error.message);
  return { ok: false, error: "Operazione non riuscita. Riprova." };
}

export async function saveWorkshopEmailAction(input: { workshopId: string; version: number; fields: Partial<WorkshopEmailData> }): Promise<ActionResult<{ version: number }>> {
  const operator = await requireAdmin();
  const fields = validateFields(input?.fields);
  if (!isUuidLike(input?.workshopId) || !Number.isInteger(input.version) || input.version < 0 || !fields) return INVALID;
  const workshop = await getWorkshopView(input.workshopId);
  if (!workshop) return INVALID;
  const workshopOnly = Object.fromEntries(WORKSHOP_EMAIL_KEYS.filter((key) => key in fields).map((key) => [key, fields[key]]));
  const { data, error } = await getGestionaleDb().rpc("gw_save_email_texts", {
    p_operator_id: operator.id, p_workshop_id: workshop.id, p_version: input.version, p_fields: workshopOnly,
  });
  if (error) return rpcFailure(error);
  refreshGestione();
  return { ok: true, data: { version: data as number } };
}

export async function saveEmailDefaultsAction(input: { version: number; fields: Partial<WorkshopEmailData> | Record<string, string | number> }): Promise<ActionResult<{ version: number }>> {
  const operator = await requireAdmin();
  const fields = validateFields(input?.fields);
  if (!Number.isInteger(input?.version) || input.version < 0 || !fields) return INVALID;
  const globalOnly = Object.fromEntries(GLOBAL_EMAIL_KEYS.filter((key) => key in fields).map((key) => [key, fields[key]]));
  const { data, error } = await getGestionaleDb().rpc("gw_save_email_defaults", {
    p_operator_id: operator.id, p_version: input.version, p_fields: globalOnly,
  });
  if (error) return rpcFailure(error);
  refreshGestione();
  return { ok: true, data: { version: data as number } };
}

export async function markEmailSentAction(input: {
  workshopId: string;
  personIds: string[];
  kind: "partner" | "partner_reminder" | "workshop_details";
  mode?: "initial" | "reminder";
  sentOn: string;
}): Promise<ActionResult<{ count: number }>> {
  const operator = await requireAdmin();
  if (!isUuidLike(input?.workshopId) || !(typeof input?.kind === "string" && (VALID_TYPES as readonly string[]).includes(input.kind)) ||
      (input.mode !== undefined && input.mode !== "initial" && input.mode !== "reminder") ||
      (input.mode === "reminder" && input.kind !== "workshop_details") || !isIsoDate(input?.sentOn) ||
      input.sentOn > todayInRome() || !Array.isArray(input.personIds) || !input.personIds.length ||
      input.personIds.length > 500 || !input.personIds.every(isUuidLike)) return INVALID;
  const workshop = await getWorkshopView(input.workshopId);
  if (!workshop) return INVALID;
  // Revalidate all recipients against current bookings before writing, avoiding stale UI data.
  const bookings = await getWorkshopBookings(workshop);
  const { data: sendRows, error: sendsError } = await getGestionaleDb()
    .from("gw_email_sends").select("id,person_id,kind,number,sent_on")
    .eq("workshop_id", workshop.id).is("deleted_at", null);
  if (sendsError) return { ok: false, error: "Impossibile verificare gli invii precedenti." };
  const sends: EmailSendRow[] = (sendRows ?? []).map((row) => ({
    id: row.id, personId: row.person_id, kind: row.kind, number: row.number, sentOn: row.sent_on,
  }));
  const recipientKind = input.kind === "workshop_details" ?
    (input.mode==="reminder" ? "workshop_details_reminder" : "workshop_details")
    : input.kind === "partner_reminder" ? "partner_reminder" : "partner";
  const valid = new Set(emailRecipients(bookings, sends)
    .filter((candidate) => candidate.type === recipientKind && candidate.email)
    .map((candidate) => candidate.personId));
  const ids = [...new Set(input.personIds)];
  if (!ids.every((id) => valid.has(id))) return { ok: false, error: "Una persona non è più idonea. Ricarica la pagina." };
  const { data, error } = await getGestionaleDb().rpc("gw_mark_email_sends", {
    p_operator_id: operator.id, p_workshop_id: workshop.id, p_person_ids: ids, p_kind: input.kind, p_sent_on: input.sentOn,
  });
  if (error) return rpcFailure(error);
  refreshGestione();
  return { ok: true, data: { count: data as number } };
}

export async function deleteEmailSentAction(id: string): Promise<ActionResult> {
  const operator = await requireAdmin();
  if (!isUuidLike(id)) return INVALID;
  const { error } = await getGestionaleDb().rpc("gw_delete_email_send", { p_operator_id: operator.id, p_id: id });
  if (error) return rpcFailure(error);
  refreshGestione();
  return { ok: true };
}
