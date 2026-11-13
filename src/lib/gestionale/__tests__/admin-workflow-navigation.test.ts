import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page=(name:string)=>readFileSync(name,"utf8");
const root="src/app/gestione/(app)";
const nav=page("src/components/gestionale/GestioneNav.tsx");
const home=page(`${root}/page.tsx`);
const peony=page(`${root}/peony/[id]/page.tsx`);
const workshop=page(`${root}/w/[id]/page.tsx`);
const person=page(`${root}/p/[id]/page.tsx`);
const soci=page(`${root}/altro/soci/page.tsx`);
const participants=page("src/components/gestionale/ParticipantsTab.tsx");
const formerSearch=page(`${root}/cerca/page.tsx`);

describe("flusso admin compatto - Eventi, Persone, Verifiche",()=>{
 it("la navigazione admin porta direttamente alle verifiche, con differenza di ruolo",()=>{
  expect(nav).toContain('href: "/gestione/altro/soci", label: "Verifiche"');
  expect(nav).toContain('role === "admin"');
  expect(nav).toContain('role === "organizzatrice"');
  expect(nav).toContain('prefetch={false}');
 });
 it("l'admin aggiorna le fonti associative soltanto nella schermata Verifiche",()=>{
  expect(soci).toContain("<AssociationMailSyncControl");
  expect(soci).toContain("<UpdateAllSourcesButton");
  expect(soci).toContain("<PaymentEmailReview");
  expect(soci).toContain("<MemberLinkReview");
  expect(home).not.toContain("<AssociationMailSyncControl");
  expect(peony).not.toContain("<AssociationMailSyncControl");
  expect(workshop).not.toContain("<AssociationMailSyncControl");
  expect(person).not.toContain("<AssociationMailSyncControl");
 });
 it("l'aggiornamento Ticket Tailor resta accessibile dall'evento",()=>{
  expect(peony).toContain("<SyncTicketTailorButton");
  expect(home).toContain("<SyncTicketTailorButton");
 });
 it("non ripete riepiloghi e refresh sopra le liste che gia' contengono i loro stati",()=>{
  expect(workshop).not.toContain('>Da verificare</h2>');
  expect(workshop).not.toContain("Allinea libro soci");
  expect(participants).toContain("<AssociationDotLegend");
  expect(participants).not.toContain("<RefreshMembershipButton");
  expect(person).not.toContain("<RefreshMembershipButton");
  expect(person).not.toContain('aria-label="Stato tessera per periodo"');
 });
 it("una sola pagina di ricerca e azioni anagrafiche",()=>{
  expect(formerSearch).toContain('redirect(query?');
  expect(formerSearch).toContain("/gestione/persone");
  expect(formerSearch).toContain("await requireAdmin()");
  expect(soci).toContain("Apri anagrafiche");
 });
 it("le fonti ufficiali non vengono presentate erroneamente come quota manuale",()=>{
  const member=page("src/components/gestionale/MemberLinker.tsx");
  expect(member).toContain('member.source==="libro"?"Libro soci"');
 });
});
