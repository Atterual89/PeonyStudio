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
  expect(proposePeopleForPayment("Cristian Pintea",[],[
    form("e:cristian@example.test","Cristian Pintea","cristian@example.test")
  ])).toMatchObject([{kind:"member",name:"Cristian Pintea"}]);
 });
 it("propone Raquel Camí nonostante il secondo cognome nel bonifico",()=>{
  expect(paymentNameMatch("Raquel Paredes Cami","Camí Raquel")).toBe(80);
  expect(proposePeopleForPayment("Raquel Paredes Cami",[
    person("p1","Camí Raquel","raquel@example.test"),
  ],[
    form("e:raquel@example.test","Camí Raquel","raquel@example.test"),
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
  expect(ui).toContain("persone proposte automaticamente".replace("persone","Persone"));
  expect(ui).toContain("La prima quota è già attribuita");
  expect(ui).toContain("p.assigned.map");
  expect(action).toContain("Le due quote devono essere assegnate a persone diverse.");
 });
 it("la vista Alessandra carica solo i suoi workshop prima dei partecipanti",()=>{
  const page=readFileSync("src/app/gestione/(app)/anagrafica/page.tsx","utf8");
  expect(page).toContain("await requireOrganizer()");
  expect(page).toContain('.eq("created_by",organizer.id)');
  expect(page).toContain('.in("workshop_id",allowedWorkshops)');
  expect(page).not.toContain("loadUnifiedDirectory");
  const admin=readFileSync("src/app/gestione/(app)/persone/page.tsx","utf8");
  expect(admin).toContain("await requireAdmin()");
 });
});
