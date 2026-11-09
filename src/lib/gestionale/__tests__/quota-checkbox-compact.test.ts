import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
const src=(file:string)=>readFileSync(file,"utf8");

describe("Quota OK con checkbox senza descrizioni",()=>{
  it("usa una sola etichetta compatta e salva prima di mostrare il check",()=>{
    const ui=src("src/components/gestionale/QuotaOkCheckbox.tsx");
    expect(ui).toContain('type="checkbox"');
    expect(ui).toContain('aria-label="Quota OK"');
    expect(ui).toContain("<span>Quota OK</span>");
    expect(ui).toContain("if(result.ok)");
    expect(ui).toContain("router.refresh()");
    expect(ui).not.toContain("Segna quota associativa pagata");
    expect(ui).not.toContain("Azione immediata");
  });
  it("nella Rope Jam usa la validazione manuale già comune al sito, non un flag locale",()=>{
    const ui=src("src/components/gestionale/PeonyEventOperations.tsx");
    const action=src("src/app/gestione/(app)/peony/actions.ts");
    expect(ui).toContain("setPeonyQuotaOkAction({");
    expect(ui).toContain('person:"holder"');
    expect(ui).toContain('person:"partner"');
    expect(action).toContain("await requireAdmin()");
    expect(action).toContain("saveManualValidation(identity,{period})");
    expect(action).toContain("confirmManualQuotaPersisted(saved.id,identity,period)");
    expect(action).toContain("revokeManualValidation(identity,{period})");
    expect(action).toContain("attendee.associationRequired");
    expect(action).toContain("clearMembershipCache()");
  });
  it("nei workshop Kinbaku LuXuria ha lo stesso check e salva il periodo del workshop",()=>{
    const ui=src("src/components/gestionale/BookingDetails.tsx");
    expect(ui).toContain("<QuotaOkCheckbox");
    expect(ui).toContain("markQuotaOkAction({personId:person.id,workshopId})");
    expect(ui).toContain("revokeQuotaOkAction({personId:person.id,workshopId})");
    expect(ui).not.toContain("<MarkQuotaOk");
  });
});
