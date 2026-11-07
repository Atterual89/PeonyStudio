import { describe, expect, it } from "vitest";
import { partnerFromCheckout, peonyPartnerRequired } from "../peony-partner";
describe("partner indicato nell'ordine Ticket Tailor", () => {
  it("legge nome e cognome dalla domanda, non dalla risposta al consenso", () => {
    const input = { buyer_details: { custom_questions: [
      {question:"Sei consapevole che è necessario iscriversi in coppia?",answer:"Sì"},
      {question:"Nome e cognome o indirizzo email della persona con cui verrai", answer:"Mattia Colombrita"},
    ] } };
    expect(partnerFromCheckout(input)).toEqual({name:"Mattia Colombrita",email:null,source:"ticket_tailor"});
  });
  it("esclude risposte vaghe e riconosce email", () => {
    expect(partnerFromCheckout({buyer_details:{custom_questions:[{question:"Persona con cui verrai",answer:"partner"}]}})).toBeNull();
    expect(partnerFromCheckout({buyer_details:{custom_questions:[{question:"Persona con cui verrai",answer:"a@example.com"}]}})?.email).toBe("a@example.com");
  });
  it("non richiede il partner alle Rope Jam e agli observer", () => {
    expect(peonyPartnerRequired("Foundation Lv.2","Biglietto corso")).toBe(true);
    expect(peonyPartnerRequired("Foundation Lv.2","Observer")).toBe(false);
    expect(peonyPartnerRequired("Rope Jam",null)).toBe(false);
  });
});
