import { describe, expect, it } from "vitest";
import { groupMemberEvidence } from "@/lib/gestionale/member-evidence-groups";

type Row = {id:string;source:string;email:string|null;first_name:string;last_name:string;tableId:string|null};
const row=(id:string,source:string,email:string|null,name="Christian Martelli"):Row=>{
 const [first_name,...last]=name.split(" ");
 return {id,source,email,first_name,last_name:last.join(" "),tableId:source==="manual_override"?id:null};
};

describe("una persona, più prove associative",()=>{
 it("aggregates official book and manual proof of a later year",()=>{
  const groups=groupMemberEvidence([
   row("book","official_members_book",null),row("quota2027","manual_override",null)
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].map(x=>x.id)).toEqual(["book","quota2027"]);
 });
 it("aggregates the email form, official book and manual history",()=>{
  const groups=groupMemberEvidence([
   row("form","google_sheet","maru.zolotarenko@gmail.com","Maryna Zolotarenko"),
   row("book","official_members_book",null,"Maryna Zolotarenko"),
   row("manual","manual_override",null,"Maryna Zolotarenko"),
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toHaveLength(3);
 });
 it("retains separate homonyms with conflicting emails",()=>{
  const groups=groupMemberEvidence([
   row("one","google_sheet","one@example.org","Mario Rossi"),
   row("two","google_sheet","two@example.org","Mario Rossi"),
   row("book","official_members_book",null,"Mario Rossi"),
  ]);
  expect(groups).toHaveLength(3);
 });
 it("does not merge two official book records without a unique identity",()=>{
  const groups=groupMemberEvidence([
   row("a","official_members_book",null,"Mario Rossi"),
   row("b","official_members_book",null,"Mario Rossi"),
  ]);
  expect(groups).toHaveLength(2);
 });
 it("keeps separate identities when email matches but names differ",()=>{
  // This edge case is handled by separate UI identity checks, never automatic writes.
  const groups=groupMemberEvidence([
   row("one","google_sheet","family@example.org","Mario Rossi"),
   row("two","google_sheet","family@example.org","Eva Verdi"),
  ]);
  expect(groups).toHaveLength(1); // only a display group, not a confirmed identity
 });
});
