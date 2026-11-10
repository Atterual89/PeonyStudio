"use server";

import { requireOperator } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { validatePersonForm, type PersonFormValues } from "@/lib/gestionale/people";
import { isUuidLike, isVersion } from "@/lib/gestionale/validation";

export async function saveSharedPersonAction(input: {
  personId: string;
  version: number;
  values: PersonFormValues;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const operator = await requireOperator();
  if (!isUuidLike(input?.personId) || !isVersion(input.version)) {
    return { ok: false, error: "Scheda non valida. Ricarica la pagina." };
  }
  const valid = validatePersonForm(input.values);
  if (!valid.ok) return { ok: false, error: Object.values(valid.errors)[0] ?? "Controlla i dati." };
  const db = getGestionaleDb();
  // La scheda e' accessibile all'organizzatrice solo se collegata a una sua iscrizione.
  if (operator.role !== "admin") {
    const [linksResult,ownedResult] = await Promise.all([
      db.from("gw_booking_participants")
        .select("booking_id,gw_bookings!inner(workshop_id,deleted_at)")
        .eq("person_id",input.personId)
        .is("deleted_at",null).is("removed_at",null).limit(200),
      db.from("gw_bookings").select("workshop_id")
        .eq("created_by",operator.id).is("deleted_at",null).limit(10000),
    ]);
    if(linksResult.error||ownedResult.error)
      return {ok:false,error:"Impossibile verificare l'accesso."};
    const allowed=new Set((ownedResult.data??[]).map(row=>row.workshop_id));
    const permitted=(linksResult.data??[]).some(row=>{
      const booking=Array.isArray(row.gw_bookings)?row.gw_bookings[0]:row.gw_bookings;
      return Boolean(booking&&!booking.deleted_at&&allowed.has(booking.workshop_id));
    });
    if (!permitted) return { ok: false, error: "Questa persona non risulta tra le tue iscrizioni." };
  }

  // Evita di sovrascrivere una modifica piu' recente dell'altra persona.
  const { data: current, error: fetchError } = await db.from("gw_people")
    .select("id,version,merged_into,deleted_at,teamartist_id,notes")
    .eq("id", input.personId).maybeSingle();
  if (fetchError || !current || current.merged_into || current.deleted_at)
    return { ok: false, error: "Anagrafica non disponibile." };
  if (current.version !== input.version)
    return { ok: false, error: "Scheda modificata da un altra persona. Ricarica prima di salvare." };

  // I campi amministrativi non sono modificabili da Alessandra.
  const fields = valid.payload;
  const patch = {
    first_name: fields.first_name, last_name: fields.last_name,
    nickname: fields.nickname, email: fields.email,
    instagram: fields.instagram, phone: fields.phone,
    ...(operator.role === "admin" ? { notes: fields.notes, teamartist_id: fields.teamartist_id } : {}),
    version: current.version + 1,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("gw_people").update(patch)
    .eq("id", input.personId).eq("version", input.version).is("deleted_at", null)
    .select("id").maybeSingle();
  if (error) return { ok: false, error: "Salvataggio non riuscito." };
  if (!data) return { ok: false, error: "I dati sono cambiati: ricarica la scheda." };
  refreshGestione();
  return { ok: true };
}
