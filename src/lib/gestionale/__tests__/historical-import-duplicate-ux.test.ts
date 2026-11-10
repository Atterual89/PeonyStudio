import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const audit=readFileSync("src/components/gestionale/IdentityAuditDashboard.tsx","utf8");
const historic=readFileSync("src/components/gestionale/HistoricPaymentAudit.tsx","utf8");
const button=readFileSync("src/components/gestionale/HistoricalMailSyncButton.tsx","utf8");

describe("riepiloghi amministrativi: duplicazioni e scansione storica",()=>{
 it("distingue una risposta Google dalle copie duplicate",()=>{
   expect(audit).toContain("1 modulo Google ·");
   expect(audit).toContain("d.recordCount-1");
   expect(audit).toContain("Segnalazioni da verificare");
   expect(audit).not.toContain("{d.reason} · {d.recordCount} record");
 });
 it("mostra che la scansione storica è ancora incompleta e conserva lo stato dopo refresh",()=>{
   expect(historic).toContain("isInProgress=Boolean(mailState.data?.pending_page_token)");
   expect(historic).toContain("Archivio storico non ancora completo");
   expect(historic).toContain("initialHasMore={isInProgress}");
   expect(button).toContain("useState(initialHasMore)");
   expect(button).toContain("Prosegui analisi email");
   expect(historic).toContain("Rivedi i pagamenti importati");
 });
});
