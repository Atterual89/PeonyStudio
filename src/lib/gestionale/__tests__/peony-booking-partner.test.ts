import { describe, expect, it } from "vitest";
import { choosePartner, cleanPartnerName, isSameParticipant } from "../peony-booking-partner";

describe("prenotazioni Peony: identità partner", () => {
  const enrollment = { partner_name: "Partner", partner_email: null, partner_source: "user" };
  it("non trasforma un placeholder in una persona", () => {
    expect(cleanPartnerName("partner")).toBeNull();
    expect(cleanPartnerName("Da indicare")).toBeNull();
    expect(choosePartner(null, enrollment, null)).toBeNull();
  });
  it("un abbinamento confermato prevale sui vecchi dati checkout", () => {
    const result = choosePartner({
      partner_name:"Giada Verdi",partner_email:"giada@test.it",person_id:null,member_row_id:"member1"
    }, enrollment, { name:"Nome Vecchio", email:null });
    expect(result).toMatchObject({name:"Giada Verdi",email:"giada@test.it",memberRowId:"member1",source:"gestionale"});
  });
  it("una rimozione esplicita non ripristina il partner del checkout", () => {
    const result = choosePartner({partner_name:null,partner_email:null,person_id:null,member_row_id:null},
      enrollment,{ name:"Giada Verdi", email:null });
    expect(result).toBeNull();
  });
  it("accetta partner inserito soltanto con indirizzo email", () => {
    expect(choosePartner(null, null, {name:null,email:"AAA@example.it"})).toMatchObject({email:"aaa@example.it"});
  });
  it("impedisce di scegliere se stessi, senza confondere omonimi con due email diverse", () => {
    const owner = {name:"Mario Rossi",email:"mario@test.it"};
    expect(isSameParticipant(owner,{name:"Mario Rossi",email:"mario@test.it"})).toBe(true);
    expect(isSameParticipant(owner,{name:"Mario Rossi",email:"altro@test.it"})).toBe(false);
    expect(isSameParticipant(owner,{name:"Mario Rossi",email:null})).toBe(true);
  });
});
