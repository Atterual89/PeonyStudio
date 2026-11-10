import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildUnifiedDirectory } from "@/lib/gestionale/unified-directory";

describe("Persone: quota confermata ma modulo da verificare", () => {
  it("una quota manuale valida e una scheda già collegata non sono un nuovo profilo", () => {
    const contacts=buildUnifiedDirectory({
      today:"2026-11-10",
      people:[{
        id:"persona-1",first_name:"Lia",last_name:"Esempio",
        nickname:null,email:"lia@example.test",membership_email:"lia@example.test",
        membership_name_key:null,association_member_id:null,merged_into:null,version:1,
      }],
      evidence:[{
        id:"quota-1",first_name:"Lia",last_name:"Esempio",
        email:"lia@example.test",source:"manual_override",membership_status:"verified",
        membership_starts_at:"2026-09-01",membership_expires_at:"2027-12-31",
      }],
    });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      kind:"unita",personId:"persona-1",link:"confermato",
      association:"da_verificare",
    });
  });

  it("indica chiaramente quota già pagata e modulo mancante, non un nuovo versamento", () => {
    const dot=readFileSync("src/components/gestionale/AssociationStatusDot.tsx","utf8");
    const directory=readFileSync("src/components/gestionale/UnifiedPeopleDirectory.tsx","utf8");
    expect(dot).toContain('form_to_verify:{label:"Quota OK · modulo associativo da verificare"');
    expect(directory).toContain('da_verificare:"form_to_verify"');
    expect(directory).toContain("<strong>Quota OK.</strong>");
    expect(directory).toContain("non serve confermare di nuovo il pagamento");
  });

  it("la pagina Verifiche non attende il libro soci per mostrare i comandi", () => {
    const page=readFileSync("src/app/gestione/(app)/altro/soci/page.tsx","utf8");
    expect(page).toContain("<Suspense");
    expect(page).toContain("<SyncOfficialBookButton/>");
    expect(page).toContain("<SyncSociButton/>");
    expect(page.indexOf("<SyncOfficialBookButton/>")).toBeLessThan(page.indexOf("<AssociationMailSyncControl/>"));
    expect(page).not.toContain('await Promise.all([\n  findMemberLinkProposals()');
    const loading=readFileSync("src/app/gestione/(app)/altro/soci/loading.tsx","utf8");
    expect(loading).not.toContain("Lettura del libro soci…");
  });
});
