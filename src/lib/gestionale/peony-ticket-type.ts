/** Ticket Tailor: issued tickets expose a ticket_type_id, not its display
 * name. The event payload carries the ticket_types catalogue. This module
 * resolves the foreign key without inventing a ticket role from the price or
 * an attendee's name.
 */
type JsonRecord = Record<string,unknown>;
const object=(value:unknown):JsonRecord|null=>
  Boolean(value)&&typeof value==="object"&&!Array.isArray(value)
    ? value as JsonRecord : null;
const nonEmpty=(value:unknown):string|null=>
  typeof value==="string"&&value.trim()?value.trim():null;

export function ticketTypeNamesFromEventPayload(raw:unknown):Map<string,string>{
  const envelope=object(raw);
  const event=object(envelope?.ticket_tailor_original)??envelope;
  const types=event?.ticket_types;
  const result=new Map<string,string>();
  if(!Array.isArray(types))return result;
  for(const item of types){
    const type=object(item);
    const id=nonEmpty(type?.id);
    const name=nonEmpty(type?.name);
    if(id&&name)result.set(id,name);
  }
  return result;
}

export function ticketTypeNameForIssuedTicket(
  issued:unknown,
  types:ReadonlyMap<string,string>,
  storedName:string|null=null,
):string|null{
  const ticket=object(issued);
  const explicit=nonEmpty(storedName)??nonEmpty(ticket?.ticket_type_name)
    ??nonEmpty(object(ticket?.ticket_type)?.name);
  if(explicit&&!/^biglietto ticket tailor$/i.test(explicit))return explicit;

  const id=nonEmpty(ticket?.ticket_type_id)
    ??nonEmpty(object(ticket?.ticket_type)?.id)
    ??nonEmpty(ticket?.ticket_type);
  if(id&&types.has(id))return types.get(id)??null;
  // Never display a bare "tt_123" ticket type ID as a label.
  const generic=nonEmpty(ticket?.ticket_type);
  return generic&&!/^tt_[0-9]+$/i.test(generic)?generic:explicit;
}

export type PeonyTicketRole="observer"|"practitioner"|"unknown";

export function peonyTicketRole(name:string|null|undefined):PeonyTicketRole{
  const ticket=(name??"").trim().normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(!ticket||ticket==="biglietto ticket tailor")return "unknown";
  // The actual Italian Rope Jam category is "Biglietto per osservare e
  // conoscere", not "Observer" or "Osservatore".
  if(/observer|osserva|spectator/.test(ticket))return "observer";
  return "practitioner";
}
