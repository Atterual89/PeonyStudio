import { beforeEach,describe,expect,it,vi } from "vitest";

type Evidence={
 first_name:string;last_name:string;email:string;source:string;membership_status:string;
 membership_starts_at:string;membership_expires_at:string
};
let row:Evidence|null=null;
const queries:{field:string;value:string}[][]=[];
vi.mock("@/lib/gestionale/server/db",()=>({
 getGestionaleDb:()=>({
  from:(table:string)=>{
   if(table!=="association_members")throw Error("Unexpected table");
   const predicates:{field:string;value:string}[]=[];
   queries.push(predicates);
   const builder={
    select:()=>builder,
    eq:(field:string,value:string)=>{predicates.push({field,value});return builder;},
    maybeSingle:async()=>({data:row,error:null})
   };
   return builder;
  }
 })
}));
const {confirmManualQuotaPersisted}=await import("@/lib/gestionale/server/manual-quota-proof");
const period={paymentsFrom:"2027-01-01",validUntil:"2027-12-31"};
const id="00000000-0000-4000-8000-00000000b123";
const identity={email:"adriano.giuff@gmail.com",firstName:"Adriano",lastName:"Giuffrè"};
beforeEach(()=>{
 queries.length=0;
 row={first_name:"Adriano",last_name:"Giuffrè",email:"adrianogiuff@gmail.com",
  source:"manual_override",membership_status:"verified",
  membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31"};
});
describe("verifica post-salvataggio della quota",()=>{
 it("riconosce la normalizzazione degli indirizzi Gmail, controllando il record salvato",async()=>{
  expect(await confirmManualQuotaPersisted(id,identity,period)).toBe(true);
  expect(queries[0]).toEqual([
   {field:"id",value:id},{field:"source",value:"manual_override"}
  ]);
 });
 it("rifiuta periodo diverso, quota revocata e identità non corrispondente",async()=>{
  expect(await confirmManualQuotaPersisted(id,identity,{paymentsFrom:"2025-09-01",validUntil:"2026-12-31"})).toBe(false);
  row!.membership_status="revoked";
  expect(await confirmManualQuotaPersisted(id,identity,period)).toBe(false);
  row!.membership_status="verified";
  expect(await confirmManualQuotaPersisted(id,{email:"altra.persona@gmail.com",firstName:"Altra",lastName:"Persona"},period)).toBe(false);
 });
 it("non accetta risposta senza riga",async()=>{
  row=null;
  expect(await confirmManualQuotaPersisted(id,identity,period)).toBe(false);
 });
});
