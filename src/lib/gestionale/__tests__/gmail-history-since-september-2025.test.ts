import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

const importer=readFileSync("src/lib/gestionale/server/payment-mail-import.ts","utf8");
const action=readFileSync("src/app/gestione/(app)/quote-email/actions.ts","utf8");
const button=readFileSync("src/components/gestionale/HistoricalMailSyncButton.tsx","utf8");
const audit=readFileSync("src/components/gestionale/HistoricPaymentAudit.tsx","utf8");

describe("storico quote dal 1 settembre 2025",()=>{
  it("usa il confine locale di settembre e non interroga il 2024",()=>{
    expect(new Date("2025-09-01T00:00:00+02:00").toISOString())
      .toBe("2025-08-31T22:00:00.000Z");
    expect(importer).toContain('HISTORIC_START = new Date("2025-09-01T00:00:00+02:00")');
    expect(importer).not.toContain('new Date("2024-01-01T00:00:00+01:00")');
    expect(audit).toContain('.gte("paid_at","2025-08-31T22:00:00Z")');
    expect(audit).not.toContain('const years=["2024"');
  });
  it("resetta i token paginazione dei vecchi intervalli senza toccare i pagamenti",()=>{
    expect(importer).toContain("const resetHistoricWindow=");
    expect(importer).toContain("Date.parse(state.initial_from)<HISTORIC_START.getTime()");
    expect(importer).toContain("pageToken:resetHistoricWindow?undefined:");
    expect(importer).toContain('ignoreDuplicates:true');
  });
  it("limita il consumo Gmail a un blocco piccolo per ogni azione utente",()=>{
    expect(importer).toContain('maxResults:mode==="historic"?8:25');
    expect(button).toContain("const response=await syncHistoricalAssociationMailAction()");
    expect(button).not.toContain("for(let page=");
    expect(button).toContain("Analizza email dal settembre 2025");
    expect(action).toContain("Limite temporaneo di Gmail raggiunto");
  });
});
