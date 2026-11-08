"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
import { getGestionaleDb } from "@/lib/gestionale/server/db";
import { getPeonyEvent } from "@/lib/gestionale/server/peony-events";
import { refreshGestione } from "@/lib/gestionale/server/refresh";
import { syncTicketTailorEvents } from "@/lib/ticket-tailor/sync-events";
import { syncTicketTailorIssuedTickets } from "@/lib/ticket-tailor/sync-issued-tickets";

export type TicketTailorSyncResult =
  | { ok: true; events: number; orders: number; tickets: number; warnings: number }
  | { ok: false; message: string };

/**
 * Il PIN identifica un admin Peony. Non serve inserire il vecchio
 * ADMIN_SYNC_SECRET, che rimane riservato agli endpoint legacy.
 */
export async function syncTicketTailorFromGestionale(): Promise<TicketTailorSyncResult> {
  await requireAdmin();

  if (!process.env.TICKET_TAILOR_API_KEY) {
    return {
      ok: false,
      message: "Manca la chiave API Ticket Tailor nell'hosting di questa versione del sito. Verifica TICKET_TAILOR_API_KEY e ripubblica.",
    };
  }

  try {
    const events = await syncTicketTailorEvents();
    if (!events.ok) {
      return {
        ok: false,
        message: "La sincronizzazione degli eventi ha segnalato errori. Nessun conteggio è stato dichiarato aggiornato.",
      };
    }

    const tickets = await syncTicketTailorIssuedTickets();
    if (!tickets.ok) {
      refreshGestione();
      return {
        ok: false,
        message: "Eventi sincronizzati, ma alcuni ordini o biglietti non sono stati aggiornati. Controlla i log di sincronizzazione.",
      };
    }

    // Invalidare la home e le schede dopo che ordini e biglietti sono stati salvati.
    refreshGestione();
    return {
      ok: true,
      events: events.upserted,
      orders: tickets.ordersUpserted,
      tickets: tickets.upserted,
      warnings: tickets.errors.length + events.errors.length,
    };
  } catch (error) {
    console.error("[gestionale] Errore sincronizzazione Ticket Tailor", error);
    return {
      ok: false,
      message: "Sincronizzazione Ticket Tailor non riuscita. I dati precedenti restano disponibili; riprova o controlla i log.",
    };
  }
}


/** Una singola pagina di ordini Ticket Tailor per richiesta server.
 * La vista Evento è limitata ai biglietti del suo evento; la home può
 * aggiornare anche gli eventi. Nessuna riga viene rimossa dal database.
 */
export type TicketTailorPageResult =
  | {ok:true;events:number;orders:number;tickets:number;warnings:number;nextCursor:string|null}
  | {ok:false;message:string};

export async function syncTicketTailorPageFromGestionale(
  eventId:string|null, cursor:string|null, firstPage:boolean, forceFull=false,
):Promise<TicketTailorPageResult> {
  await requireAdmin();
  if(!process.env.TICKET_TAILOR_API_KEY?.trim()){
    return {ok:false,message:"Chiave Ticket Tailor non configurata nell'hosting di questa pagina."};
  }
  if(typeof firstPage!=="boolean"||typeof forceFull!=="boolean"||
    (cursor!==null && (typeof cursor!=="string" || !/^[a-zA-Z0-9_-]{2,200}$/.test(cursor))) ||
    (eventId!==null && typeof eventId!=="string")) {
    return {ok:false,message:"Richiesta di sincronizzazione non valida."};
  }
  try{
    const db=getGestionaleDb();
    let eventCount=0;
    let ticketTailorEventId:string|undefined;
    if(eventId){
      const event=await getPeonyEvent(eventId);
      if(!event)return {ok:false,message:"Evento non disponibile."};
      ticketTailorEventId=event.ticketTailorEventId;
    }
    const source=`ticket_tailor:${eventId||"all"}`;
    const {data:state,error:stateError}=await db.from("gw_payment_sync_state")
      .select("tt_head_id,tt_pending_head_id,tt_pending_cursor,tt_pending_mode,tt_last_full_at,last_success_at")
      .eq("source",source).maybeSingle();
    if(stateError)return {ok:false,message:"Archivio sincronizzazioni non disponibile. Controlla la migrazione database."};
    const continuing=Boolean(state?.tt_pending_mode)&&!(firstPage&&forceFull);
    if(!firstPage&&!continuing)return {ok:false,message:"Sincronizzazione da riavviare: nessuna scansione attiva."};
    const lastFull=state?.tt_last_full_at?Date.parse(state.tt_last_full_at):0;
    const mode:"full"|"incremental"=continuing
      ? state!.tt_pending_mode as "full"|"incremental"
      : (!state?.tt_head_id||forceFull||!lastFull||Date.now()-lastFull>7*24*60*60_000
        ? "full":"incremental");
    // Continue from server checkpoint; never trust a browser cursor as proof of progress.
    const effectiveCursor=continuing?state!.tt_pending_cursor:null;
    if(firstPage&&!continuing&&!eventId){
      const events=await syncTicketTailorEvents();
      if(!events.ok)return {ok:false,message:"Impossibile aggiornare gli eventi Ticket Tailor."};
      eventCount=events.upserted;
    }
    const tickets=await syncTicketTailorIssuedTickets({
      ticketTailorEventId,
      startingAfter:effectiveCursor,
      maxPages:1,
      stopAfterOrderId:mode==="incremental"?state?.tt_head_id:null,
    });
    if(!tickets.ok){
      refreshGestione();
      return {ok:false,message:"Alcuni biglietti non sono stati salvati. Riprovare; checkpoint invariato."};
    }
    const nextCursor=tickets.nextCursor;
    const done=!nextCursor;
    const now=new Date().toISOString();
    const newHead=continuing
      ? (state?.tt_pending_head_id||state?.tt_head_id||null)
      : (tickets.newestOrderId||state?.tt_head_id||null);
    const {error:checkpointError}=await db.from("gw_payment_sync_state").upsert({
      source,
      tt_head_id:done?newHead:(state?.tt_head_id||null),
      tt_pending_head_id:done?null:newHead,
      tt_pending_cursor:done?null:nextCursor,
      tt_pending_mode:done?null:mode,
      tt_last_full_at:done&&mode==="full"?now:(state?.tt_last_full_at||null),
      ...(done?{last_success_at:now}:{}),
      updated_at:now,
    },{onConflict:"source"});
    if(checkpointError)return {ok:false,message:"Biglietti salvati, ma checkpoint non registrato. Ripetere l'operazione senza perdita dati."};
    if(done)refreshGestione();
    return {ok:true,events:eventCount,orders:tickets.ordersUpserted,
      tickets:tickets.upserted,warnings:tickets.errors.length,nextCursor};
  }catch(error){
    console.error("[gestionale] Ticket Tailor: errore sync a pagine",error);
    const msg=error instanceof Error?error.message:"";
    const message=msg.includes("HTTP 401")||msg.includes("HTTP 403")
      ?"Ticket Tailor ha rifiutato le credenziali. Controlla la chiave API e i suoi permessi."
      :msg.includes("HTTP 429")
        ?"Ticket Tailor ha raggiunto il limite di richieste. Riprova più tardi."
        :msg.includes("timeout")||msg.includes("Timeout")||msg.includes("aborted")
          ?"Ticket Tailor non ha risposto entro il tempo previsto. I dati già salvati restano disponibili."
          :"Aggiornamento Ticket Tailor interrotto. I dati precedenti restano disponibili.";
    return {ok:false,message};
  }
}
