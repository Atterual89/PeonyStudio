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

/** Aperi-Bottom Free e' aperto anche a non soci. La categoria dell'evento
 * prevale sul tipo di biglietto ai soli fini dell'obbligo di tessera.
 * Non altera i record associativi e non identifica gli ospiti come observer
 * su Ticket Tailor: applica soltanto la stessa esenzione.
 */
export function isMembershipFreePeonyEvent(title:string|null|undefined):boolean{
  const normalized=(title??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[-_]+/g," ").replace(/\s+/g," ").trim();
  return /\baperi\s*bottom\b/.test(normalized)&&/\bfree\b/.test(normalized);
}
