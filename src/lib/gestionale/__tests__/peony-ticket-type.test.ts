import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ticketTypeNamesFromEventPayload,
  ticketTypeNameForIssuedTicket,
  peonyTicketRole,
} from "@/lib/gestionale/peony-ticket-type";

const ropeJamEvent={ticket_tailor_original:{ticket_types:[
  {id:"tt_6713302",name:"NON associati (biglietto a persona)"},
  {id:"tt_6713303",name:"Associati (biglietto a persona)"},
  {id:"tt_6713304",name:"Biglietto per osservare e conoscere - 6€ pagamento in sede"},
  {id:"tt_6713305",name:"Possessori Peony Card (GOLD, SILVER, BRONZE)"},
]}};

describe("Rope Jam: tipo biglietto originale, non email o nickname",()=>{
  const names=ticketTypeNamesFromEventPayload(ropeJamEvent);
  it("recupera il nome da ticket_type_id che gli ordini Ticket Tailor restituiscono",()=>{
    const observer=ticketTypeNameForIssuedTicket({ticket_type_id:"tt_6713304"},names);
    expect(observer).toContain("osservare");
    expect(peonyTicketRole(observer)).toBe("observer");
    expect(peonyTicketRole(ticketTypeNameForIssuedTicket({ticket_type_id:"tt_6713303"},names))).toBe("practitioner");
    expect(peonyTicketRole(ticketTypeNameForIssuedTicket({ticket_type_id:"tt_6713302"},names))).toBe("practitioner");
    expect(peonyTicketRole(ticketTypeNameForIssuedTicket({ticket_type_id:"tt_6713305"},names))).toBe("practitioner");
  });
  it("non assume che un biglietto privo di tipo sia praticante o observer",()=>{
    expect(peonyTicketRole(null)).toBe("unknown");
    expect(peonyTicketRole("Biglietto Ticket Tailor")).toBe("unknown");
    expect(ticketTypeNameForIssuedTicket({ticket_type_id:"tt_unknown"},names)).toBeNull();
  });
  it("riconosce tutte le varianti Observer e osservatori",()=>{
    for(const name of ["Observer", "Osservatore", "Osservatrice", "Biglietto per osservare e conoscere", "Spectator"]){
      expect(peonyTicketRole(name)).toBe("observer");
    }
  });
  it("preserva il nome esplicito se Ticket Tailor lo ha già incluso",()=>{
    expect(ticketTypeNameForIssuedTicket({ticket_type_id:"tt_6713304"},names,"Nome specifico")).toBe("Nome specifico");
  });
  it("funziona anche con un evento non avvolto nella proprietà ticket_tailor_original",()=>{
    const names=ticketTypeNamesFromEventPayload(ropeJamEvent.ticket_tailor_original);
    expect(names.get("tt_6713304")).toContain("osservare");
  });
});

describe("roster e sincronizzazione",()=>{
  const roster=readFileSync("src/lib/gestionale/server/peony-events.ts","utf8");
  const sync=readFileSync("src/lib/ticket-tailor/sync-issued-tickets.ts","utf8");
  const ui=readFileSync("src/components/gestionale/PeonyEventOperations.tsx","utf8");
  const sql=readFileSync("supabase/migrations/037_gw_backfill_ticket_type_names.sql","utf8");
  it("legge la categoria anche prima di rieseguire la sincronizzazione",()=>{
    expect(roster).toContain('select("raw_payload").eq("id",event.id)');
    expect(roster).toContain("ticketTypeNameForIssuedTicket(ticket.raw_payload,ticketNames,ticket.ticket_type_name)");
    expect(roster).toContain('associationRequired: membershipRequired');
    expect(roster).toContain('association: membershipRequired ? associationStatus');
  });
  it("mostra il ruolo e filtra gli observer senza entrare nella verifica quote",()=>{
    expect(ui).toContain("Praticanti ({practitioners})");
    expect(ui).toContain("Observer ({observers})");
    expect(ui).toContain("Tessera associativa non richiesta");
    expect(ui).toContain("Tipo da identificare");
  });
  it("non perde il tipo già sincronizzato per un ordine incompleto",()=>{
    expect(sync).toContain("ticketTypeNamesFromEventPayload(event.raw_payload)");
    expect(sync).toContain("ticketTypeNameForIssuedTicket(ticket,");
    expect(sync).toContain("row.ticket_type_name=previous.get");
  });
  it("l'aggiornamento dello storico modifica solo il nome del tipo mancante",()=>{
    expect(sql).toContain("set ticket_type_name=resolved.ticket_name");
    expect(sql).toContain("nullif(btrim(coalesce(t.ticket_type_name,'')),'') is null");
    expect(sql).not.toContain("delete from");
  });
});
