import { isLuxuriaTitle } from "@/lib/gestionale/workshops";

/** Un evento Peony usa solo ticket Ticket Tailor, mai iscrizioni manuali LuXuria. */
export function isPeonyTicketEvent(item: {
  title: string | null;
  source: string | null;
  ticket_tailor_event_id: string | null;
}): boolean {
  return item.source === "ticket_tailor" &&
    Boolean(item.ticket_tailor_event_id?.trim()) &&
    !isLuxuriaTitle(item.title);
}

export function isActivePeonyTicket(status: string | null): boolean {
  if (!status) return true;
  const normalized = status.toLowerCase();
  return !["void", "cancelled", "canceled", "refunded", "deleted", "inactive"].some((blocked) =>
    normalized.includes(blocked),
  );
}
