import { describe, expect, it } from "vitest";

import { isActivePeonyTicket, isPeonyTicketEvent } from "@/lib/gestionale/peony-ticket-rules";

describe("sorgenti eventi del gestionale unificato", () => {
  it("mostra i biglietti solo per eventi Peony Ticket Tailor", () => {
    expect(isPeonyTicketEvent({ title: "Rope Jam", source: "ticket_tailor", ticket_tailor_event_id: "abc" })).toBe(true);
    expect(isPeonyTicketEvent({ title: "Kinbaku LuXuria Level 1", source: "ticket_tailor", ticket_tailor_event_id: "abc" })).toBe(false);
    expect(isPeonyTicketEvent({ title: "Kinbaku Luxuria - Shadow", source: "ticket_tailor", ticket_tailor_event_id: "abc" })).toBe(false);
    expect(isPeonyTicketEvent({ title: "Rope Jam", source: "manual", ticket_tailor_event_id: "abc" })).toBe(false);
    expect(isPeonyTicketEvent({ title: "Rope Jam", source: "ticket_tailor", ticket_tailor_event_id: null })).toBe(false);
  });

  it("non include biglietti annullati, rimborsati o disattivati", () => {
    expect(isActivePeonyTicket(null)).toBe(true);
    expect(isActivePeonyTicket("valid")).toBe(true);
    expect(isActivePeonyTicket("CANCELLED")).toBe(false);
    expect(isActivePeonyTicket("refunded")).toBe(false);
    expect(isActivePeonyTicket("void")).toBe(false);
    expect(isActivePeonyTicket("inactive")).toBe(false);
  });
});
