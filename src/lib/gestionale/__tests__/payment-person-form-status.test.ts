import { describe,expect,it } from "vitest";
import {readFileSync} from "node:fs";
import { formStatusForPerson,formStatusLabel } from "@/lib/gestionale/payment-person-form-status";
const form=(first_name:string,last_name:string,email:string,source="google_sheet",status="verified")=>
 ({first_name,last_name,email,source,membership_status:status});

describe("quote: modulo collegato alla persona centrale",()=>{
  it("Gabriele Vierzi: modulo Google presente prima di assegnare PayPal",()=>{
    const result=formStatusForPerson(
      {first_name:"Gabriele",last_name:"Vierzi",email:"gabriel.vierzi@me.com"},
      [form("Gabriele","Vierzi","gabriel.vierzi@me.com")],
    );
    expect(result).toBe("google");
    expect(formStatusLabel(result)).toBe("Modulo Google presente");
  });
  it("Gaia / Gaia Maria: secondo nome non implica duplicato",()=>{
    expect(formStatusForPerson(
      {first_name:"Gaia",last_name:"Baietti",email:"baiagaietti@hotmail.it"},
      [form("Gaia maria","Baietti","baiagaietti@hotmail.it")],
    )).toBe("google");
  });
  it("recupera il modulo tramite email associativa anche quando cambia il recapito",()=>{
    expect(formStatusForPerson(
      {first_name:"Gabriele",last_name:"Vierzi",email:"nuovo@example.test",membership_email:"gabriel.vierzi@me.com"},
      [form("Gabriele","Vierzi","gabriel.vierzi@me.com")],
    )).toBe("google");
  });
  it("Barbara e Eva: stessa email non certifica il modulo",()=>{
    expect(formStatusForPerson(
      {first_name:"Barbara",last_name:"Hochstrasser",email:"ba.hochstrasser@gmail.com"},
      [form("Eva","Müller","ba.hochstrasser@gmail.com")],
    )).toBe("conflict");
  });
  it("modulo cartaceo verificato è valido, quello revocato no",()=>{
    const person={first_name:"Barbara",last_name:"Hochstrasser",email:"ba.hochstrasser@gmail.com"};
    expect(formStatusForPerson(person,[form("Barbara","Hochstrasser",person.email,"manual_form","verified")])).toBe("paper");
    expect(formStatusForPerson(person,[form("Barbara","Hochstrasser",person.email,"manual_form","revoked")])).toBe("missing");
  });
  it("la ricerca mostra lo stato modulo, nuove quote sempre su person_id",()=>{
    const code=readFileSync("src/app/gestione/(app)/quote-email/actions.ts","utf8");
    expect(code).toContain("formStatusLabel(formStatusForPerson(p,formRows.data??[]))");
    expect(code).toContain("row.source += \" · \"+formStatusLabel(");
    expect(code).toContain("personId=person.id;");
    expect(code).toContain('.eq("person_id",personId!)');
    expect(code).not.toContain("memberKey=target.id;");
  });
});
