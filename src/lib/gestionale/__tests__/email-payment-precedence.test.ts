import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import {deriveMembershipState,type MembershipEvidenceRow} from "@/lib/association/membership-state";
import {membershipBadge,membershipLabel,hasEmailPaymentProof} from "@/lib/gestionale/membership-rule";
const evidence=(notes_admin:string|null):MembershipEvidenceRow=>({
 first_name:"Elena",last_name:"Verdi",email:"elena@example.test",
 source:"manual_override",membership_status:"verified",
 membership_starts_at:"2027-01-01",membership_expires_at:"2027-12-31",notes_admin,
});
describe("precedenza della quota confermata via email",()=>{
 it("sceglie la prova email anche quando compare dopo la spunta manuale",()=>{
  const rows=[evidence("Validazione manuale da admin"),
   evidence("Quota confermata da email (riferimento 123)"),
   {...evidence(null),source:"google_sheet"}];
  const state=deriveMembershipState(rows,{email:"elena@example.test"},{
   paymentsFrom:"2027-01-01",paymentsUntil:"2027-12-31",
  });
  expect(state.paymentMatchMethod).toBe("payment_email");
  const badge=membershipBadge({workshopStartsOn:"2027-06-01",state,linked:true});
  expect(membershipLabel(badge)).toContain("pagamento email");
  expect(hasEmailPaymentProof(badge)).toBe(true);
 });
 it("nasconde Quota OK in scheda persona, LuXuria, Rope Jam e libro soci quando c'è la prova email",()=>{
  expect(hasEmailPaymentProof({kind:"in_regola",match:"manual",expiresAt:"2027-12-31"})).toBe(false);
  expect(hasEmailPaymentProof({kind:"modulo_mancante",quotaPaid:true,quotaMatch:"payment_email"})).toBe(true);
  expect(hasEmailPaymentProof({kind:"modulo_mancante",quotaPaid:true,quotaMatch:"manual"})).toBe(false);
  const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
  expect(read("src/components/gestionale/BookingDetails.tsx")).toContain("!hasEmailPaymentProof(badge)");
  expect(read("src/components/gestionale/QuotaOk.tsx")).toContain("if (hasEmailPaymentProof(props.badge)) return null;");
  expect(read("src/components/gestionale/PeonyEventOperations.tsx")).toContain('person.association?.matchMethod !== "payment_email"');
  expect(read("src/components/gestionale/PeonyEventOperations.tsx")).toContain('person.partner.membership?.matchMethod !== "payment_email"');
  expect(read("src/components/gestionale/QuotaCheckbox.tsx")).toContain("if (provenByEmail) return null;");
  expect(read("src/components/gestionale/SociReviewList.tsx")).toContain("!protectedEmail &&");
 });
 it("non permette di annullare via spunta una prova email",()=>{
  const src=readFileSync(join(process.cwd(),"src/lib/association/manual-validation.ts"),"utf8");
  expect(src).toContain('existing.notes_admin?.startsWith("Quota confermata da email (")');
  expect(src).toContain('!row.notes_admin?.startsWith("Quota confermata da email (")');
 });
 it("il server non blocca il passaggio dalla verifica manuale alla prova email",()=>{
  const src=readFileSync(join(process.cwd(),"src/app/gestione/(app)/quote-email/actions.ts"),"utf8");
  expect(src).toContain('state.paymentMatchMethod!=="manual"');
  expect(src).toContain('row.source!=="manual_override"');
 });
});
