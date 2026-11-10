import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { membershipPeriodForPayment } from "@/lib/association/membership-periods";

const file = (path:string)=>readFileSync(join(process.cwd(),path),"utf8");
const review=file("src/components/gestionale/PaymentEmailReview.tsx");
const actions=file("src/app/gestione/(app)/quote-email/actions.ts");

describe("Conferma delle quote importate da Gmail",()=>{
 it("non confonde il periodo 2025/26 già pagato con la nuova quota 2027",()=>{
  expect(membershipPeriodForPayment("2026-11-04")?.paymentsFrom).toBe("2026-09-01");
  expect(membershipPeriodForPayment("2027-01-01")?.paymentsFrom).toBe("2026-09-01");
  expect(actions).toContain("membershipPeriodForPayment(payment.paid_at.slice(0, 10))");
 });
 it("mostra il periodo nella scheda di ogni singolo pagamento",()=>{
  expect(review).toContain("associationPeriodFrom");
  expect(review).toContain("Annualità");
  expect(review).toContain("periodFor(p.id)");
 });
 it("se fallisce la chiamata mostra un errore nel riquadro, senza falso successo",()=>{
  expect(review).toContain("if(!result.ok){setError(paymentId,result.error);return;}");
  expect(review).toContain('role="alert"');
  expect(review).toContain("Non è stato possibile confermare il salvataggio");
 });
 it("se riesce mostra una conferma visibile sul telefono e non solo in testa alla lista",()=>{
  expect(review).toContain("setLastConfirmed");
  expect(review).toContain('role="status"');
  expect(review).toContain("Quota salvata nel database");
  expect(review).toContain("bottom-24");
 });
 it("non conferma mai un successo prima del riscontro dal database",()=>{
  expect(actions).toContain('from("gw_association_payment_allocations")');
  expect(actions).toContain('.eq("payment_id",paymentId)');
  expect(actions).toContain("if(verifyError||!allocation)");
  expect(actions).toContain("return {ok:true as const,data:{slot:allocation.slot");
 });
});