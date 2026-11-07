import {describe,expect,it} from "vitest";
import {computeSettlement,type SettlementInput} from "../settlement";
const base=():SettlementInput=>({
  peonyPct:30,lossPeonyCents:null,
  payments:[{receivedBy:"redsabbath",amountCents:30000}],
  expenses:[],transfers:[],carryoversIn:[],carryoversOut:[],
});
describe("saldo effettivo diverso dal dovuto",()=>{
  it("se doveva 90 e paga 80 resta da dare 10",()=>{
    const i=base(); i.transfers=[{fromParty:"redsabbath",toParty:"peony",status:"eseguito",amountCents:8000}];
    expect(computeSettlement(i).residuo).toBe(1000);
  });
  it("se paga 100 anziché 90 rimane 10 a favore di Ale",()=>{
    const i=base();i.transfers=[{fromParty:"redsabbath",toParty:"peony",status:"eseguito",amountCents:10000}];
    expect(computeSettlement(i).residuo).toBe(-1000);
  });
  it("se solo previsto, non si conta",()=>{
    const i=base();i.transfers=[{fromParty:"redsabbath",toParty:"peony",status:"da_eseguire",amountCents:9000}];
    expect(computeSettlement(i).residuo).toBe(9000);
  });
  it("il riporto di un saldo parziale azzera l'origine e si riflette sul workshop di destinazione",()=>{
    const origin=base();
    origin.transfers=[{fromParty:"redsabbath",toParty:"peony",status:"eseguito",amountCents:8000}];
    origin.carryoversOut=[{debtor:"redsabbath",creditor:"peony",amountCents:1000}];
    expect(computeSettlement(origin).residuo).toBe(0);
    const dest={...base(),payments:[],carryoversIn:[{debtor:"redsabbath" as const,creditor:"peony" as const,amountCents:1000}]};
    expect(computeSettlement(dest).residuo).toBe(1000);
  });
});
