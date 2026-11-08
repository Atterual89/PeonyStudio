import "server-only";
import { google, gmail_v1 } from "googleapis";
import { parsePaymentNotification, suggestedQuotaCount } from "@/lib/gestionale/payment-email-parser";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

const SOURCE = "gmail_payments";
function oauthClient() {
  const id = process.env.GMAIL_PAYMENTS_CLIENT_ID;
  const secret = process.env.GMAIL_PAYMENTS_CLIENT_SECRET;
  const token = process.env.GMAIL_PAYMENTS_REFRESH_TOKEN;
  if (!id || !secret || !token) throw new Error("Accesso Gmail per il gestionale non configurato. Servono OAuth client ID, secret e refresh token con ambito gmail.readonly.");
  const auth = new google.auth.OAuth2(id, secret);
  auth.setCredentials({ refresh_token: token });
  return auth;
}
function decode(data?: string | null) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
function bodyOf(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const parts = payload.parts ?? [];
  if (parts.length) {
    const texts = parts.flatMap((p) => {
      if (p.mimeType === "text/plain") return [decode(p.body?.data)];
      return p.parts ? [bodyOf(p)] : [];
    }).filter(Boolean);
    if (texts.length) return texts.join("\n");
  }
  return decode(payload.body?.data);
}
function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string) {
  return payload?.headers?.find((item) => item.name?.toLowerCase() === name)?.value ?? "";
}
export type PaymentImportResult = {
  scanned: number; imported: number; skipped: number;
  hasMore: boolean; lastSuccessAt: string | null;
};
export async function importPaymentNotifications(initialFrom?: string): Promise<PaymentImportResult> {
  const db = getGestionaleDb();
  const {data:state,error}=await db.from("gw_payment_sync_state")
    .select("initial_from,checked_through,last_success_at,pending_window_from,pending_window_until,pending_page_token")
    .eq("source",SOURCE).maybeSingle();
  if(error)throw new Error("Archivio sincronizzazione Gmail non disponibile: applica la migrazione.");
  const first=!state?.initial_from;
  if(first && (!initialFrom || !/^\d{4}-\d{2}-\d{2}$/.test(initialFrom) ||
     !Number.isFinite(Date.parse(initialFrom)) || Date.parse(initialFrom)>Date.now()))
    throw new Error("Scegli una data iniziale valida.");
  const initial=first?new Date(initialFrom+"T00:00:00Z"):new Date(state.initial_from);
  const windowFrom=state?.pending_window_from
    ? new Date(state.pending_window_from)
    : new Date(Math.max(initial.getTime(),(state?.checked_through
      ? Date.parse(state.checked_through)-48*3600_000 : initial.getTime())));
  const windowUntil=state?.pending_window_until
    ? new Date(state.pending_window_until):new Date(Date.now()-120_000);
  if(!Number.isFinite(windowFrom.getTime())||!Number.isFinite(windowUntil.getTime()))
    throw new Error("Checkpoint Gmail non valido.");
  const gmail=google.gmail({version:"v1",auth:oauthClient()});
  const query=`after:${Math.floor(windowFrom.getTime()/1000)} before:${Math.ceil(windowUntil.getTime()/1000)} {from:paypal.com from:paypal.it from:qonto.com} {subject:"Hai ricevuto denaro" subject:"Hai ricevuto un bonifico"}`;
  // One small Gmail page per server request. The UI can continue the import.
  const list=await gmail.users.messages.list({
    userId:"me",q:query,maxResults:25,pageToken:state?.pending_page_token||undefined
  });
  let scanned=0,imported=0,skipped=0;
  for(const item of list.data.messages??[]) {
    if(!item.id)continue;
    scanned++;
    const message=await gmail.users.messages.get({userId:"me",id:item.id,format:"full"});
    const payload=message.data.payload;
    const candidate=parsePaymentNotification({
      from:header(payload,"from"),subject:header(payload,"subject"),body:bodyOf(payload)
    });
    if(!candidate||!suggestedQuotaCount(candidate)){skipped++;continue;}
    const paidAt=new Date(Number(message.data.internalDate||0));
    if(!Number.isFinite(paidAt.getTime())){skipped++;continue;}
    const {error:insertError,data}=await db.from("gw_association_payment_emails").upsert({
      gmail_message_id:item.id,provider:candidate.provider,transaction_ref:candidate.transactionRef,
      paid_at:paidAt.toISOString(),payer_name:candidate.payerName,
      amount_cents:candidate.amountCents,note:candidate.note,
    },{onConflict:"gmail_message_id",ignoreDuplicates:true}).select("id");
    if(insertError){
      if(insertError.code==="23505" && candidate.transactionRef){skipped++;continue;}
      throw new Error("Salvataggio email non riuscito: checkpoint invariato.");
    }
    imported+=data?.length??0;
  }
  const completed=new Date().toISOString();
  const token=list.data.nextPageToken||null;
  const hasMore=Boolean(token);
  const {error:checkpointError}=await db.from("gw_payment_sync_state").upsert({
    source:SOURCE,
    initial_from:initial.toISOString(),
    pending_window_from:hasMore?windowFrom.toISOString():null,
    pending_window_until:hasMore?windowUntil.toISOString():null,
    pending_page_token:token,
    ...(hasMore?{}:{checked_through:windowUntil.toISOString(),last_success_at:completed}),
    updated_at:completed
  },{onConflict:"source"});
  if(checkpointError)throw new Error("Email salvate ma checkpoint non aggiornato: ripeti l'operazione, senza duplicazioni.");
  return {scanned,imported,skipped,hasMore,lastSuccessAt:hasMore?state?.last_success_at??null:completed};
}
