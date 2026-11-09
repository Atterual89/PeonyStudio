import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
const source=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
const lookup=source("src/lib/gestionale/server/membership.ts");
const actions=source("src/app/gestione/(app)/w/actions.ts");
const ui=source("src/components/gestionale/MemberLinker.tsx");
const booking=source("src/components/gestionale/BookingDetails.tsx");
describe("Ricerca completa anagrafica e associazioni",()=>{
  it("cerca anche socio già collegato, senza cambiare i percorsi di creazione nuovi",()=>{
    expect(lookup).toContain("includeLinked?:boolean");
    expect(lookup).toContain("if(!options.includeLinked&&alreadyLinked)continue;");
    expect(lookup).toContain("memberLookupScore(query");
    expect(actions).toContain("includeLinked:true");
    expect(actions).toContain("searchPeople(people,text,12)");
    expect(ui).toContain("Persone già nell'anagrafica");
    expect(ui).toContain("Trovata anche come");
  });
  it("trova anche il libro ufficiale con nome abbreviato se il modulo include un secondo nome",()=>{
    expect(actions).toContain("const considerSurname=");
    expect(actions).toContain("await searchMembers(lastToken,25,referenceDate,{includeLinked:true})");
    expect(actions).toContain("const compatible=extra.filter");
    expect(actions).toContain("surname.some(part=>part.startsWith(normalizedLast))");
    expect(actions).toContain("new Map([...members,...compatible]");
    // Proporre un candidato non equivale ad associarlo alla persona.
    expect(actions.indexOf("const bookResults=")).toBeLessThan(actions.indexOf("const found=searchPeople(people,text,12);"));
  });
  it("il modulo Google può completare l'email senza eliminare il link al libro ufficiale",()=>{
    expect(actions).toContain("attachMemberFormEmailAction");
    expect(actions).toContain("if(!person||person.merged_into||!person.membership_name_key)");
    expect(actions).toContain("compatibleFormName");
    expect(actions).toContain("existing.data?.length");
    expect(actions).toContain("...personFieldsOf(person),email:member.email");
    expect(lookup).toContain("email:person.email??selected[0].email");
  });
  it("la ricerca e il cambio abbinamento sono disponibili anche con quota OK",()=>{
    expect(booking).toContain("Cambia abbinamento");
    expect(booking).toContain("Cerca nel libro soci");
    expect(ui).toContain("linkMemberAction");
    expect(ui).toContain("Cambia abbinamento:");
  });
});
