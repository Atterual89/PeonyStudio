"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
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
  eventId:string|null, cursor:string|null, firstPage:boolean,
):Promise<TicketTailorPageResult> {
  await requireAdmin();
  if(!process.env.TICKET_TAILOR_API_KEY?.trim()){
    return {ok:false,message:"Chiave Ticket Tailor non configurata nell'hosting di questa pagina. Controlla TICKET_TAILOR_API_KEY nelle variabili d'ambiente."};
  }
  if(typeof firstPage!=="boolean" ||
    (cursor!==null && (typeof cursor!=="string" || !/^[a-zA-Z0-9_-]{2,200}$/.test(cursor))) ||
    (eventId!==null && typeof eventId!=="string")) {
    return {ok:false,message:"Richiesta di sincronizzazione non valida."};
  }
  try{
    let eventCount=0;
    let ticketTailorEventId:string|undefined;
    if(eventId){
      const event=await getPeonyEvent(eventId);
      if(!event)return {ok:false,message:"Evento non disponibile."};
      ticketTailorEventId=event.ticketTailorEventId;
    }else if(firstPage && !cursor){
      // La sincronizzazione globale aggiorna anche l'elenco eventi.
      const events=await syncTicketTailorEvents();
      if(!events.ok){
        console.warn("[gestionale] Ticket Tailor: eventi non completamente aggiornati",events.errors.length);
        return {ok:false,message:"Alcuni eventi non sono stati aggiornati. Controlla i log; i dati precedenti rimangono disponibili."};
      }
      eventCount=events.upserted;
    }
    const tickets=await syncTicketTailorIssuedTickets({
      ticketTailorEventId,
      startingAfter:cursor,
      maxPages:1,
    });
    if(!tickets.ok){
      refreshGestione();
      return {ok:false,message:"Alcuni ordini o biglietti non sono stati salvati. Controlla i log prima di riprovare."};
    }
    if(!tickets.nextCursor)refreshGestione();
    return {ok:true,events:eventCount,orders:tickets.ordersUpserted,
      tickets:tickets.upserted,warnings:tickets.errors.length,
      nextCursor:tickets.nextCursor};
  }catch(error){
    console.error("[gestionale] Ticket Tailor: errore sync a pagine",error);
    const msg=error instanceof Error?error.message:"";
    const message=msg.includes("HTTP 401")||msg.includes("HTTP 403")
      ?"Ticket Tailor ha rifiutato le credenziali. Controlla la chiave API e i suoi permessi."
      :msg.includes("HTTP 429")
        ?"Ticket Tailor ha raggiunto il limite di richieste. Riprova più tardi."
        :msg.includes("timeout")||msg.includes("Timeout")||msg.includes("aborted")
          ?"Ticket Tailor non ha risposto entro il tempo previsto. I dati già salvati restano disponibili."
          :"Aggiornamento Ticket Tailor interrotto. Controlla i log del server; i dati già salvati restano disponibili.";
    return {ok:false,message};
  }
}
