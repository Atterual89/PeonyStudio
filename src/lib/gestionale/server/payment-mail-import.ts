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
export type PaymentImportResult = { scanned: number; imported: number; skipped: number; lastSuccessAt: string };
export async function importPaymentNotifications(initialFrom?: string): Promise<PaymentImportResult> {
  const db = getGestionaleDb();
  const { data: state, error } = await db.from("gw_payment_sync_state")
    .select("initial_from,checked_through").eq("source", SOURCE).maybeSingle();
  if (error) throw new Error("Checkpoint Gmail non disponibile: applica la migrazione prima dell'importazione.");
  const isFirst = !state?.initial_from;
  if (isFirst && (!initialFrom || !/^\d{4}-\d{2}-\d{2}$/.test(initialFrom) ||
      !Number.isFinite(Date.parse(initialFrom)) || Date.parse(initialFrom) > Date.now())) {
    throw new Error("Scegli una data iniziale valida.");
  }
  const start = isFirst ? new Date(initialFrom + "T00:00:00Z") :
    new Date(Math.max(Date.parse(state.checked_through || state.initial_from) - 48 * 60 * 60 * 1000,
      Date.parse(state.initial_from)));
  if (!Number.isFinite(start.getTime())) throw new Error("Checkpoint Gmail non valido.");
  const auth = oauthClient();
  const gmail = google.gmail({version:"v1", auth});
  const cutoff = new Date(Date.now() - 120_000);
  const query = `after:${Math.floor(start.getTime() / 1000)} before:${Math.ceil(cutoff.getTime() / 1000)} {from:paypal.com from:paypal.it from:qonto.com} {subject:"Hai ricevuto denaro" subject:"Hai ricevuto un bonifico"}`;
  let pageToken: string | undefined;
  let scanned = 0, imported = 0, skipped = 0;
  let finished = false;
  for (let page = 0; page < 100; page++) {
    const list = await gmail.users.messages.list({userId:"me",q:query,maxResults:100,pageToken});
    for (const item of list.data.messages ?? []) {
      if (!item.id) continue;
      scanned++;
      const message = await gmail.users.messages.get({userId:"me",id:item.id,format:"full"});
      const payload = message.data.payload;
      const candidate = parsePaymentNotification({
        from:header(payload,"from"),
        subject:header(payload,"subject"),
        body:bodyOf(payload),
      });
      if (!candidate || !suggestedQuotaCount(candidate)) { skipped++; continue; }
      const paidAt = new Date(Number(message.data.internalDate || 0));
      if (!Number.isFinite(paidAt.getTime())) { skipped++; continue; }
      // Ignore duplicates and never overwrite decisions made by an admin.
      const { error: insertError, data } = await db.from("gw_association_payment_emails")
        .upsert({
          gmail_message_id:item.id, provider:candidate.provider,
          transaction_ref:candidate.transactionRef,
          paid_at:paidAt.toISOString(),payer_name:candidate.payerName,
          amount_cents:candidate.amountCents,note:candidate.note,
        },{onConflict:"gmail_message_id",ignoreDuplicates:true}).select("id");
      if (insertError) {
        // A second Gmail notification can refer to an existing PayPal transaction.
        if (insertError.code === "23505" && candidate.transactionRef) { skipped++; continue; }
        throw new Error("Salvataggio pagamento fallito; checkpoint non avanzato.");
      }
      imported += data?.length ?? 0;
    }
    pageToken = list.data.nextPageToken || undefined;
    if (!pageToken) { finished = true; break; }
  }
  if (!finished) throw new Error("Importazione troppo ampia: dati già salvati, checkpoint invariato. Riprovare con intervallo ridotto.");
  const completed = new Date().toISOString();
  const { error: checkpointError } = await db.from("gw_payment_sync_state").upsert({
    source:SOURCE, initial_from:state?.initial_from || start.toISOString(),
    checked_through:cutoff.toISOString(),last_success_at:completed,updated_at:completed,
  },{onConflict:"source"});
  if (checkpointError) throw new Error("Importazione eseguita ma checkpoint non salvato: ripetere la sincronizzazione (deduplicata).");
  return {scanned,imported,skipped,lastSuccessAt:completed};
}
