"use server";

import { requireAdmin } from "@/lib/gestionale/server/auth";
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
      message: "Manca la chiave API Ticket Tailor su Vercel (TICKET_TAILOR_API_KEY). Configurala nelle variabili Production e ripubblica il sito.",
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
