import {describe,expect,it} from "vitest";
import {cashFlowBars} from "../finance-dashboard";
describe("barre dashboard conti",()=>{
  it("calcola la percentuale incassata dal totale atteso senza cambiare le quote",()=>{
    expect(cashFlowBars({collectedCents:30000,outstandingCents:20000,expenseCents:12000}))
      .toMatchObject({collectedPct:60,spentPct:40,expected:50000,costsOverCollected:false});
  });
  it("se non ci sono importi previsti non divide per zero",()=>{
    expect(cashFlowBars({collectedCents:0,outstandingCents:0,expenseCents:0}))
      .toMatchObject({collectedPct:0,spentPct:0,hasExpected:false});
  });
  it("gestisce costi superiori agli incassi senza mostrare barre oltre il 100%",()=>{
    expect(cashFlowBars({collectedCents:10000,outstandingCents:0,expenseCents:20000}))
      .toMatchObject({collectedPct:100,spentPct:100,costsOverCollected:true});
  });
  it("i rimborsi netti negativi non producono barre negative",()=>{
    const bars=cashFlowBars({collectedCents:-3000,outstandingCents:7000,expenseCents:0});
    expect(bars.collectedPct).toBe(0);
    expect(bars.spentPct).toBe(0);
  });
});
