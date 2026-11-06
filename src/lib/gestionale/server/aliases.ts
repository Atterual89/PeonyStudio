import "server-only";

import { sameEnteredText, type PersonAlias } from "@/lib/gestionale/aliases";
import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

// Altri nomi delle persone e iscrizioni "da abbinare" che li usano (4d, B2).
// D18: solo admin (requireAdmin).

type AliasRecord = { id: string; person_id: string; alias: string };

/** Altri nomi attivi; con `personId` solo quelli della persona. */
export async function loadAliases(personId?: string): Promise<PersonAlias[]> {
  await requireAdmin();
  let query = getGestionaleDb().from("gw_person_aliases").select("id, person_id, alias").is("deleted_at", null);
  if (personId) query = query.eq("person_id", personId);
  const { data, error } = await query.order("created_at", { ascending: true }).range(0, 9999);
  if (error) throw new Error(`Gestionale (altri nomi): ${error.message}`);
  return ((data ?? []) as AliasRecord[]).map((row) => ({ id: row.id, personId: row.person_id, alias: row.alias }));
}

export type PendingEntry = { participantId: string; bookingId: string; version: number; workshopId: string };

type PendingRecord = {
  id: string;
  person_id: string;
  workshop_id: string;
  entered_as: string | null;
  gw_bookings: { id: string; version: number } | { id: string; version: number }[] | null;
};

/**
 * Iscrizioni "da abbinare" (in qualsiasi workshop) il cui testo scritto da
 * Ale corrisponde esattamente a `text`, che si possono collegare alla persona:
 * non già sue e in workshop dove lei non è già iscritta.
 */
export async function findPendingEntries(personId: string, text: string): Promise<PendingEntry[]> {
  await requireAdmin();
  const db = getGestionaleDb();
  const [pending, enrolled] = await Promise.all([
    db
      .from("gw_booking_participants")
      .select("id, person_id, workshop_id, entered_as, gw_bookings!inner(id, version)")
      .eq("match_status", "da_abbinare")
      .is("removed_at", null)
      .is("deleted_at", null)
      .is("gw_bookings.deleted_at", null)
      .range(0, 9999),
    db.from("gw_booking_participants").select("workshop_id").eq("person_id", personId).is("removed_at", null).is("deleted_at", null),
  ]);
  if (pending.error) throw new Error(`Gestionale (iscrizioni da abbinare): ${pending.error.message}`);
  if (enrolled.error) throw new Error(`Gestionale (iscrizioni da abbinare): ${enrolled.error.message}`);

  const busy = new Set(((enrolled.data ?? []) as { workshop_id: string }[]).map((row) => row.workshop_id));
  const entries: PendingEntry[] = [];
  for (const row of (pending.data ?? []) as PendingRecord[]) {
    const booking = Array.isArray(row.gw_bookings) ? row.gw_bookings[0] : row.gw_bookings;
    if (!booking || row.person_id === personId || busy.has(row.workshop_id) || !sameEnteredText(row.entered_as, text)) continue;
    // Una sola iscrizione per workshop: la persona non può essere iscritta due volte.
    busy.add(row.workshop_id);
    entries.push({ participantId: row.id, bookingId: booking.id, version: booking.version, workshopId: row.workshop_id });
  }
  return entries;
}
