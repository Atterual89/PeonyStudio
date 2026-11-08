import { describe, expect, it } from "vitest";
import { buildUnifiedDirectory, type RegistryEvidence } from "@/lib/gestionale/unified-directory";

const person=(id:string,first_name:string,last_name:string,email:string|null)=>({
 id,first_name,last_name,email,nickname:null,association_member_id:null,membership_email:null,
 membership_name_key:null,merged_into:null,
});
const member=(id:string,source:RegistryEvidence["source"],first_name:string,last_name:string,email:string|null,
 additional:Partial<RegistryEvidence>={}):RegistryEvidence=>({
 id,source,first_name,last_name,email,membership_status:"verified",membership_starts_at:"2025-09-01",
 membership_expires_at:"2026-12-31",...additional,
});
const today="2026-11-08";
describe("anagrafica unificata",()=>{
 it("integra una scheda anagrafica con TeamArtist senza email e modulo con email identica",()=>{
  const contacts=buildUnifiedDirectory({today,
   people:[person("a","Maryna","Zolotarenko","maru.zolotarenko@gmail.com")],
   evidence:[member("o","official_members_book","Maryna","Zolotarenko",null),
    member("f","google_sheet","Maryna","Zolotarenko","maru.zolotarenko@gmail.com",{membership_status:"expired"})]});
  expect(contacts).toHaveLength(1);
  expect(contacts[0]).toMatchObject({personId:"a",kind:"unita",association:"verificata",link:"email"});
  expect(contacts[0].source).toContain("Libro soci");
  expect(contacts[0].source).toContain("Modulo Google");
 });
 it("non unisce schede con la stessa email ma nomi incompatibili",()=>{
  const contacts=buildUnifiedDirectory({today,
   people:[person("a","Barbara","Hochstrasser","ba.hochstrasser@gmail.com")],
   evidence:[member("f","google_sheet","Eva","Müller","ba.hochstrasser@gmail.com",
    {membership_status:"expired"})]});
  expect(contacts).toHaveLength(2);
  expect(contacts.find(c=>c.personId==="a")?.kind).toBe("anagrafica");
  expect(contacts.find(c=>c.kind==="registro")?.name).toBe("Eva Müller");
 });
 it("lascia da confermare i match di solo nome, senza collegamenti inventati",()=>{
  const contacts=buildUnifiedDirectory({today,
   people:[person("a","Gaia","Baietti",null)],
   evidence:[member("o","official_members_book","Gaia","Baietti",null)]});
  expect(contacts).toHaveLength(2);
  expect(contacts.find(c=>c.kind==="registro")).toMatchObject({
   possiblePersonId:"a",link:"da_verificare",
  });
 });
 it("non confonde due omonimi con email diverse",()=>{
  const contacts=buildUnifiedDirectory({today,people:[],evidence:[
   member("one","google_sheet","Giulia","Rossi","uno@example.test"),
   member("two","google_sheet","Giulia","Rossi","due@example.test"),
   member("official","official_members_book","Giulia","Rossi",null),
  ]});
  expect(contacts).toHaveLength(3);
 });
 it("una voce sola per Christian: libro ufficiale 2025/26 + verifica manuale 2027",()=>{
  const contact={...person("p","Christian","Martelli",null),
    membership_name_key:"christian martelli"};
  const contacts=buildUnifiedDirectory({today,people:[contact],evidence:[
    member("official","official_members_book","Christian","Martelli",null),
    member("manual","manual_override","Christian","Martelli",null,{
      membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31",
    }),
  ]});
  expect(contacts).toHaveLength(1);
  expect(contacts[0]).toMatchObject({kind:"unita",link:"confermato",name:"Christian Martelli"});
  expect(contacts[0].source).toContain("Libro soci");
  expect(contacts[0].source).toContain("Verifica manuale");
 });
 it("una voce sola per Riccardo con annualità distinte e nessuna email",()=>{
  const contact={...person("p","Riccardo","Stopazzola",null),
    membership_name_key:"riccardo stopazzola"};
  const contacts=buildUnifiedDirectory({today,people:[contact],evidence:[
    member("official","official_members_book","Riccardo","Stopazzola",null),
    member("manual","manual_override","Riccardo","Stopazzola",null,{
      membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31",
    }),
  ]});
  expect(contacts).toHaveLength(1);
  expect(contacts[0]).toMatchObject({kind:"unita",link:"confermato"});
 });
 it("non fonde due omonimi presenti senza email nel registro ufficiale",()=>{
  const contacts=buildUnifiedDirectory({today,people:[],evidence:[
   member("o1","official_members_book","Mario","Rossi",null),
   member("o2","official_members_book","Mario","Rossi",null),
  ]});
  expect(contacts).toHaveLength(2);
  expect(contacts.every(c=>c.kind==="registro")).toBe(true);
 });
 it("se quota email confermata prevale sul controllo manuale nella provenienza visibile",()=>{
  const contacts=buildUnifiedDirectory({today,
   people:[person("a","Iris","Rosa","iris@example.test")],
   evidence:[member("m","manual_override","Iris","Rosa","iris@example.test",{
    notes_admin:"Quota confermata da email (riferimento xxx) · sostituisce verifica manuale",
   })]});
  expect(contacts).toHaveLength(1);
  expect(contacts[0].source).toContain("Pagamento email confermato");
  expect(contacts[0].source).not.toContain("Verifica manuale");
 });
});
