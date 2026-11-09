import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildUnifiedDirectory, type RegistryEvidence } from "@/lib/gestionale/unified-directory";

const evidence=(id:string,source:string,first:string,last:string,email:string|null):RegistryEvidence=>({
  id,source,first_name:first,last_name:last,email,
  membership_status:"verified",membership_starts_at:"2025-09-01",membership_expires_at:"2026-12-31",
});
const today="2026-11-09";

describe("Persone admin: azioni sulle registrazioni senza scheda",()=>{
  it("propone il collegamento al modulo per email",()=>{
    const rows=buildUnifiedDirectory({people:[],evidence:[
      evidence("form","google_sheet","Elisa","Rossi","elisa@example.test"),
    ],today});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({kind:"registro",memberKey:"e:elisa@example.test"});
  });
  it("propone il collegamento nominale per una tessera del libro ufficiale senza email",()=>{
    const rows=buildUnifiedDirectory({people:[],evidence:[
      evidence("official","official_members_book","Claudia","Armani",null),
    ],today});
    expect(rows[0]).toMatchObject({kind:"registro",memberKey:"n:armani claudia",association:"verificata"});
  });
  it("per una conferma solo manuale usa la chiave della validazione, senza dichiarare il modulo",()=>{
    const id="22222222-2222-4222-8222-222222222222";
    const rows=buildUnifiedDirectory({people:[],evidence:[
      evidence(id,"manual_override","Franceska","Cela",null),
    ],today});
    expect(rows[0]).toMatchObject({kind:"registro",memberKey:`m:${id}`,association:"da_verificare"});
  });
  it("non attribuisce una chiave automaticamente a due persone con email condivisa",()=>{
    const rows=buildUnifiedDirectory({people:[],evidence:[
      evidence("a","google_sheet","Elisa","Rossi","condivisa@example.test"),
      evidence("b","google_sheet","Mario","Bianchi","condivisa@example.test"),
    ],today});
    expect(rows).toHaveLength(2);
    expect(rows.every(x=>x.memberKey===null)).toBe(true);
  });
  it("distingue omonime con due email diverse",()=>{
    const rows=buildUnifiedDirectory({people:[],evidence:[
      evidence("f1","google_sheet","Elisa","Rossi","uno@example.test"),
      evidence("f2","google_sheet","Elisa","Rossi","due@example.test"),
    ],today});
    expect(rows).toHaveLength(2);
    expect(rows.map(x=>x.memberKey).sort()).toEqual(["e:due@example.test","e:uno@example.test"]);
  });
});
describe("Persone admin: interfaccia operativa",()=>{
  const page=readFileSync("src/components/gestionale/UnifiedPeopleDirectory.tsx","utf8");
  const actions=readFileSync("src/components/gestionale/PersonDirectoryActions.tsx","utf8");
  const server=readFileSync("src/app/gestione/(app)/persone/actions.ts","utf8");
  it("elimina l'avviso non operativo e offre azioni alle fonti associative",()=>{
    expect(page).not.toContain("Presente solo nelle fonti associative. Non creare duplicati");
    expect(page).toContain("<RegistryPersonActions");
    expect(actions).toContain("Collega o crea anagrafica");
    expect(actions).toContain("Conferma collegamento");
    expect(actions).toContain("Conferma creazione");
  });
  it("offre modifica, nickname e quota rapida alle persone esistenti",()=>{
    expect(page).toContain("Apri / modifica");
    expect(page).toContain("<InlinePersonNickname");
    expect(page).toContain("<QuickPersonQuota");
  });
  it("controlla duplicati e permessi prima di creare, senza pagamento automatico",()=>{
    expect(server).toContain("await requireAdmin()");
    expect(server).toContain("parseMemberKey(memberKey)");
    expect(server).toContain("Selezione non valida.");
    expect(server).toContain("Esiste già una possibile anagrafica.");
    expect(server).toContain("createPersonWithAliases");
    expect(server).toContain("linkMemberAction");
    expect(server).not.toContain("saveManualValidation");
  });
});
