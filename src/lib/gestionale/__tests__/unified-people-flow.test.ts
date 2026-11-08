import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUnifiedDirectory } from "@/lib/gestionale/unified-directory";

const file=(path:string)=>readFileSync(path,"utf8");

describe("anagrafica unica: ricerca e associazione del nickname",()=>{
  it("mostra nickname non ancora collegato senza attribuirgli automaticamente una socia",()=>{
    const contacts=buildUnifiedDirectory({
      today:"2026-11-08",
      people:[{
        id:"p1",version:3,nickname:"CordaRossa",first_name:null,last_name:null,email:null,
        association_member_id:null,membership_email:null,membership_name_key:null,merged_into:null,
      }],
      evidence:[{
        id:"m1",first_name:"Francesca",last_name:"Rossi",email:null,source:"official_members_book",
        membership_status:"verified",membership_starts_at:"2025-09-01",membership_expires_at:"2026-12-31",
      }]
    });
    expect(contacts).toHaveLength(2);
    expect(contacts.find(c=>c.personId==="p1")).toMatchObject({
      personVersion:3,kind:"anagrafica",link:"nessuno",nickname:"CordaRossa",
    });
    expect(contacts.find(c=>c.kind==="registro")).toMatchObject({
      name:"Francesca Rossi",personId:null,
    });
  });

  it("trova anche un nickname storico scritto nell'iscrizione, senza usarlo come prova associativa",()=>{
    const contacts=buildUnifiedDirectory({
      today:"2026-11-08",
      people:[{
        id:"p2",version:4,nickname:"NuovoNome",first_name:null,last_name:null,email:null,
        association_member_id:null,membership_email:null,membership_name_key:null,merged_into:null,
      }],
      evidence:[],
      aliasesByPerson:new Map([["p2",["VecchioNickname","AltraGrafia"]]]),
    });
    expect(contacts[0].search).toContain("VecchioNickname");
    expect(contacts[0].search).toContain("AltraGrafia");
    expect(contacts[0].link).toBe("nessuno");
    const loader=file("src/lib/gestionale/server/unified-directory.ts");
    expect(loader).toContain('"gw_booking_participants"');
    expect(loader).toContain('"gw_person_aliases"');
  });

  it("Persone usa un solo elenco, senza interrogare eventi e più annualità",()=>{
    const page=file("src/app/gestione/(app)/persone/page.tsx");
    expect(page).toContain("await requireAdmin()");
    expect(page).toContain("loadUnifiedDirectory(today)");
    expect(page).toContain("<UnifiedPeopleDirectory");
    expect(page).not.toContain("loadUpcomingPeonyPeople");
    expect(page).not.toContain("loadUpcomingLuxuriaPeople");
    expect(page).not.toContain("loadSociReviewData");
    expect(page).toContain('association: "non_disponibile"');
  });

  it("il nickname conduce alla ricerca indipendente della socia nella stessa schermata",()=>{
    const directory=file("src/components/gestionale/UnifiedPeopleDirectory.tsx");
    const inline=file("src/components/gestionale/MemberQuickLink.tsx");
    const book=file("src/app/gestione/(app)/altro/soci/page.tsx");
    expect(directory).toContain("MemberQuickLink");
    expect(directory).toContain("initialQuery");
    expect(inline).toContain("memberSearchAction(query.trim())");
    expect(inline).toContain("linkMemberAction");
    expect(inline).toContain("Conferma collegamento");
    expect(inline).toContain("La quota associativa non è stata modificata");
    expect(book).toContain("Cerca e collega persone");
    expect(book).not.toContain("<MemberDirectorySearch");
  });

  it("il server controlla le associazioni duplicate prima di scrivere",()=>{
    const actions=file("src/app/gestione/(app)/w/actions.ts");
    expect(actions).toContain("const conflict = await getGestionaleDb()");
    expect(actions).toContain('neq("id", input.personId)');
    expect(actions).toContain("Questa socia è già collegata a un'altra anagrafica");
    expect(actions.indexOf("const conflict = await getGestionaleDb()"))
      .toBeLessThan(actions.indexOf("const result = await linkPersonToMember(operator.id, input.personId, input.version, input.memberId);"));
  });
});
