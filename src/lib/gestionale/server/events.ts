import "server-only";

import { cache } from "react";

import type { LuxuriaEvent } from "@/lib/gestionale/types";
import { isUuidLike } from "@/lib/gestionale/validation";
import { isLuxuriaTitle, timestampToRomeDate } from "@/lib/gestionale/workshops";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Eventi Ticket Tailor: tabella esistente `events` del sito, SOLA LETTURA (D14).
// Il gestionale non scrive mai su `events` né sulle tabelle `ticket_tailor_*`.
// Colonne usate: id (uuid), title, starts_at, ends_at (timestamptz).

type EventRow = { id: string; title: string | null; starts_at: string | null; ends_at: string | null };

function toLuxuriaEvent(row: EventRow): LuxuriaEvent | null {
  const startsOn = timestampToRomeDate(row.starts_at);
  if (!row.title || !startsOn || !isLuxuriaTitle(row.title)) return null;
  return { id: row.id, name: row.title.trim(), startsOn, endsOn: timestampToRomeDate(row.ends_at) };
}

/** Tutti gli eventi LuXuria (passati, in corso e futuri; pubblici o no). */
export const loadLuxuriaEvents = cache(async (): Promise<LuxuriaEvent[]> => {
  const { data, error } = await createSupabaseAdminClient()
    .from("events")
    .select("id, title, starts_at, ends_at")
    .ilike("title", "%luxuria%")
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`Gestionale (eventi): ${error.message}`);
  return ((data ?? []) as EventRow[]).map(toLuxuriaEvent).filter((event): event is LuxuriaEvent => event !== null);
});

export async function getLuxuriaEvent(id: string): Promise<LuxuriaEvent | null> {
  if (!isUuidLike(id)) return null;
  return (await loadLuxuriaEvents()).find((event) => event.id === id) ?? null;
}

/** Read-only Ticket Tailor email fields for a workshop explicitly linked to an event. */
export async function loadLinkedWorkshopEmailFields(eventId: string): Promise<{
  schedule?: string[];
  extraNotes?: string;
}> {
  if (!isUuidLike(eventId)) return {};
  const {data,error}=await createSupabaseAdminClient().from("events")
    .select("source,raw_payload").eq("id",eventId).maybeSingle();
  if (error) throw new Error("Dati evento: " + error.message);
  const raw=data?.source==="ticket_tailor" ? data.raw_payload : null;
  const normalized=raw && typeof raw==="object" && !Array.isArray(raw) &&
    "normalized" in raw && raw.normalized && typeof raw.normalized==="object" &&
    !Array.isArray(raw.normalized) ? raw.normalized as Record<string,unknown> : null;
  if (!normalized) return {};
  const result:{schedule?:string[];extraNotes?:string}={};
  const start=typeof normalized.startTime==="string" && /^\d{2}:\d{2}$/.test(normalized.startTime) &&
    normalized.startTime!=="00:00" ? normalized.startTime : null;
  const end=typeof normalized.endTime==="string" && /^\d{2}:\d{2}$/.test(normalized.endTime) &&
    normalized.endTime!=="00:00" ? normalized.endTime : null;
  if (start) result.schedule=[
    "Ticket Tailor — event start: " + start + (end ? "; event end: " + end : ""),
  ];
  if (typeof normalized.description==="string" && normalized.description.trim())
    result.extraNotes = "From Ticket Tailor: " + normalized.description.trim().slice(0,5500);
  return result;
}
