import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
const file=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");

describe("pulsante Gmail condiviso dove si controllano le quote",()=>{
  it("usa lo stesso controllo su home, eventi Peony, workshop e libro soci",()=>{
    for(const p of [
      "src/app/gestione/(app)/page.tsx",
      "src/app/gestione/(app)/peony/[id]/page.tsx",
      "src/app/gestione/(app)/w/[id]/page.tsx",
      "src/app/gestione/(app)/altro/soci/page.tsx",
    ]) expect(file(p),p).toContain("<AssociationMailSyncControl");
  });
  it("non sincronizza mai Gmail dal ruolo organizzatrice",()=>{
    const control=file("src/components/gestionale/AssociationMailSyncControl.tsx");
    expect(control).toContain("await requireAdmin()");
    expect(control).toContain("gmailConnectionStatus()");
  });
  it("non chiede date e segnala come controllare gli abbinamenti",()=>{
    const button=file("src/components/gestionale/SyncAssociationMailButton.tsx");
    expect(button).toContain("syncAssociationMailAction()");
    expect(button).toContain("/gestione/altro/soci?quote=1#quote-email");
    expect(button).not.toContain("type=\"date\"");
  });
});
