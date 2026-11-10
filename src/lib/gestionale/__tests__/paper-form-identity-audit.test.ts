import { describe,expect,it } from "vitest";
import { deriveMembershipState } from "@/lib/association/membership-state";
import { formIdentityCompatible } from "@/lib/association/form-identity";
import { buildUnifiedDirectory } from "@/lib/gestionale/unified-directory";

const gaia={first_name:"Gaia maria",last_name:"Baietti",email:"baiagaietti@hotmail.it",
  source:"google_sheet",membership_status:"verified",membership_starts_at:"2026-06-08",membership_expires_at:"2026-12-31"};
const eva={first_name:"Eva Müller",last_name:"",email:"ba.hochstrasser@gmail.com",
  source:"google_sheet",membership_status:"verified",membership_starts_at:"2024-12-28",membership_expires_at:"2025-08-31"};
const barbara={first_name:"Barbara",last_name:"Hochstrasser",email:"ba.hochstrasser@gmail.com",
  source:"manual_form",membership_status:"verified",membership_starts_at:"2024-12-28",membership_expires_at:null};

const identity={email:"baiagaietti@hotmail.it",firstName:"Gaia",lastName:"Baietti"};

describe("stato moduli Google e cartacei distinti dalla quota",()=>{
  it("Gaia Maria Baietti è compatibile con Gaia Baietti, pur senza quota",()=>{
    expect(formIdentityCompatible(identity,gaia)).toBe(true);
    const state=deriveMembershipState([gaia],identity,
      {paymentsFrom:"2025-09-01",paymentsUntil:"2026-12-31",referenceDate:"2026-11-10"});
    expect(state).toMatchObject({formPresent:true,currentYearPaid:false,status:"payment_missing"});
  });
  it("l'email condivisa Barbara / Eva non certifica il modulo di Barbara",()=>{
    const person={email:barbara.email,firstName:"Barbara",lastName:"Hochstrasser"};
    expect(formIdentityCompatible(person,eva)).toBe(false);
    expect(deriveMembershipState([eva],person,{referenceDate:"2026-11-10"}).formPresent).toBe(false);
  });
  it("un modulo cartaceo manuale certifica solo il modulo, mai la quota",()=>{
    const person={email:barbara.email,firstName:"Barbara",lastName:"Hochstrasser"};
    expect(deriveMembershipState([eva,barbara],person,{referenceDate:"2026-11-10"}))
      .toMatchObject({formPresent:true,currentYearPaid:false,status:"payment_missing"});
    expect(deriveMembershipState([{...barbara,membership_status:"revoked"}],person)
      .formPresent).toBe(false);
  });
  it("mostra Gaia come quota mancante e Barbara come modulo mancante",()=>{
    const people=[
      {id:"gaia",first_name:"Gaia",last_name:"Baietti",email:gaia.email,nickname:null,
        association_member_id:null,membership_email:gaia.email,membership_name_key:null,merged_into:null},
      {id:"barbara",first_name:"Barbara",last_name:"Hochstrasser",email:barbara.email,nickname:"Pikushii",
        association_member_id:null,membership_email:barbara.email,membership_name_key:null,merged_into:null},
    ];
    const data=buildUnifiedDirectory({people,evidence:[
      {id:"g",...gaia},{id:"e",...eva}
    ],today:"2026-11-10"});
    expect(data.find(c=>c.personId==="gaia")).toMatchObject({formPresent:true,quotaPaid:false,association:"solo_modulo"});
    expect(data.find(c=>c.personId==="barbara")).toMatchObject({formPresent:false,association:"non_presente"});
    const withPaper=buildUnifiedDirectory({people,evidence:[
      {id:"g",...gaia},{id:"e",...eva},{id:"b",source_row_id:"manual_form:person:barbara",...barbara},
    ],today:"2026-11-10"});
    expect(withPaper.find(c=>c.personId==="barbara")).toMatchObject({
      formPresent:true,paperFormVerified:true,quotaPaid:false,association:"solo_modulo",
    });
  });
});
