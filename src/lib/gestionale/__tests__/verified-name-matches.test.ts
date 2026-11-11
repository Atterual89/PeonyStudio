import {describe,it,expect} from "vitest";
import {isVerifiedOfficialNameOnlyMatch,type LinkProposal} from "../exact-matches";
const proposal:LinkProposal={
  personId:"p1",version:1,personName:"Tommaso Ravizza",personEmail:null,
  memberId:"n:ravizza tommaso",memberName:"Tommaso Ravizza",memberEmail:null,
  by:"nome",differentEmail:false,
};
const same=[{id:"p1",nameKey:"ravizza tommaso"}];
describe("libro soci: non richiedere verifiche ripetitive delle quote",()=>{
  it("non ripropone il socio verificato nel libro ufficiale, quando il nominativo è univoco",()=>{
    expect(isVerifiedOfficialNameOnlyMatch(proposal,same,{source:"libro",badgeKind:"in_regola"})).toBe(true);
  });
  it("un altro omonimo obbliga una verifica di identità",()=>{
    expect(isVerifiedOfficialNameOnlyMatch(proposal,[...same,{id:"p2",nameKey:"ravizza tommaso"}],
      {source:"libro",badgeKind:"in_regola"})).toBe(false);
  });
  it("non nasconde chi non è in regola per il periodo corrente",()=>{
    expect(isVerifiedOfficialNameOnlyMatch(proposal,same,{source:"libro",badgeKind:"quota_mancante"})).toBe(false);
  });
  it("non usa il solo modulo Google come prova del pagamento",()=>{
    expect(isVerifiedOfficialNameOnlyMatch(proposal,same,{source:"modulo",badgeKind:"in_regola"})).toBe(false);
  });
  it("le email disallineate non vengono trattate come corrispondenza certa",()=>{
    expect(isVerifiedOfficialNameOnlyMatch({...proposal,personEmail:"riccardo@example.com"},same,
      {source:"libro",badgeKind:"in_regola"})).toBe(false);
  });
});
