import "server-only";

import { cache } from "react";

import type { LuxuriaEvent } from "@/lib/gestionale/types";
import { isUuidLike } from "@/lib/gestionale/validation";
import { isLuxuriaTitle, timestampToRomeDate } from "@/lib/gestionale/workshops";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ticketTailorWorkshopFields } from "@/lib/gestionale/email/ticket-tailor-workshop";
import type { WorkshopEmailData } from "@/lib/gestionale/email/types";

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

/** Read only the workshop's linked TT event; raw official fields are the source of truth. */
export async function loadLinkedWorkshopEmailFields(eventId:string):Promise<Partial<WorkshopEmailData>> {
  if (!isUuidLike(eventId)) return {};
  const {data,error}=await createSupabaseAdminClient().from("events")
    .select("source,raw_payload,booking_url,starts_at,ends_at")
    .eq("id",eventId).maybeSingle();
  if(error)throw new Error("Dati evento Ticket Tailor: "+error.message);
  if(!data || data.source!=="ticket_tailor")return {};
  return ticketTailorWorkshopFields({
    rawPayload:data.raw_payload,bookingUrl:data.booking_url,
    startsAt:data.starts_at,endsAt:data.ends_at,
  });
}
