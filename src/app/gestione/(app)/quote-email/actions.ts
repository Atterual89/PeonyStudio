"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { importPaymentNotifications } from "@/lib/gestionale/server/payment-mail-import";
import { getPerson } from "@/lib/gestionale/server/data";
import { membershipIdentityOf, clearMembershipCache } from "@/lib/gestionale/server/membership";
import { saveManualValidation } from "@/lib/association/manual-validation";
import { membershipPeriodFor } from "@/lib/association/membership-periods";
import { suggestedQuotaCount } from "@/lib/gestionale/payment-email-parser";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { todayInRome } from "@/lib/gestionale/workshops";
import { isUuidLike } from "@/lib/gestionale/validation";

export async function syncAssociationMailAction(initialFrom?: string) {
  await requireAdmin();
  try { return {ok:true as const, data:await importPaymentNotifications(initialFrom)}; }
  catch (error) { return {ok:false as const,error:error instanceof Error?error.message:"Impossibile leggere Gmail."}; }
}
export async function getAssociationMailState() {
  await requireAdmin();
  const db = getGestionaleDb();
  const [state, payments, allocations] = await Promise.all([
    db.from("gw_payment_sync_state").select("initial_from,last_success_at").eq("source","gmail_payments").maybeSingle(),
    db.from("gw_association_payment_emails").select("id,provider,payer_name,amount_cents,note,paid_at,status").eq("status","pending").order("paid_at",{ascending:false}).limit(75),
    db.from("gw_association_payment_allocations").select("payment_id,slot,person_id").limit(5000),
  ]);
  if (state.error || payments.error || allocations.error) return {ok:false as const,error:"Archivio pagamenti non disponibile. Verifica che la migrazione sia stata applicata."};
  return {ok:true as const, state:state.data, payments:(payments.data??[]).map(p=>({
    ...p, availableSlots:suggestedQuotaCount({
      provider:p.provider as "paypal"|"qonto", payerName:p.payer_name,
      amountCents:p.amount_cents, transactionRef:null,note:p.note,
    }),slots:(allocations.data??[]).filter(a=>a.payment_id===p.id).map(a=>a.slot as number)
  }))};
}
export async function findPaymentPeopleAction(query: string) {
  await requireAdmin();
  const q=query.trim().replace(/[%(),.]/g,"").slice(0,80);
  if(q.length<2)return [];
  const db=getGestionaleDb();
  const {data,error}=await db.from("gw_people")
    .select("id,first_name,last_name,nickname,email")
    .is("deleted_at",null).is("merged_into",null)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(20);
  if(error)throw new Error("Ricerca persone non disponibile.");
  return data??[];
}
export async function ignoreAssociationPaymentAction(paymentId: string) {
  await requireAdmin();
  if(!isUuidLike(paymentId))return {ok:false as const,error:"Pagamento non valido."};
  const db=getGestionaleDb();
  const {data:slots,error:slotError}=await db.from("gw_association_payment_allocations")
    .select("id").eq("payment_id",paymentId).limit(1);
  if(slotError || slots?.length)return {ok:false as const,error:"Pagamento già assegnato o non disponibile."};
  const {error}=await db.from("gw_association_payment_emails").update({status:"ignored",updated_at:new Date().toISOString()}).eq("id",paymentId).eq("status","pending");
  if(error)return {ok:false as const,error:"Impossibile ignorare il pagamento."};
  refreshGestione();return {ok:true as const};
}
export async function confirmAssociationPaymentAction(paymentId: string,personId: string) {
  const operator=await requireAdmin();
  if(!isUuidLike(paymentId)||!isUuidLike(personId))return {ok:false as const,error:"Dati non validi."};
  const db=getGestionaleDb();
  const {data:payment,error}=await db.from("gw_association_payment_emails")
    .select("id,provider,amount_cents,status").eq("id",paymentId).maybeSingle();
  if(error||!payment||payment.status!=="pending")return {ok:false as const,error:"Pagamento già chiuso o inesistente."};
  const capacity=suggestedQuotaCount({provider:payment.provider,payerName:null,amountCents:payment.amount_cents,transactionRef:null,note:null});
  if(capacity<1)return {ok:false as const,error:"Importo non compatibile con una quota."};
  const [person, usedResult]=await Promise.all([
    getPerson(personId),db.from("gw_association_payment_allocations").select("slot,person_id").eq("payment_id",paymentId),
  ]);
  if(!person||person.merged_into||usedResult.error)return {ok:false as const,error:"Persona non disponibile."};
  if((usedResult.data??[]).some(row=>row.person_id===personId))return {ok:false as const,error:"Questa persona è già stata associata al pagamento."};
  const slot=Array.from({length:capacity},(_,i)=>i+1).find(n=>!(usedResult.data??[]).some(row=>row.slot===n));
  if(!slot)return {ok:false as const,error:"Tutte le quote di questo pagamento sono già assegnate."};
  const identity=await membershipIdentityOf(person);
  if(!identity.email && !(identity.firstName&&identity.lastName))return {ok:false as const,error:"Completa prima l'anagrafica della persona."};
  const period=membershipPeriodFor(todayInRome());
  if(!period)return {ok:false as const,error:"Periodo associativo non valido."};
  // Reserve the allocation before issuing membership validation; unique slot prevents double allocation.
  const {data:allocation,error:allocationError}=await db.from("gw_association_payment_allocations")
    .insert({payment_id:paymentId,person_id:personId,slot,period_from:period.paymentsFrom,
      validated_by:operator.id}).select("id").single();
  if(allocationError||!allocation)return {ok:false as const,error:"Quota già assegnata o registrazione non riuscita."};
  const validation=await saveManualValidation(identity,{period});
  if(!validation.ok){
    await db.from("gw_association_payment_allocations").delete().eq("id",allocation.id);
    return {ok:false as const,error:"Validazione associativa non riuscita. Abbinamento annullato."};
  }
  if((usedResult.data??[]).length+1===capacity){
    const {error:statusError}=await db.from("gw_association_payment_emails")
      .update({status:"confirmed",updated_at:new Date().toISOString()}).eq("id",paymentId);
    if(statusError)return {ok:false as const,error:"Quota verificata, ma impossibile chiudere il pagamento. Ricarica per controllare."};
  }
  await clearMembershipCache();
  refreshGestione();
  return {ok:true as const};
}
