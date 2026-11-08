import { describe, expect, it } from "vitest";
import { combinePaymentPersonCandidates, type PaymentPersonCandidate } from "@/lib/gestionale/payment-person-candidates";

const person=(id:string,name:string,email:string|null):PaymentPersonCandidate=>({
  kind:"person",id,name,email,source:"Anagrafica",
});
const member=(id:string,name:string,email:string|null):PaymentPersonCandidate=>({
  kind:"member",id,name,email,source:"Libro soci / modulo",
});

describe("ricerca unica persone per associare le quote Gmail",()=>{
  it("aggregates anagrafica and book for a unique identical person and email",()=>{
    const rows=combinePaymentPersonCandidates([
      person("p1","Ada Rossi","ada.rossi@gmail.com"),
      member("m1","Rossi Ada","adarossi@gmail.com"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({kind:"person",id:"p1",source:"Anagrafica + libro soci / modulo"});
  });

  it("aggregates an email-less official entry only when it has an unambiguous name",()=>{
    const rows=combinePaymentPersonCandidates([
      person("p1","Ada Rossi","ada.rossi@gmail.com"),
      member("m1","Ada Rossi",null),
      member("m2","Ada Rossi","adarossi@gmail.com"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("person");
  });

  it("does not merge different legal names sharing an email",()=>{
    const rows=combinePaymentPersonCandidates([
      person("p1","Ada Rossi","family@example.org"),
      member("m1","Eva Verdi","family@example.org"),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("does not merge same-name members with incompatible emails",()=>{
    const rows=combinePaymentPersonCandidates([
      person("p1","Ada Rossi","ada@example.org"),
      member("m1","Ada Rossi","other@example.org"),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("does not merge ambiguous same-name or shared-email profiles",()=>{
    const rows=combinePaymentPersonCandidates([
      person("p1","Ada Rossi","ada@example.org"),
      person("p2","Ada Rossi","ada@example.org"),
      member("m1","Ada Rossi","ada@example.org"),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.filter(row=>row.kind==="member")).toHaveLength(1);
  });

  it("does not merge two email-less official entries with the same name",()=>{
    const rows=combinePaymentPersonCandidates([
      person("p1","Ada Rossi","ada@example.org"),
      member("m1","Ada Rossi",null),
      member("m2","Ada Rossi",null),
    ]);
    expect(rows).toHaveLength(3);
  });

  it("does not create or verify payments: the function only returns display candidates",()=>{
    const input=[person("p1","Ada Rossi","ada@example.org"),member("m1","Ada Rossi","ada@example.org")];
    const rows=combinePaymentPersonCandidates(input);
    expect(input).toHaveLength(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("p1");
  });
});
