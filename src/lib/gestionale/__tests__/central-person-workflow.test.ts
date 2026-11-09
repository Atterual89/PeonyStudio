import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
const read=(path:string)=>readFileSync(path,"utf8");
const peony=read("src/components/gestionale/PeonyEventOperations.tsx");
const kl=read("src/components/gestionale/ParticipantsTab.tsx");
const registry=read("src/components/gestionale/UnifiedPeopleDirectory.tsx");
const resolver=read("src/lib/gestionale/server/peony-events.ts");
const actions=read("src/app/gestione/(app)/peony/actions.ts");
const card=read("src/components/gestionale/UnifiedParticipantCard.tsx");

describe("Ticket Tailor -> Anagrafica <- Kinbaku LuXuria",()=>{
 it("gli eventi usano la stessa scheda espandibile e i controlli propri rimangono",()=>{
  expect(peony).toContain("<UnifiedParticipantCard");
  expect(kl).toContain("<UnifiedParticipantCard");
  expect(card).toContain("aria-expanded={expanded}");
  expect(peony).toContain("<PeonyPartnerFinder");
  expect(peony).toContain("<QuotaOkCheckbox");
  expect(kl).toContain("<BookingDetails");
  expect(peony).toContain("<UnifiedPersonPanel");
  expect(read("src/components/gestionale/BookingDetails.tsx")).toContain("<UnifiedPersonPanel");
  expect(kl).toContain("<PresentToggle");
  expect(kl).toContain("rowMenu(booking)");
 });
 it("il nome originale di Ticket Tailor rimane separato dal profilo ufficiale",()=>{
  expect(resolver).toContain("resolveCentralPerson");
  expect(resolver).toContain("enteredName:ticketName");
  expect(resolver).toContain("enteredName:chosen.name");
  expect(resolver).toContain("name:partnerDisplay.name");
  expect(resolver).toContain("profileAlias:holderDisplay.alias");
  expect(resolver).toContain("profileEmail:person?.email??null");
  expect(resolver).toContain("linkedPersonId:resolved?.personId??null");
  expect(peony).toContain("Nome nel biglietto:");
 });
 it("una scelta esplicita nel registro associa anche gw_people solo se univoco",()=>{
  expect(actions).toContain("resolveCentralPerson({people:directory!.people");
  expect(actions).toContain("personId=resolved?.personId??null");
  expect(actions).toContain("member_row_id:memberId");
 });
 it("anagrafiche separate dalle registrazioni non collegate, senza perdere la ricerca",()=>{
  expect(registry).toContain('view==="people"?Boolean(contact.personId)');
  expect(registry).toContain('view==="review"?isReview(contact)');
  expect(registry).toContain('contact.kind==="registro"');
  expect(registry).toContain("Altri filtri");
  expect(registry).toContain("<RegistryPersonActions");
  expect(registry).toContain("<MemberQuickLink");
 });
 it("la scheda persona raccoglie lo storico KL e Peony con accesso diretto al biglietto",()=>{
  const page=read("src/app/gestione/(app)/p/[id]/page.tsx");
  const loader=read("src/lib/gestionale/server/peony-person-history.ts");
  const route=read("src/app/gestione/(app)/peony/[id]/page.tsx");
  expect(page).toContain("loadPeonyPersonHistory(person,people)");
  expect(page).toContain("Partecipazioni Peony e Kinbaku LuXuria");
  expect(loader).toContain("resolveCentralPerson");
  expect(loader).toContain("?ticket=");
  expect(route).toContain("initialTicketId={initialTicketId}");
  expect(peony).toContain("initialExpanded={person.ticketId===initialTicketId}");
 });
 it("Persone offre la revisione diretta degli abbinamenti Peony senza persona canonica",()=>{
  const loader=read("src/lib/gestionale/server/peony-person-history.ts");
  const page=read("src/app/gestione/(app)/persone/page.tsx");
  expect(loader).toContain("loadPendingPeonyLinks");
  expect(loader).toContain('.is("person_id",null).not("member_row_id","is",null)');
  expect(page).toContain("Da collegare · {pendingPeony.length}");
  expect(page).toContain("loadPendingPeonyLinks().catch");
 });
 it("Peony e la ricerca fatture di Alessandra cercano alias senza esporre altre schede",()=>{
  const peony=read("src/app/gestione/(app)/peony/actions.ts");
  const billing=read("src/app/gestione/(app)/anagrafica/billing-actions.ts");
  expect(peony).toContain('from("gw_person_aliases")');
  expect(billing).toContain('from("gw_person_aliases")');
  expect(billing).toContain('const people=await billingRows(operatorId)');
  expect(billing).toContain('.eq("owner_operator_id",operatorId)');
  expect(billing).toContain("p.nickname");
 });
 it("le quote associative non sono le rate dei workshop",()=>{
  expect(peony).toContain("peonyStatus");
  expect(kl).toContain("MembershipBadge");
  expect(kl).toContain("StatusTag");
 });
});
