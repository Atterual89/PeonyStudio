"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { importPaymentNotifications } from "@/lib/gestionale/server/payment-mail-import";
import { getPerson } from "@/lib/gestionale/server/data";
import { membershipIdentityOf, clearMembershipCache, searchMembers, getMemberLink } from "@/lib/gestionale/server/membership";
import { deriveMembershipState } from "@/lib/association/membership-state";
import { readAllMemberEvidence } from "@/lib/gestionale/server/peony-events";
import { membershipPeriodForPayment } from "@/lib/association/membership-periods";
import { suggestedQuotaCount } from "@/lib/gestionale/payment-email-parser";
import { combinePaymentPersonCandidates } from "@/lib/gestionale/payment-person-candidates";
import { proposePeopleForPayment } from "@/lib/gestionale/payment-auto-proposals";
import { formStatusForPerson, formStatusLabel } from "@/lib/gestionale/payment-person-form-status";
import { formIdentityCompatible } from "@/lib/association/form-identity";
import { normalizeMembershipEmail, normalizeMembershipNameKey } from "@/lib/association/membership-state";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { todayInRome } from "@/lib/gestionale/workshops";
import { isUuidLike } from "@/lib/gestionale/validation";

/** Analisi dal 1/9/2025 fino all'inizio dell'import ordinario, senza assegnazioni. */
export async function syncHistoricalAssociationMailAction() {
  await requireAdmin();
  try {
    return {ok:true as const,data:await importPaymentNotifications("historic")};
  } catch(error) {
    const details=error instanceof Error?error.message:String(error);
    if (/quota exceeded|rate.?limit|userRateLimitExceeded|rateLimitExceeded|quotaExceeded|too many requests|429/i.test(details)) {
      console.warn("[gmail-history] Limite Gmail raggiunto: blocco storico interrotto senza avanzare il checkpoint.");
      return {ok:false as const,error:
        "Limite temporaneo di Gmail raggiunto. I pagamenti già salvati non sono persi: riprova più tardi, un blocco alla volta."};
    }
    console.error("[gmail-history] Errore durante il recupero storico",error instanceof Error?error.name:"unknown");
    return {ok:false as const,error:"Impossibile leggere le notifiche Gmail. Nessuna quota è stata assegnata; riprova più tardi."};
  }
}

export async function syncAssociationMailAction() {
  await requireAdmin();
  try { return {ok:true as const, data:await importPaymentNotifications()}; }
  catch (error) { return {ok:false as const,error:error instanceof Error?error.message:"Impossibile leggere Gmail."}; }
}
export async function getAssociationMailState() {
  await requireAdmin();
  const db = getGestionaleDb();
  const [state, payments, suggestions] = await Promise.all([
    db.from("gw_payment_sync_state").select("initial_from,last_success_at").eq("source","gmail_payments").maybeSingle(),
    db.from("gw_association_payment_emails").select("id,provider,payer_name,amount_cents,note,paid_at,status").gte("paid_at","2025-08-31T22:00:00Z")
      .order("paid_at",{ascending:false}).limit(250),
    db.rpc("gw_payment_suggest_people"),
  ]);
  if (state.error || payments.error) return {ok:false as const,error:"Archivio pagamenti non disponibile. Verifica che la migrazione sia stata applicata."};
  const ids=(payments.data??[]).map(p=>p.id);
  const allocations=ids.length
    ? await db.from("gw_association_payment_allocations").select("id,payment_id,slot,person_id,member_key").in("payment_id",ids)
    : {data:[],error:null};
  if (allocations.error) return {ok:false as const,error:"Impossibile caricare gli abbinamenti delle quote."};

  // Una quota può essere già confermata da un'altra email: segnala il
  // conflitto prima del clic, senza assegnare la stessa quota due volte.
  const suggestionsByPayment=new Map<string,{id:string;name:string}>();
  for(const payment of payments.data??[]){
    const matches=(suggestions.data??[]).filter(
      (row:{payment_id:string})=>row.payment_id===payment.id
    );
    if(matches.length===1)suggestionsByPayment.set(payment.id,{
      id:matches[0].person_id,name:matches[0].person_name
    });
  }
  // Le proposte non dipendono più dalla ricerca manuale o dalla presenza di una
  // scheda preesistente. I moduli Google sono considerati senza creare quote.
  const [directoryRows,formRows]=await Promise.all([
    db.from("gw_people").select("id,first_name,last_name,nickname,email,membership_email")
      .is("deleted_at",null).is("merged_into",null).range(0,9999),
    db.from("association_members").select("first_name,last_name,email,source,membership_status")
      .in("source",["google_sheet","manual_form"]).range(0,9999),
  ]);
  if(directoryRows.error||formRows.error)
    return {ok:false as const,error:"Impossibile proporre le persone dai moduli Google."};
  const directory=(directoryRows.data??[]).map(p=>({
    kind:"person" as const,id:p.id,
    name:[p.first_name,p.last_name].filter(Boolean).join(" ")||p.nickname||p.email||"Persona",
    email:p.email,source:"Anagrafica · "+formStatusLabel(formStatusForPerson(p,formRows.data??[])),
  }));
  const forms=(formRows.data??[]).filter(p=>p.source==="google_sheet"&&Boolean(p.email))
    .map(p=>({
      kind:"member" as const,id:"e:"+normalizeMembershipEmail(p.email),
      name:[p.first_name,p.last_name].filter(Boolean).join(" ")||p.email||"Persona",
      email:p.email,source:"Modulo Google",
    }));
  const suggestedIds=[...new Set([...suggestionsByPayment.values()].map(x=>x.id))];
  const suggestedPeople=suggestedIds.length
    ? await db.from("gw_people").select("id,first_name,last_name,email")
      .in("id",suggestedIds).is("deleted_at",null).is("merged_into",null)
    : {data:[],error:null};
  const peopleById=new Map((suggestedPeople.data??[]).map(person=>[person.id,person]));
  const evidence=suggestedIds.length&&!suggestedPeople.error
    ? await readAllMemberEvidence().catch(()=>[])
    : [];
  const verifiedPayments=evidence.filter(row=>row.source==="manual_override");

  return {ok:true as const, state:state.data, payments:(payments.data??[]).map(p=>{
    const proposed=suggestionsByPayment.get(p.id)??null;
    const person=proposed?peopleById.get(proposed.id):null;
    const period=membershipPeriodForPayment(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date(p.paid_at)));
    const alreadyPaidPeriod=person&&period&&deriveMembershipState(
      verifiedPayments,{email:person.email,firstName:person.first_name,lastName:person.last_name},
      {paymentsFrom:period.paymentsFrom,paymentsUntil:period.validUntil}
    ).paymentMatchMethod==="payment_email"?period.paymentsFrom:null;
    return ({
    ...p, suggested:proposed, alreadyPaidPeriod,
    proposals:proposePeopleForPayment(p.payer_name,directory,forms),
    assigned: (allocations.data??[]).filter(a=>a.payment_id===p.id).map(a=>{
      const person=a.person_id?directory.find(row=>row.id===a.person_id):null;
      const member=a.member_key?forms.find(row=>row.id===a.member_key):null;
      return {id:a.id as string,slot:a.slot as number,name:person?.name??member?.name??"Persona già associata"};
    }),
    associationPeriodFrom: period?.paymentsFrom ?? null,
    associationExpiresAt: period?.validUntil ?? null,
    availableSlots:suggestedQuotaCount({
      provider:p.provider as "paypal"|"qonto", payerName:p.payer_name,
      amountCents:p.amount_cents, transactionRef:null,note:p.note,
    }),slots:(allocations.data??[]).filter(a=>a.payment_id===p.id).map(a=>a.slot as number)
  });
  })};
}
/** Lettura mirata delle evidenze per una persona, senza confondere i moduli con i pagamenti. */
export async function getMembershipVerificationDetailsAction(personId:string) {
 await requireAdmin();
 if(!isUuidLike(personId))return {ok:false as const,error:"Persona non valida."};
 const person=await getPerson(personId);
 if(!person||person.merged_into)return {ok:false as const,error:"Persona non disponibile."};
 const identity=await membershipIdentityOf(person);
 const email=normalizeMembershipEmail(identity.email);
 const name=normalizeMembershipNameKey(identity.firstName,identity.lastName);
 const db=getGestionaleDb();
 const {data,error}=await db.from("association_members")
  .select("id,first_name,last_name,email,source,membership_status,membership_starts_at,membership_expires_at,notes_admin")
  .in("source",["manual_override","google_sheet","manual_form","official_members_book"])
  .order("membership_starts_at",{ascending:false}).limit(500);
 if(error)return {ok:false as const,error:"Impossibile leggere le verifiche."};
 const matches=(data??[]).filter(row=>{
  const rowEmail=normalizeMembershipEmail(row.email);
  const rowName=normalizeMembershipNameKey(row.first_name,row.last_name);
  return Boolean(name&&rowName===name&&(!email||!rowEmail||rowEmail===email));
 });
 const linkedPaymentIds=[...new Set(matches.flatMap(row=>{
  const ref=row.notes_admin?.match(/riferimento ([0-9a-fA-F-]{36})/);
  return ref?[ref[1]]:[];
 }))];
 const allocations=linkedPaymentIds.length
  ? await db.from("gw_association_payment_allocations").select("payment_id,person_id").in("payment_id",linkedPaymentIds)
  : {data:[],error:null};
 if(allocations.error)return {ok:false as const,error:"Impossibile verificare i collegamenti dei pagamenti."};
 return {ok:true as const,personName:[person.first_name,person.last_name].filter(Boolean).join(" ")||person.nickname||"Persona",
  verifications:matches.map(row=>{
   const ref=row.notes_admin?.match(/riferimento ([0-9a-fA-F-]{36})/)?.[1]??null;
   const linked=Boolean(ref&&(allocations.data??[]).some(a=>a.payment_id===ref&&a.person_id===personId));
   return {id:row.id,source:row.source,status:row.membership_status,
    from:row.membership_starts_at,until:row.membership_expires_at,
    paymentRef:ref,linked,canRevoke:row.source==="manual_override"&&row.membership_status==="verified"&&!linked,
    label:row.source==="manual_override"?(ref?"Verifica da email":"Verifica manuale"):
      row.source==="google_sheet"?"Modulo Google":row.source==="official_members_book"?"Archivio storico":"Modulo manuale"};
  })};
}
/** Revoca solo una evidenza amministrativa, con controllo in DB e audit transazionale. */
export async function revokeMembershipVerificationAction(personId:string,evidenceId:string,reason:string){
 const operator=await requireAdmin();
 if(!isUuidLike(personId)||!isUuidLike(evidenceId)||typeof reason!=="string"||reason.trim().length<5)
  return {ok:false as const,error:"Indica una motivazione di almeno 5 caratteri."};
 const db=getGestionaleDb();
 const {error}=await db.rpc("gw_revoke_membership_verification",{
  p_evidence_id:evidenceId,p_person_id:personId,p_operator_id:operator.id,p_reason:reason.trim().slice(0,300)
 });
 if(error){console.error("[quote-email] Revoca verifica",error.code);return {ok:false as const,error:"Impossibile revocare la verifica. Controlla il collegamento alla persona o al pagamento."};}
 await clearMembershipCache();refreshGestione();
 return {ok:true as const};
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
    db.from("gw_people").select("id,first_name,last_name,nickname,email,membership_email")
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
  const formEmails=[...new Set((people.data??[]).flatMap(p=>[p.email,p.membership_email])
    .filter((email):email is string=>Boolean(email)))];
  const matchedEvidence=formEmails.length
    ? await db.from("association_members")
        .select("first_name,last_name,email,source,membership_status")
        .in("source",["google_sheet","manual_form"]).in("email",formEmails).limit(200)
    : {data:[],error:null};
  if(matchedEvidence.error)throw new Error("Impossibile verificare il modulo della persona.");
  for(const row of local){
    const person=(people.data??[]).find(p=>p.id===row.id);
    if(person){
      row.source += " · "+formStatusLabel(formStatusForPerson(person,matchedEvidence.data??[]));
    }
  }
  const book=members.map(m=>({
    kind:"member" as const,id:m.id,
    name:[m.first_name,m.last_name].filter(Boolean).join(" ")||m.email||"Socio",
    email:m.email,source:`Registrazione associativa da verificare${m.matchedAlias?` · ${m.matchedAlias}`:""}`
  }));
  return combinePaymentPersonCandidates([...local,...book]);
}
export async function ignoreAssociationPaymentAction(paymentId: string) {
  const operator=await requireAdmin();
  if(!isUuidLike(paymentId))return {ok:false as const,error:"Pagamento non valido."};
  const db=getGestionaleDb();
  const {data:slots,error:slotError}=await db.from("gw_association_payment_allocations")
    .select("id").eq("payment_id",paymentId).limit(1);
  if(slotError || slots?.length)return {ok:false as const,error:"Pagamento già assegnato o non disponibile."};
  const {error}=await db.from("gw_association_payment_emails").update({status:"ignored",updated_at:new Date().toISOString()}).eq("id",paymentId).eq("status","pending");
  if(error)return {ok:false as const,error:"Impossibile ignorare il pagamento."};
  await db.from("gw_association_payment_corrections").insert({
    payment_id:paymentId,operation:"ignore",operator_id:operator.id
  });
  refreshGestione();return {ok:true as const};
}
export type PaymentTarget = {kind:"person"|"member"; id:string};
export async function confirmAssociationPaymentAction(paymentId: string,target:PaymentTarget,periodFrom:string) {
  const operator=await requireAdmin();
  if(!isUuidLike(paymentId)||!target||!["person","member"].includes(target.kind)||
     typeof target.id!=="string"||target.id.length>300||typeof periodFrom!=="string")
    return {ok:false as const,error:"Dati non validi."};
  const period=membershipPeriodForPayment(periodFrom);
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
    // La registrazione Google è una prova della PERSONA, non un destinatario
    // alternativo del versamento. Mai scrivere nuove allocazioni member_key.
    const member=await getMemberLink(target.id);
    if(!member)return {ok:false as const,error:"Registrazione associativa non trovata."};
    if(!member.email)
      return {ok:false as const,error:"Collega prima il modulo alla scheda Persona: non è identificabile tramite email."};
    const dbLookup=getGestionaleDb();
    const {data:possible,error:lookupError}=await dbLookup.from("gw_people")
      .select("id,first_name,last_name,email")
      .ilike("email",member.email).is("deleted_at",null).is("merged_into",null).limit(20);
    if(lookupError)return {ok:false as const,error:"Impossibile verificare l'anagrafica centrale."};
    const matched=(possible??[]).filter(p=>formIdentityCompatible(
      {firstName:p.first_name,lastName:p.last_name,email:p.email},
      {first_name:member.firstName,last_name:member.lastName,email:member.email},
    ));
    if(matched.length!==1)
      return {ok:false as const,error:"Registrazione non collegata univocamente a una Persona. Verifica l'anagrafica prima della quota."};
    const person=await getPerson(matched[0].id);
    if(!person||person.merged_into)return {ok:false as const,error:"Persona non disponibile."};
    personId=person.id;
    identity=await membershipIdentityOf(person);
    // memberKey resta null: la quota appartiene sempre al person_id.
  }
  if(!identity.email&&!(identity.firstName&&identity.lastName))
    return {ok:false as const,error:"Anagrafica insufficiente per verificare la quota."};
  const db=getGestionaleDb();
  // Nello stesso bonifico da 30€ la seconda quota deve essere assegnata
  // a un'altra persona, anche quando la prima era collegata come "member".
  const {data:prior,error:priorError}=await db.from("gw_association_payment_allocations")
    .select("person_id,member_key").eq("payment_id",paymentId);
  if(priorError)return {ok:false as const,error:"Impossibile controllare le quote già assegnate."};
  const targetMail=normalizeMembershipEmail(identity.email);
  const targetName=normalizeMembershipNameKey(identity.firstName,identity.lastName);
  for(const row of prior??[]){
    if((personId&&row.person_id===personId)||(memberKey&&row.member_key===memberKey))
      return {ok:false as const,error:"Questa persona ha già una quota associata al pagamento."};
    let priorIdentity:{email:string|null;firstName:string|null;lastName:string|null}|null=null;
    if(row.person_id){
      const existing=await getPerson(row.person_id);
      if(existing)priorIdentity=await membershipIdentityOf(existing);
    }else if(row.member_key){
      const member=await getMemberLink(row.member_key);
      if(member)priorIdentity={email:member.email,firstName:member.firstName,lastName:member.lastName};
    }
    if(!priorIdentity)continue;
    const priorMail=normalizeMembershipEmail(priorIdentity.email);
    const priorName=normalizeMembershipNameKey(priorIdentity.firstName,priorIdentity.lastName);
    if((targetMail&&priorMail&&targetMail===priorMail)||
       (targetName&&priorName&&targetName===priorName)){
      return {ok:false as const,error:"Le due quote devono essere assegnate a persone diverse."};
    }
  }
  const {data:payment,error}=await db.from("gw_association_payment_emails")
    .select("id,provider,amount_cents,status,paid_at").eq("id",paymentId).maybeSingle();
  if(error||!payment||payment.status!=="pending")
    return {ok:false as const,error:"Pagamento già chiuso o inesistente."};
  // È la data effettiva del pagamento a decidere l’annualità, mai il menu.
  if (membershipPeriodForPayment(new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Rome"}).format(new Date(payment.paid_at)))?.paymentsFrom !== period.paymentsFrom)
    return {ok:false as const,error:"La quota deve essere assegnata all’annualità determinata dalla data del pagamento."};
  const capacity=suggestedQuotaCount({
    provider:payment.provider as "paypal"|"qonto",
    payerName:null,amountCents:payment.amount_cents,transactionRef:null,note:null
  });
  if(capacity<1)return {ok:false as const,error:"Importo non compatibile con una quota."};
  const evidence=await readAllMemberEvidence();
  const window={paymentsFrom:period.paymentsFrom,paymentsUntil:period.validUntil};
  // La prova da email prevale sulla validazione manuale, ma un secondo
  // pagamento confermato via email per lo stesso periodo non va duplicato.
  const state=deriveMembershipState(evidence,identity,window);
  if(state.currentYearPaid&&state.paymentMatchMethod!=="manual")
    return {ok:false as const,error:`Quota ${period.validUntil.slice(0,4)} già verificata via email: non è stato salvato nulla.`};
  // Una verifica esclusivamente manuale NON blocca un pagamento documentato:
  // la funzione SQL sostituisce la sua prova conservando l'abbinamento e lo storico.
  const {error:rpcError}=await db.rpc("gw_confirm_association_payment",{
    p_payment_id:paymentId,p_person_id:personId,p_member_key:memberKey,
    p_period_from:period.paymentsFrom,p_period_until:period.validUntil,
    p_operator_id:operator.id,p_first_name:identity.firstName,p_last_name:identity.lastName,p_email:identity.email
  });
  if(rpcError){
    console.error("[quote-email] Conferma quota fallita",rpcError.code);
    return {ok:false as const,error:"Abbinamento non effettuato: quota già assegnata o dati cambiati. Ricarica e verifica."};
  }
  // L'interfaccia conferma il risultato SOLO dopo aver riletto l'assegnazione
  // realmente salvata (non basta che l'RPC non abbia restituito errori).
  const {data:allocation,error:verifyError}=await db.from("gw_association_payment_allocations")
    .select("id,slot,period_from")
    .eq("payment_id",paymentId)
    .eq("period_from",period.paymentsFrom)
    .eq("person_id",personId!)
    .maybeSingle();
  if(verifyError||!allocation)return {ok:false as const,error:"Salvataggio non confermato dal database. Ricarica e controlla la quota prima di riprovare."};
  await clearMembershipCache();
  refreshGestione();
  return {ok:true as const,data:{slot:allocation.slot,periodFrom:allocation.period_from}};
}

/** Rimuove solo il collegamento selezionato; la funzione SQL conserva l'audit. */
export async function unassignAssociationPaymentAction(allocationId:string,reason:string) {
 const operator=await requireAdmin();
 if(!isUuidLike(allocationId))return {ok:false as const,error:"Abbinamento non valido."};
 const db=getGestionaleDb();
 const {error}=await db.rpc("gw_unassign_association_payment",{
  p_allocation_id:allocationId,p_operator_id:operator.id,p_reason:reason.trim().slice(0,300)||null
 });
 if(error){console.error("[quote-email] Disassociazione",error.code);return {ok:false as const,error:"Non è stato possibile disassociare la quota. Controlla che la migrazione 044 sia applicata."};}
 await clearMembershipCache();refreshGestione();
 return {ok:true as const};
}
/** Ripristino esplicito dei movimenti ignorati, senza assegnazione automatica. */
export async function restoreAssociationPaymentAction(paymentId:string) {
 const operator=await requireAdmin();
 if(!isUuidLike(paymentId))return {ok:false as const,error:"Pagamento non valido."};
 const db=getGestionaleDb();
 const {data,error}=await db.from("gw_association_payment_emails")
  .update({status:"pending",updated_at:new Date().toISOString()})
  .eq("id",paymentId).eq("status","ignored").select("id").maybeSingle();
 if(error||!data)return {ok:false as const,error:"Pagamento non ignorato o non disponibile."};
 await db.from("gw_association_payment_corrections").insert({
  payment_id:paymentId,operation:"restore",operator_id:operator.id
 });
 refreshGestione();return {ok:true as const};
}
