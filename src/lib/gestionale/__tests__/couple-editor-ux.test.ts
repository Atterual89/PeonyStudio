import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const file=(path:string)=>readFileSync(path,"utf8");

describe("Workshop · coppie",()=>{
 it("Ale vede intestatario e partner come due schede modificabili",()=>{
  const row=file("src/components/gestionale/EnteredEmails.tsx");
  expect(row).toContain('entry.isPrimary?"1 · Intestatario":"2 · Partner"');
  expect(row).toContain("Modifica dati");
  expect(row).toContain("Nome o nickname usato per il workshop");
  expect(row).toContain("updateEnteredParticipantAction");
  expect(row).toContain("people.map(entry=>");
  expect(row).toContain("Questi dati sono quelli dell'iscrizione");
 });
 it("la scheda coppia è prima dei dati economici; la quota resta della coppia",()=>{
  const row=file("src/components/gestionale/RegistrationsTab.tsx");
  const details=row.slice(row.indexOf("function RegistrationDetails"),row.indexOf("export function RegistrationsTab"));
  const a=details.indexOf("<EnteredEmails");
  const b=details.indexOf("<FeeEditor");
  expect(a).toBeGreaterThan(-1);
  expect(a).toBeLessThan(b);
  expect(details).toContain("Iscrizione · quota e pagamenti");
  expect(details.match(/<EnteredEmails/g)).toHaveLength(1);
 });
 it("admin vede cambia partner accanto al secondo partecipante",()=>{
  const row=file("src/components/gestionale/BookingDetails.tsx");
  expect(row).toContain('"2 · Partner"');
  expect(row).toContain("onChangePartner");
  expect(row).toContain("Cambia partner");
 });
 it("il server richiede il ruolo di organizzatrice e conserva le modifiche con audit",()=>{
  const actions=file("src/app/gestione/(app)/w/registration-actions.ts");
  const sql=file("supabase/migrations/036_gw_update_entered_participant.sql");
  expect(actions).toContain("export async function updateEnteredParticipantAction");
  expect(actions).toContain("await requireOrganizer()");
  expect(sql).toContain("gw_update_entered_participant");
  expect(sql).toContain("role::text='organizzatrice'");
  expect(sql).toContain("gw_audit");
  expect(sql).toContain("from public,anon,authenticated");
 });
});
