"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { importPaymentNotifications } from "@/lib/gestionale/server/payment-mail-import";
import { getPerson } from "@/lib/gestionale/server/data";
import { membershipIdentityOf, clearMembershipCache, searchMembers, getMemberLink } from "@/lib/gestionale/server/membership";
import { deriveMembershipState } from "@/lib/association/membership-state";
import { readAllMemberEvidence } from "@/lib/gestionale/server/peony-events";
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
  const [state, payments, suggestions] = await Promise.all([
    db.from("gw_payment_sync_state").select("initial_from,last_success_at").eq("source","gmail_payments").maybeSingle(),
    db.from("gw_association_payment_emails").select("id,provider,payer_name,amount_cents,note,paid_at,status").eq("status","pending").order("paid_at",{ascending:false}).limit(75),
    db.rpc("gw_payment_suggest_people"),
  ]);
  if (state.error || payments.error) return {ok:false as const,error:"Archivio pagamenti non disponibile. Verifica che la migrazione sia stata applicata."};
  const ids=(payments.data??[]).map(p=>p.id);
  const allocations=ids.length
    ? await db.from("gw_association_payment_allocations").select("payment_id,slot,person_id").in("payment_id",ids)
    : {data:[],error:null};
  if (allocations.error) return {ok:false as const,error:"Impossibile caricare gli abbinamenti delle quote."};
  return {ok:true as const, state:state.data, payments:(payments.data??[]).map(p=>({
    ...p, suggested:(()=>{const matches=(suggestions.data??[]).filter((row: {payment_id:string})=>row.payment_id===p.id);return matches.length===1?{id:matches[0].person_id,name:matches[0].person_name}:null;})(),
    availableSlots:suggestedQuotaCount({
      provider:p.provider as "paypal"|"qonto", payerName:p.payer_name,
      amountCents:p.amount_cents, transactionRef:null,note:p.note,
    }),slots:(allocations.data??[]).filter(a=>a.payment_id===p.id).map(a=>a.slot as number)
  }))};
}
export type PaymentPersonCandidate = {
 kind:"person"|"member"; id:string; name:string; email:string|null; source:string;
};
export async function findPaymentPeopleAction(query: string): Promise<PaymentPersonCandidate[]> {
  await requireAdmin();
  if(typeof query!=="string")return [];
  const q=query.trim().replace(/[%_,()\\]/g,"").slice(0,80);
  if(q.length<2)return [];
  const db=getGestionaleDb();
  const [people, members]=await Promise.all([
    db.from("gw_people").select("id,first_name,last_name,nickname,email")
      .is("deleted_at",null).is("merged_into",null)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`).limit(15),
    searchMembers(q,15,undefined,{includeLinked:true}),
  ]);
  if(people.error)throw new Error("Ricerca persone non disponibile.");
  const local=(people.data??[]).map(p=>({
    kind:"person" as const,id:p.id,
    name:[p.first_name,p.last_name].filter(Boolean).join(" ")||p.nickname||p.email||"Persona",
    email:p.email,source:p.nickname?`Anagrafica · ${p.nickname}`:"Anagrafica"
  }));
  const book=members.map(m=>({
    kind:"member" as const,id:m.id,
    name:[m.first_name,m.last_name].filter(Boolean).join(" ")||m.email||"Socio",
    email:m.email,source:`Libro soci / modulo${m.matchedAlias?` · ${m.matchedAlias}`:""}`
  }));
  return [...local,...book];
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
export type PaymentTarget = {kind:"person"|"member"; id:string};
export async function confirmAssociationPaymentAction(paymentId: string,target:PaymentTarget,periodFrom:string) {
  const operator=await requireAdmin();
  if(!isUuidLike(paymentId)||!target||!["person","member"].includes(target.kind)||
     typeof target.id!=="string"||target.id.length>300||typeof periodFrom!=="string")
    return {ok:false as const,error:"Dati non validi."};
  const period=membershipPeriodFor(periodFrom);
  const currentYear=Number(todayInRome().slice(0,4));
  if(!period||period.paymentsFrom!==periodFrom||
     Number(period.validUntil.slice(0,4))>currentYear+1)
    return {ok:false as const,error:"Periodo associativo non valido."};
  let identity: {email:string|null;firstName:string|null;lastName:string|null};
  let personId:string|null=null;
  let memberKey:string|null=null;
  if(target.kind==="person") {
    if(!isUuidLike(target.id))return {ok:false as const,error:"Persona non valida."};
    const person=await getPerson(target.id);
    if(!person||person.merged_into)return {ok:false as const,error:"Persona non disponibile."};
    identity=await membershipIdentityOf(person);
    personId=person.id;
  } else {
    const member=await getMemberLink(target.id);
    if(!member)return {ok:false as const,error:"Socio non trovato nel libro associativo."};
    identity={email:member.email,firstName:member.firstName,lastName:member.lastName};
    memberKey=target.id;
  }
  if(!identity.email&&!(identity.firstName&&identity.lastName))
    return {ok:false as const,error:"Anagrafica insufficiente per verificare la quota."};
  const db=getGestionaleDb();
  const {data:payment,error}=await db.from("gw_association_payment_emails")
    .select("id,provider,amount_cents,status").eq("id",paymentId).maybeSingle();
  if(error||!payment||payment.status!=="pending")
    return {ok:false as const,error:"Pagamento già chiuso o inesistente."};
  const capacity=suggestedQuotaCount({
    provider:payment.provider as "paypal"|"qonto",
    payerName:null,amountCents:payment.amount_cents,transactionRef:null,note:null
  });
  if(capacity<1)return {ok:false as const,error:"Importo non compatibile con una quota."};
  // Avoid re-validating a member whose fee is already recorded by TeamArtist.
  const state=deriveMembershipState(await readAllMemberEvidence(),identity,{
    paymentsFrom:period.paymentsFrom,paymentsUntil:period.validUntil
  });
  if(state.currentYearPaid)return {ok:false as const,error:"Quota già verificata per questo periodo. Non assegnare un secondo pagamento: controlla il libro soci."};
  const {error:rpcError}=await db.rpc("gw_confirm_association_payment",{
    p_payment_id:paymentId,p_person_id:personId,p_member_key:memberKey,
    p_period_from:period.paymentsFrom,p_period_until:period.validUntil,
    p_operator_id:operator.id,p_first_name:identity.firstName,p_last_name:identity.lastName,p_email:identity.email
  });
  if(rpcError){
    console.error("[quote-email] Conferma quota fallita",rpcError.code);
    return {ok:false as const,error:"Abbinamento non effettuato: quota già assegnata o dati cambiati. Ricarica e verifica."};
  }
  await clearMembershipCache();
  refreshGestione();
  return {ok:true as const};
}
