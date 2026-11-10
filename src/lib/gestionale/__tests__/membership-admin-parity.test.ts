import {describe, expect, it} from "vitest";
import {deriveMembershipState, type MembershipEvidenceRow, CURRENT_MEMBERSHIP_START, CURRENT_MEMBERSHIP_EXPIRY} from "@/lib/association/membership-state";
import {membershipPeriodFor} from "@/lib/association/membership-periods";
const row=(source:string,date:string):MembershipEvidenceRow=>({
 first_name:"Dafne",last_name:"Rio",email:"dafne@example.test",source,
 membership_status:"verified",membership_starts_at:date,
 membership_expires_at:date.startsWith("2027")?"2027-12-31":"2026-12-31",
});
describe("stesse regole per admin e gestionale",()=>{
 it("stessa fonte senza e con periodo esplicito 2025/26",()=>{
  const rows=[row("google_sheet","2025-09-01"),row("manual_override","2025-09-01")];
  const id={email:"dafne@example.test"};
  expect(deriveMembershipState(rows,id)).toEqual(deriveMembershipState(rows,id,{
   paymentsFrom:"2025-09-01",paymentsUntil:"2026-12-31"}));
  expect(deriveMembershipState(rows,id).status).toBe("valid");
 });
 it("Team Artist non determina la verifica associativa",()=>{
  const official=[row("official_members_book","2025-09-01")];
  expect(deriveMembershipState(official,{email:"dafne@example.test"})).toMatchObject({
    status:"missing_form",currentYearPaid:false,formPresent:false,verifiedInOfficialBook:false,
  });
  expect(deriveMembershipState(official,{email:"dafne@example.test"},{referenceDate:"2027-02-19"}))
    .toMatchObject({status:"missing_form",formPresent:false,verifiedInOfficialBook:false});
 });
 it("quote per periodi indipendenti e modulo una sola volta",()=>{
  const rows=[row("google_sheet","2025-09-01"),row("manual_override","2027-01-03")];
  expect(deriveMembershipState(rows,{email:"dafne@example.test"},{
   paymentsFrom:"2025-09-01",paymentsUntil:"2026-12-31"}).status).toBe("payment_missing");
  expect(deriveMembershipState(rows,{email:"dafne@example.test"},{
   paymentsFrom:"2027-01-01",paymentsUntil:"2027-12-31"}).status).toBe("valid");
 });
 it("le date dei periodi sono quelle previste",()=>{
  expect(CURRENT_MEMBERSHIP_START).toBe("2025-09-01");
  expect(CURRENT_MEMBERSHIP_EXPIRY).toBe("2026-12-31");
  expect(membershipPeriodFor("2025-08-31")).toBeNull();
  expect(membershipPeriodFor("2026-11-14")?.paymentsFrom).toBe("2025-09-01");
  expect(membershipPeriodFor("2027-02-01")?.paymentsFrom).toBe("2026-09-01");
 });
});
