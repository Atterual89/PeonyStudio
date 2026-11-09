import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {mappedAleRows,suggestAleColumns} from "../ale-billing-mapping";

const read=(p:string)=>readFileSync(p,"utf8");
describe("Denominazione e matching manuale di Alessandra",()=>{
  it("legge l'export fiscale senza dividere nome/cognome",()=>{
    const sheet={headers:["Denominazione","Indirizzo e-mail","Codice Fiscale","Indirizzo"],
      rows:[["Anna S. D'Alessandro","anna@example.test","RSS123","Via Roma"],
        ["Società di Test","admin@example.test","","Corso Italia"]]};
    expect(suggestAleColumns(sheet.headers)).toEqual({name:"0",email:"1"});
    const rows=mappedAleRows(sheet,{name:0,email:1});
    expect(rows).toHaveLength(2);
    expect(rows[0].display_name).toBe("Anna S. D'Alessandro");
    expect(rows[0].fields["Codice Fiscale"]).toBe("RSS123");
    expect(rows[0].source_key).toMatch(/^[a-f0-9]{64}$/);
    expect(mappedAleRows(sheet,{name:0,email:1})[0].source_key).toBe(rows[0].source_key);
  });
  it("mai contatti fiscali abbinati automaticamente per email o nome",()=>{
    const ale=read("src/app/gestione/(app)/anagrafica/ale-actions.ts");
    const legacy=read("src/app/gestione/(app)/anagrafica/billing-actions.ts");
    const admin=read("src/app/gestione/(app)/altro/soci/abbinamenti-ale/actions.ts");
    const panel=read("src/components/gestionale/AdminAleMatchingPanel.tsx");
    const page=read("src/app/gestione/(app)/altro/soci/abbinamenti-ale/page.tsx");
    expect(ale).toContain("await requireOrganizer()");
    expect(ale).toContain('rpc("gw_import_ale_contacts"');
    expect(legacy).toContain("Flusso legacy disabilitato");
    expect(admin).toContain("await requireAdmin()");
    expect(admin).toContain('rpc("gw_admin_match_ale_contact"');
    expect(panel).toContain("Conferma abbinamento");
    expect(panel).toContain("matchAleContactAction({contactId:row.id,personId})");
    expect(page).toContain("await requireAdmin()");
  });
});
