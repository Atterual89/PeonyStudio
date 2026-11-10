"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson } from "@/lib/gestionale/server/data";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { clearMembershipCache } from "@/lib/gestionale/server/membership";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { isUuidLike } from "@/lib/gestionale/validation";
import { todayInRome } from "@/lib/gestionale/workshops";

/**
 * Il modulo cartaceo attesta SOLO la registrazione, non il pagamento.
 * Ogni conferma o revoca registra data, operatore e nota amministrativa.
 */
export async function setPaperFormAction(input:{
  personId:string; verified:boolean; signedOn?:string; note?:string;
}):Promise<{ok:true;verified:boolean}|{ok:false;error:string}>{
  const operator=await requireAdmin();
  if(!isUuidLike(input?.personId)||typeof input.verified!=="boolean")
    return {ok:false,error:"Persona o scelta non valida."};
  const person=await getPerson(input.personId);
  if(!person||person.merged_into)return {ok:false,error:"Anagrafica non disponibile."};
  if(!person.email&&!person.first_name)return {ok:false,error:"Aggiungi almeno email o nominativo alla scheda."};
  const date=input.signedOn?.trim()||todayInRome();
  const note=(input.note??"").trim().slice(0,400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||
    date>todayInRome()||date<"2000-01-01")
    return {ok:false,error:"Data del modulo non valida."};
  const db=getGestionaleDb();
  const sourceRowId="manual_form:person:"+person.id;
  const {data:existing,error:readError}=await db.from("association_members")
    .select("id,membership_status").eq("source","manual_form")
    .eq("source_row_id",sourceRowId).limit(2);
  if(readError||!existing||existing.length>1)
    return {ok:false,error:"Impossibile verificare lo storico del modulo: nessuna modifica eseguita."};
  if(!input.verified&&!existing.length)
    return {ok:false,error:"Non esiste un modulo cartaceo da annullare."};
  const now=new Date().toISOString();
  const payload={
    source:"manual_form",source_row_id:sourceRowId,source_hash:null,
    first_name:person.first_name,last_name:person.last_name,email:person.email,
    membership_status:input.verified?"verified":"revoked",
    membership_starts_at:date,membership_expires_at:null,
    notes_admin:"Modulo cartaceo "+(input.verified?"confermato":"annullato")+" il "+now+
      "; admin "+operator.id+(note?"; nota: "+note:""),
    updated_at:now,
  };
  const result=existing.length
    ? await db.from("association_members").update(payload).eq("id",existing[0].id)
      .eq("source","manual_form").select("id").single()
    : await db.from("association_members").insert(payload).select("id").single();
  if(result.error||!result.data?.id)
    return {ok:false,error:"Il modulo cartaceo non è stato salvato. Nessuna quota modificata."};
  await clearMembershipCache();
  refreshGestione();
  return {ok:true,verified:input.verified};
}
