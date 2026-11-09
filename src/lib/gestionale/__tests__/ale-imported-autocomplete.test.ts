import {beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const operator={id:"ale-1",role:"organizzatrice"};
const tables:Record<string,Record<string,unknown>[]> = {
  gw_ale_contacts:[
    {id:"c1",owner_operator_id:"ale-1",display_name:"David Ratovitch",
      email:"david_db10@yahoo.com",person_id:null},
    {id:"c2",owner_operator_id:"ale-2",display_name:"David Sconosciuto",
      email:"foreign@example.test",person_id:null},
  ],
  gw_billing_profiles:[],gw_person_aliases:[],
};
vi.mock("@/lib/gestionale/server/auth",()=>({
  requireOrganizer:vi.fn(async()=>operator),
}));
vi.mock("@/lib/gestionale/server/db",()=>({
  getGestionaleDb:()=>({
    from:(table:string)=>{
      let filtered=[...(tables[table]??[])];
      const q={
        select:(_fields:string)=>q,
        eq:(column:string,value:unknown)=>{
          filtered=filtered.filter(row=>row[column]===value);return q;
        },
        is:(_column:string,_value:unknown)=>q,
        in:(column:string,values:string[])=>{
          filtered=filtered.filter(row=>values.includes(String(row[column])));return q;
        },
        order:(_column:string,_options?:unknown)=>q,
        range:(from:number,to:number)=>Promise.resolve({
          data:filtered.slice(from,to+1),error:null,
        }),
        limit:(count:number)=>Promise.resolve({data:filtered.slice(0,count),error:null}),
      };
      return q;
    },
  }),
}));

describe("autocomplete iscrizioni KL dall'anagrafica Alessandra",()=>{
  beforeEach(()=>{tables.gw_billing_profiles=[];});
  it("trova David dal registro Ale senza matching admin",async()=>{
    const {searchBillingDirectoryAction}=await import("@/app/gestione/(app)/anagrafica/billing-actions");
    const result=await searchBillingDirectoryAction({query:"david"});
    expect(result.ok).toBe(true);
    if(!result.ok)return;
    expect(result.data).toEqual([{
      id:"ale:c1",name:"David Ratovitch",email:"david_db10@yahoo.com",
      personId:null,source:"ale",
    }]);
    expect((await searchBillingDirectoryAction({query:"ratovi"})).ok).toBe(true);
  });
  it("non espone contatti fiscali di altri operatori",async()=>{
    const {searchBillingDirectoryAction}=await import("@/app/gestione/(app)/anagrafica/billing-actions");
    const result=await searchBillingDirectoryAction({query:"sconosciuto"});
    expect(result).toEqual({ok:true,data:[]});
  });
  it("UI separa ID del contatto dall'ID persona centrale",()=>{
    const add=readFileSync(join(process.cwd(),"src/components/gestionale/AddRegistration.tsx"),"utf8");
    expect(add).toContain("setPersonLookupId(entry.id)");
    expect(add).toContain("setPersonId(entry.personId)");
    expect(add).toContain("setPartnerLookupId(entry.id)");
    expect(add).toContain("setPartnerId(entry.personId)");
    const picker=readFileSync(join(process.cwd(),"src/components/gestionale/BillingNameAutocomplete.tsx"),"utf8");
    expect(picker).toContain("Anagrafica Alessandra");
  });
});
