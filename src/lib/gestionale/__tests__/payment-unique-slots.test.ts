import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {countAssignedPaymentSlots} from "@/lib/gestionale/payment-slot-progress";
import {paymentNameMatch} from "@/lib/gestionale/payment-auto-proposals";

describe("quote 30 €: ricaricamento e progressivo",()=>{
  it("Kyle Sullivan: una quota salvata deve mostrare 1/2 anche se compare due volte nel client",()=>{
    const slotsFromDb=[1],justSaved=[{slot:1}];
    expect(countAssignedPaymentSlots(slotsFromDb,justSaved)).toBe(1);
    expect(countAssignedPaymentSlots(slotsFromDb,justSaved)<2).toBe(true);
    expect(countAssignedPaymentSlots([1],[{slot:1},{slot:2}])).toBe(2);
  });
  it("la prima assegnazione torna disponibile dopo refresh e la seconda resta separata",()=>{
    expect(countAssignedPaymentSlots([],[{slot:1}])).toBe(1);
    expect(countAssignedPaymentSlots([1],[])).toBe(1);
    expect(countAssignedPaymentSlots([1,2],[{slot:1},{slot:2}])).toBe(2);
  });
  it("i nominativi con secondo nome come Kyle Patrick Sullivan sono proposti",()=>{
    expect(paymentNameMatch("Kyle Sullivan","Kyle Patrick Sullivan")).toBeGreaterThanOrEqual(75);
  });
  it("la UI usa il contatore unico e non duplica messaggi dopo un refresh",()=>{
    const code=readFileSync("src/components/gestionale/PaymentEmailReview.tsx","utf8");
    expect(code).toContain("countAssignedPaymentSlots(p.slots.filter(");
    expect(code).toContain("activeAssigned.map(item=>item.slot),saved[p.id]??[]");
    expect(code).toContain("extra.filter(item=>!p.assigned.some(a=>a.slot===item.slot))");
    expect(code).not.toContain("p.slots.length+extra.length");
  });
});
