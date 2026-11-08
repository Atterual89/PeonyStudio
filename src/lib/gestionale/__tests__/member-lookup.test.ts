import {describe,expect,it} from "vitest";
import {memberLookupScore,compatibleFormName,previouslyVerifiedBookMember} from "../member-lookup";

describe("Ricerca soci ampia, ma collegamento manuale",()=>{
  it("trova parte del nome e secondo nome Gaia Maria Baietti",()=>{
    const f={firstName:"Gaia Maria",lastName:"Baietti",email:"baietti@example.test"};
    expect(memberLookupScore("gaia bai",f)).toBe(0);
    expect(memberLookupScore("mari",f)).toBe(0);
    expect(memberLookupScore("BAIET",f)).toBe(0);
    expect(memberLookupScore("ietti",f)).toBe(1);
  });
  it("riconosce una parte del nickname in anagrafica e della nota di Ale",()=>{
    expect(memberLookupScore("sleep",{firstName:"Gaia",lastName:"Baietti",email:null},["Nosleep074"])).toBe(1);
    expect(memberLookupScore("noSl",{firstName:null,lastName:null,email:null},["Nosleep074"])).toBe(0);
    expect(memberLookupScore("aiz",{firstName:null,lastName:null,email:null},["Aizen e Franco"])).toBe(0);
    expect(memberLookupScore("Franco",{firstName:null,lastName:null,email:null},["Aizen e Franco"])).toBe(0);
  });
  it("nome parziale non prova automaticamente l'identità",()=>{
    expect(memberLookupScore("gaia",{firstName:"Gaia",lastName:"Baietti",email:null})).not.toBeNull();
    expect(memberLookupScore("gaia",{firstName:"Gaia",lastName:"Chieregatti",email:null})).not.toBeNull();
    expect(compatibleFormName("Gaia Baietti","Gaia Maria Baietti")).toBe(true);
    expect(compatibleFormName("Gaia Baietti","Gaia Maria Chieregatti")).toBe(false);
    expect(compatibleFormName("Aizen","Gaia Baietti")).toBe(false);
  });
  it("tessera 2026 non rende verificata la quota annuale 2027",()=>{
    const rows=[{source:"official_members_book",membership_status:"verified",membership_starts_at:"2025-09-01"}];
    expect(previouslyVerifiedBookMember(rows,"2027-01-01")).toBe(true);
    expect(previouslyVerifiedBookMember(rows,"2025-09-01")).toBe(false);
  });
});
