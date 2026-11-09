import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src=(file:string)=>readFileSync(file,"utf8");
const picker=src("src/components/gestionale/MemberQuickLink.tsx");
const actions=src("src/app/gestione/(app)/w/actions.ts");
const merge=src("src/app/gestione/(app)/p/actions.ts");
const review=src("src/app/gestione/(app)/p/[id]/unisci/[otherId]/page.tsx");

describe("nickname scritto da Ale diverso dal nome anagrafico",()=>{
  it("permette di selezionare un socio già collegato per confrontare le schede",()=>{
    expect(picker).toContain("findLinkedMemberProfileAction");
    expect(picker).toContain("choose(event.target.value)");
    expect(picker).not.toContain("disabled={member.alreadyLinked}");
    expect(picker).toContain("Confronta le schede e unisci");
    expect(picker).toContain("/unisci/${personId}");
  });
  it("non collega una stessa prova associativa a due persone",()=>{
    expect(picker).toContain("if (!selected || selected.alreadyLinked || pending) return;");
    expect(actions).toContain("Questa socia è già collegata a un'altra anagrafica");
    expect(actions).toContain("const column=key.kind");
    expect(actions).toContain('.is("merged_into",null).limit(3)');
    expect(actions).toContain("if(owners.length!==1)");
  });
  it("una quota manuale già associata a un profilo nominale mostra la scheda esistente",()=>{
    expect(actions).toContain('if(owners.length===0 && key.kind==="manual" && !member.email)');
    expect(actions).toContain('.eq("membership_name_key",nameKey)');
    expect(actions).toContain("owners=nominalOwners??[]");
    expect(actions).toContain('if(owners.length!==1)');
  });
  it("non considera il nickname una condizione di identità",()=>{
    expect(picker).toContain("Il nickname non deve coincidere con il nome ufficiale");
    expect(review).toContain("I nomi usati per l'iscrizione possono essere diversi");
    expect(review).toContain("Pavel/Maru");
    expect(review).toContain("Se un nome come");
    expect(picker).toContain("Se il nome inserito da Ale indica due persone");
  });
  it("mantiene il collegamento nominale preesistente durante l'unione",()=>{
    expect(merge).toContain('const originalKey = memberKeyOfPerson(before)');
    expect(merge).toContain('key?.kind === "name" && originalKey !== input.memberKey');
    expect(merge).toContain('key?.kind !== "name" && originalKey !== (input.memberKey ?? null)');
    expect(merge).not.toContain('parseMemberKey(input.memberKey)?.kind !== "manual"');
  });
});
