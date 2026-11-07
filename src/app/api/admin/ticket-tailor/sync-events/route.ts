import { NextRequest, NextResponse } from "next/server";
import { syncTicketTailorEvents } from "@/lib/ticket-tailor/sync-events";

export const dynamic = "force-dynamic";

/** Endpoint storico dell'Admin: il vecchio codice admin resta valido. */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.ADMIN_SYNC_SECRET;
  const providedSecret = request.headers.get("x-admin-sync-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized sync request." }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncTicketTailorEvents());
  } catch (error) {
    console.error("[ticket-tailor sync] Sync eventi fallita", error);
    return NextResponse.json({ ok: false, message: "Sincronizzazione eventi Ticket Tailor non riuscita." }, { status: 500 });
  }
}
