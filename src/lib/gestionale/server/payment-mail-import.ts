import "server-only";
import { google, gmail_v1 } from "googleapis";
import { paymentMailBody } from "@/lib/gestionale/gmail-message-body";
import { gmailAuthForPayments, PEONY_GMAIL_ADDRESS } from "@/lib/gestionale/server/payment-gmail-oauth";
import { parsePaymentNotification, suggestedQuotaCount } from "@/lib/gestionale/payment-email-parser";
import { getGestionaleDb } from "@/lib/gestionale/server/db";

const SOURCE = "gmail_payments";
// Identificativo storico conservato per compatibilità con i checkpoint già salvati.
const HISTORIC_SOURCE = "gmail_payments_history_2024";
// Da settembre 2025: i pagamenti anteriori non servono a verificare le quote attive.
const HISTORIC_START = new Date("2025-09-01T00:00:00+02:00");
function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string) {
  return payload?.headers?.find((item) => item.name?.toLowerCase() === name)?.value ?? "";
}
export type PaymentImportResult = {
  scanned: number; imported: number; skipped: number;
  hasMore: boolean; lastSuccessAt: string | null;
};
export async function importPaymentNotifications(mode:"recent"|"historic"="recent"): Promise<PaymentImportResult> {
  const db = getGestionaleDb();
  const source=mode==="historic"?HISTORIC_SOURCE:SOURCE;
  const {data:state,error}=await db.from("gw_payment_sync_state")
    .select("initial_from,checked_through,last_success_at,pending_window_from,pending_window_until,pending_page_token")
    .eq("source",source).maybeSingle();
  if(error)throw new Error("Archivio sincronizzazione Gmail non disponibile: applica la migrazione.");
  // Una scansione avviata con il vecchio limite 2024 ha query e page token
  // incompatibili con il nuovo filtro. Riparte da settembre 2025; Gmail ID
  // e transaction_ref impediscono duplicati con i dati già recuperati.
  const resetHistoricWindow=mode==="historic" &&
    Boolean(state?.initial_from && Date.parse(state.initial_from)<HISTORIC_START.getTime());
  // First run starts automatically at the latest official association-source update.
  // Never use manual validations as a baseline: those are not source sync events.
  // Subsequent runs resume only from the Gmail checkpoint (with a 48-hour overlap).
  let initial:Date;
  if(mode==="historic" && (resetHistoricWindow || !state?.initial_from)) {
    initial=HISTORIC_START;
  } else if (state?.initial_from) {
    initial=new Date(state.initial_from);
  } else {
    const {data:baseline,error:baselineError}=await db.from("association_members")
      .select("updated_at").in("source",["google_sheet","official_members_book"])
      .not("updated_at","is",null).order("updated_at",{ascending:false}).limit(1).maybeSingle();
    if(baselineError)throw new Error("Impossibile leggere l'ultimo aggiornamento del libro soci.");
    // On fresh installs with no historical source, use membership start rather
    // than silently skipping all past payments.
    const firstPeriod=Date.parse("2025-09-01T00:00:00Z");
    const sourceUpdated=baseline?.updated_at?Date.parse(baseline.updated_at):firstPeriod;
    initial=new Date(Math.max(firstPeriod,Math.min(Date.now(),sourceUpdated)-48*3600_000));
  }
  if(!Number.isFinite(initial.getTime()))throw new Error("Data dell'ultimo allineamento non valida.");
  const windowFrom=!resetHistoricWindow && state?.pending_window_from
    ? new Date(Math.max(initial.getTime(),Date.parse(state.pending_window_from)))
    : new Date(Math.max(initial.getTime(),(!resetHistoricWindow && state?.checked_through
      ? Date.parse(state.checked_through)-48*3600_000 : initial.getTime())));
  // L'archivio storico termina dove comincia l'import incrementale corrente.
  // I due checkpoint sono indipendenti e i messaggi sono idempotenti per Gmail ID.
  const cutoff=mode==="historic"
    ? await db.from("gw_payment_sync_state").select("initial_from")
        .eq("source",SOURCE).maybeSingle()
    : null;
  if(cutoff?.error)throw new Error("Impossibile verificare l'inizio dell'import ordinario.");
  const historicalUntil=cutoff?.data?.initial_from
    ? new Date(cutoff.data.initial_from):new Date("2026-10-25T00:00:00Z");
  const windowUntil=!resetHistoricWindow && state?.pending_window_until
    ? new Date(state.pending_window_until)
    : mode==="historic"?historicalUntil:new Date(Date.now()-120_000);
  if(!Number.isFinite(windowFrom.getTime())||!Number.isFinite(windowUntil.getTime()))
    throw new Error("Checkpoint Gmail non valido.");
  const gmail=google.gmail({version:"v1",auth:await gmailAuthForPayments()});
  const profile=await gmail.users.getProfile({userId:"me"});
  if(profile.data.emailAddress?.toLowerCase()!==PEONY_GMAIL_ADDRESS)
    throw new Error("La casella Gmail autorizzata non è Peony Studio. Nessun pagamento importato.");
  const query=`after:${Math.floor(windowFrom.getTime()/1000)} before:${Math.ceil(windowUntil.getTime()/1000)} {from:paypal.com from:paypal.it from:qonto.com} {subject:"Hai ricevuto denaro" subject:"Hai ricevuto un bonifico"}`;
  // One small Gmail page per server request. The UI can continue the import.
  const list=await gmail.users.messages.list({
    // Gmail messages.get(format=full) consuma molte unità quota: 8 per clic
    // e nessuna sequenza automatica di pagine consecutive.
    userId:"me",q:query,maxResults:mode==="historic"?8:25,
    pageToken:resetHistoricWindow?undefined:state?.pending_page_token||undefined
  });
  let scanned=0,imported=0,skipped=0;
  for(const item of list.data.messages??[]) {
    if(!item.id)continue;
    scanned++;
    const message=await gmail.users.messages.get({userId:"me",id:item.id,format:"full"});
    const payload=message.data.payload;
    const candidate=parsePaymentNotification({
      from:header(payload,"from"),subject:header(payload,"subject"),body:paymentMailBody(payload)
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
    source,
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
