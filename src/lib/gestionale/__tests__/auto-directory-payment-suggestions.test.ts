import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {paymentNameMatch,proposePeopleForPayment,type AutoPaymentCandidate} from "@/lib/gestionale/payment-auto-proposals";

const person=(id:string,name:string,email:string):AutoPaymentCandidate=>({
  kind:"person",id,name,email,source:"Anagrafica",
});
const form=(id:string,name:string,email:string):AutoPaymentCandidate=>({
  kind:"member",id,name,email,source:"Modulo Google",
});

describe("quote email: suggerimenti dai moduli e divisione in due",()=>{
 it("trova Cristian dai moduli anche se non esiste ancora la scheda persona",()=>{
  expect(proposePeopleForPayment("Dario Colonna",[],[
    form("e:dario@example.test","Dario Colonna","dario@example.test")
  ])).toMatchObject([{kind:"member",name:"Dario Colonna"}]);
 });
 it("propone Ana Ruiz nonostante il secondo cognome nel bonifico",()=>{
  expect(paymentNameMatch("Ana Lopez Ruiz","Ruiz Ana")).toBe(80);
  expect(proposePeopleForPayment("Ana Lopez Ruiz",[
    person("p1","Ruiz Ana","ana@example.test"),
  ],[
    form("e:ana@example.test","Ruiz Ana","ana@example.test"),
  ])).toMatchObject([{kind:"person",id:"p1"}]);
 });
 it("non suggerisce una persona per la sola email o un cognome comune",()=>{
  expect(paymentNameMatch("Rossi","Mario Rossi")).toBe(0);
  expect(proposePeopleForPayment("Marco Bianchi",[person("p1","Maria Rossi","maria@example.test")],[])).toEqual([]);
 });
 it("la pagina segnala due quote distinte, conserva le assegnazioni e richiede beneficiari diversi",()=>{
  const ui=readFileSync("src/components/gestionale/PaymentEmailReview.tsx","utf8");
  const action=readFileSync("src/app/gestione/(app)/quote-email/actions.ts","utf8");
  expect(ui).toContain("Quota ${used+1} di ${p.availableSlots}");
  expect(ui).toContain("Corrispondenze suggerite dalla causale");
  expect(ui).toContain("La prima quota è già attribuita");
  expect(ui).toContain("activeAssigned.map");
  expect(ui).toContain("p.assigned.filter(item=>!(removed[p.id]??[]).includes(item.id))");
  expect(action).toContain("Le due quote devono essere assegnate a persone diverse.");
 });
 it("la vista Alessandra carica solo i suoi workshop prima dei partecipanti",()=>{
  const page=readFileSync("src/app/gestione/(app)/anagrafica/page.tsx","utf8");
  expect(page).toContain("await requireOrganizer()");
  expect(page).toContain('.eq("created_by",organizer.id)');
  expect(page).toContain('.in("workshop_id",allowedWorkshops)');
  expect(page).not.toContain("loadUnifiedDirectory");
  const update=readFileSync("src/app/gestione/(app)/anagrafica/actions.ts","utf8");
  expect(update).toContain('.eq("created_by",operator.id)');
  expect(update).toContain('allowed.has(booking.workshop_id)');
  expect(update).toContain('if (!permitted) return');
  const admin=readFileSync("src/app/gestione/(app)/persone/page.tsx","utf8");
  expect(admin).toContain("await requireAdmin()");
 });
});
