import { describe, expect, it } from "vitest";
import { ticketTailorCreatedAt, compareTicketChronology } from "../ticket-order-chronology";
import { readFileSync } from "node:fs";

describe("ordine cronologico dei partecipanti", () => {
  it("ordina per data effettiva di acquisto Ticket Tailor, non per importazione", () => {
    const first=ticketTailorCreatedAt({created_at:"1793109184"});
    const second=ticketTailorCreatedAt({created_at:1793125553});
    expect(first).toBe(1793109184000);
    expect(second).toBe(1793125553000);
    expect(compareTicketChronology({time:second,id:"it2"},{time:first,id:"it1"})).toBeGreaterThan(0);
  });
  it("gestisce ordini ISO, ticket senza ordine e pari orario in modo stabile", () => {
    const first=ticketTailorCreatedAt({created_at:"2026-11-07T10:07:00.000Z"});
    expect(first).toBe(Date.parse("2026-11-07T10:07:00.000Z"));
    expect(ticketTailorCreatedAt({id:"no-date"})).toBeNull();
    expect(compareTicketChronology({time:null,id:"zzz"},{time:first,id:"aaa"})).toBeGreaterThan(0);
    expect(compareTicketChronology({time:first,id:"aa"},{time:first,id:"bb"})).toBeLessThan(0);
  });
  it("l'elenco Peony usa data ordine, poi data emissione biglietto, non ordine alfabetico",()=>{
    const code=readFileSync("src/lib/gestionale/server/peony-events.ts","utf8");
    expect(code).toContain("purchasedAtByOrder");
    expect(code).toContain("compareTicketChronology");
    expect(code).not.toContain('.sort((a, b) => a.name.localeCompare(b.name');
  });
  it("i workshop admin e quelli di Alessandra usano la data di inserimento",()=>{
    const admin=readFileSync("src/components/gestionale/ParticipantsTab.tsx","utf8");
    const data=readFileSync("src/lib/gestionale/server/data.ts","utf8");
    const ale=readFileSync("src/lib/gestionale/server/registrations.ts","utf8");
    expect(admin).toContain('{ key: "data", asc: true }');
    expect(admin).toContain('value="data-asc"');
    expect(admin).toContain('<UnifiedParticipantCard');
    expect(data).toContain("createdAt: booking.created_at");
    expect(data).toContain('.order("created_at", { ascending: true })');
    expect(ale).toContain('.order("created_at", { ascending: true })');
  });
});
