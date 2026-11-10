import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {membershipPeriodFor} from "@/lib/association/membership-periods";
import {deriveMembershipState} from "@/lib/association/membership-state";

const actions=readFileSync("src/app/gestione/(app)/quote-email/actions.ts","utf8");
const review=readFileSync("src/components/gestionale/PaymentEmailReview.tsx","utf8");
const memberSearch=readFileSync("src/lib/gestionale/server/membership.ts","utf8");

describe("riconciliazione Qonto e periodi indipendenti",()=>{
  it("la quota 2025/26 resta verificata e il 2027 non viene verificato per errore",()=>{
    const evidence=[{source:"google_sheet",first_name:"Maryna",last_name:"Zolotarenko",email:"maru.zolotarenko@gmail.com",membership_status:"pending",membership_starts_at:"2025-09-01",membership_expires_at:"2026-12-31"}, {
      source:"manual_override",first_name:"Maryna",last_name:"Zolotarenko",email:"maru.zolotarenko@gmail.com",
      membership_status:"verified",membership_starts_at:"2025-09-01",membership_expires_at:"2026-12-31",
    }];
    const identity={firstName:"Maryna",lastName:"Zolotarenko",email:"maru.zolotarenko@gmail.com"};
    expect(deriveMembershipState(evidence,identity,{paymentsFrom:"2025-09-01",paymentsUntil:"2026-12-31"}).currentYearPaid).toBe(true);
    expect(deriveMembershipState(evidence,identity,{paymentsFrom:"2027-01-01",paymentsUntil:"2027-12-31"}).currentYearPaid).toBe(false);
    expect(membershipPeriodFor("2026-11-04")?.paymentsFrom).toBe("2025-09-01");
  });
  it("mostra il conflitto e impedisce di cambiare annualità rispetto alla data della email",()=>{
    expect(actions).toContain("const alreadyPaidPeriod=person&&period");
    expect(actions).toContain("alreadyPaidPeriod,");
    expect(review).toContain("periodAlreadyPaid");
    expect(review).toContain("associationPeriodFrom");
    expect(actions).toContain("membershipPeriodForPayment(payment.paid_at.slice(0, 10))");
  });
  it("il collegamento alla persona resta distinto dalla quota e non cancella prove",()=>{
    expect(memberSearch).toContain("groupMemberEvidence(rows)");
    expect(actions).toContain("gw_confirm_association_payment");
  });
});
