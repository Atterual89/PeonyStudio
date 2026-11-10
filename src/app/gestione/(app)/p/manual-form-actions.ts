"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getPerson } from "@/lib/gestionale/server/data";
import { savePaperFormEvidence } from "@/lib/association/paper-form-attestation";
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
  const result=await savePaperFormEvidence({person,operatorId:operator.id,
    verified:input.verified,date,note});
  if(!result.ok)return result;
  await clearMembershipCache();
  refreshGestione();
  return {ok:true,verified:input.verified};
}
