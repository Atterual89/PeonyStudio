import { describe, expect, it } from "vitest";
import { buildUnifiedDirectory, type RegistryEvidence } from "@/lib/gestionale/unified-directory";

const person=(id:string,first_name:string,last_name:string,email:string|null)=>({
  id,first_name,last_name,email,nickname:null,association_member_id:null,membership_email:null,
  membership_name_key:null,merged_into:null,
});
const evidence=(id:string,source:RegistryEvidence["source"],first_name:string,last_name:string,email:string|null,
  additional:Partial<RegistryEvidence>={}):RegistryEvidence=>({
  id,source,first_name,last_name,email,membership_status:"verified",membership_starts_at:"2025-09-01",
  membership_expires_at:"2026-12-31",...additional,
});
const today="2026-11-08";
describe("registro unico: modulo Google e quota email/manuale",()=>{
  it("scheda collegata al modulo ma quota non pagata",()=>{
    const contacts=buildUnifiedDirectory({today,people:[person("a","Maryna","Zolotarenko","maru@example.test")],
      evidence:[evidence("f","google_sheet","Maryna","Zolotarenko","maru@example.test")]});
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({personId:"a",kind:"unita",association:"solo_modulo",link:"email"});
    expect(contacts[0].source).toContain("Modulo Google");
  });
  it("modulo e quota manuale verificata: stato valido",()=>{
    const contacts=buildUnifiedDirectory({today,people:[person("a","Maryna","Zolotarenko","maru@example.test")],
      evidence:[evidence("f","google_sheet","Maryna","Zolotarenko","maru@example.test"),
       evidence("m","manual_override","Maryna","Zolotarenko","maru@example.test")]});
    expect(contacts).toHaveLength(1);
    expect(contacts[0].association).toBe("verificata");
  });
  it("quota manuale senza modulo non è una registrazione",()=>{
    const contacts=buildUnifiedDirectory({today,people:[person("a","Iris","Rosa","iris@example.test")],
      evidence:[evidence("m","manual_override","Iris","Rosa","iris@example.test")]});
    expect(contacts).toHaveLength(1);
    expect(contacts[0].association).toBe("da_verificare");
    expect(contacts[0].source).toContain("Verifica manuale");
  });
  it("due omonime con email diverse non vengono abbinate",()=>{
    const contacts=buildUnifiedDirectory({today,people:[],evidence:[
      evidence("one","google_sheet","Giulia","Rossi","uno@example.test"),
      evidence("two","google_sheet","Giulia","Rossi","due@example.test"),
    ]});
    expect(contacts).toHaveLength(2);
  });
  it("persone con email uguale e nome incompatibile non vengono fuse",()=>{
    const contacts=buildUnifiedDirectory({today,people:[person("a","Barbara","Hochstrasser","ba@example.test")],
      evidence:[evidence("f","google_sheet","Eva","Müller","ba@example.test")]});
    expect(contacts).toHaveLength(2);
    expect(contacts.find(c=>c.personId==="a")?.kind).toBe("anagrafica");
  });
  it("trova moduli senza email con collegamento nominale da confermare",()=>{
    const contacts=buildUnifiedDirectory({today,people:[person("a","Gaia","Baietti",null)],
      evidence:[evidence("f","google_sheet","Gaia","Baietti",null)]});
    expect(contacts).toHaveLength(2);
    expect(contacts.find(c=>c.kind==="registro")).toMatchObject({possiblePersonId:"a",link:"da_verificare"});
  });
  it("rinnovo 2027 non paga retroattivamente la quota 2026",()=>{
    const contacts=buildUnifiedDirectory({today,people:[person("a","Christian","Martelli",null)],
      evidence:[evidence("f","google_sheet","Christian","Martelli",null),
        evidence("m","manual_override","Christian","Martelli",null,
          {membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31"})]});
    expect(contacts.find(c=>c.kind==="registro")?.association).toBe("solo_modulo");
    const next=buildUnifiedDirectory({today:"2027-02-08",people:[],evidence:[
      evidence("f","google_sheet","Christian","Martelli",null),
      evidence("m","manual_override","Christian","Martelli",null,
        {membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31"})]});
    expect(next[0].association).toBe("verificata");
  });
  it("quota verificata da email ha una provenienza visibile, senza confondersi con il modulo",()=>{
    const contacts=buildUnifiedDirectory({today,people:[person("a","Iris","Rosa","iris@example.test")],
      evidence:[evidence("f","google_sheet","Iris","Rosa","iris@example.test"),
        evidence("m","manual_override","Iris","Rosa","iris@example.test",{
          notes_admin:"Quota confermata da email (riferimento xxx)",
        })]});
    expect(contacts[0].association).toBe("verificata");
    expect(contacts[0].source).toContain("Pagamento email confermato");
  });
});
