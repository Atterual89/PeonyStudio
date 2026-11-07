import { NextRequest, NextResponse } from "next/server";
import { syncTicketTailorIssuedTickets } from "@/lib/ticket-tailor/sync-issued-tickets";

export const dynamic = "force-dynamic";

/** Mantiene il vecchio endpoint Admin, senza esporre il servizio a chiamate non autorizzate. */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized sync request." }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncTicketTailorIssuedTickets());
  } catch (error) {
    console.error("[ticket-tailor sync] Sync biglietti fallita", error);
    return NextResponse.json({ ok: false, message: "Sincronizzazione biglietti Ticket Tailor non riuscita." }, { status: 500 });
  }
}
