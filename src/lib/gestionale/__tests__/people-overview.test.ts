import { describe, expect, it } from "vitest";
import { buildPeopleOverview } from "../people-overview";
import type { Person } from "../types";
import type { SociReviewRow } from "@/lib/gestionale/server/soci";

function person(id: string, name: string, email: string): Person {
  const [first, last] = name.split(" ");
  return { id, first_name: first, last_name: last, nickname: null, email, instagram: null,
    phone: null, teamartist_id: null, notes: null, association_member_id: null,
    membership_email: email, merged_into: null, version: 1, created_at: "", updated_at: "" };
}
function form(id: string, name: string, email: string, paid = false): SociReviewRow {
  return { key: id, formMemberId: id, name, email, submittedAt: null,
    personId: null, paid, paidSource: paid ? "manual" : null };
}
const today = "2026-11-07";
const peony = [
  { key: "p1", title: "Foundation 2", startsOn: "2026-11-10", endsOn: "2026-12-01",
    href: "/gestione/peony/p1", people: [
      { key: "e:a@test.it", name: "Anna Rossi", email: "a@test.it", observer: false },
      { key: "e:c@test.it", name: "Carlo Bianchi", email: "c@test.it", observer: false },
    ] },
];
describe("Persone: elenco unico, prima i workshop futuri", () => {
  const people = [person("A", "Anna Rossi", "a@test.it"), person("B", "Bruno Verdi", "b@test.it")];
  const forms = [form("F1", "Anna Rossi", "a@test.it", true), form("F2", "Carlo Bianchi", "c@test.it"),
    form("F3", "Persona Mai Venuta", "x@test.it")];
  const overview = () => buildPeopleOverview({
    people, currentForms: forms, formsByYear: new Map([["2026", forms]]),
    peony, luxuria: [], today,
  });
  it("mostra gli iscritti attivi e non ripete Anna fra le altre persone", () => {
    const result = overview();
    expect(result.upcoming).toHaveLength(1);
    expect(result.upcoming[0].people.map((x) => x.name)).toEqual(["Anna Rossi", "Carlo Bianchi"]);
    expect(result.upcoming[0].people[0]).toMatchObject({ personId: "A", formMemberId: "F1", paid: true });
    expect(result.otherPeople.map((x) => x.personId)).toEqual(["B"]);
    expect(result.formOnly.map((x) => x.formMemberId)).toEqual(["F3"]);
  });
  it("non confonde omonimi che hanno email diverse", () => {
    const result = buildPeopleOverview({ people: [],
      currentForms: [form("f1", "Anna Rossi", "altra@test.it")],
      formsByYear: new Map([["2026", [form("f1", "Anna Rossi", "altra@test.it")]]]),
      peony, luxuria: [], today });
    expect(result.upcoming[0].people[0].formMemberId).toBeNull();
  });
  it("usa quote annuali diverse per i workshop del 2027", () => {
    const nextYear = [form("F1", "Anna Rossi", "a@test.it", false)];
    const result = buildPeopleOverview({
      people, currentForms: forms, formsByYear: new Map([["2026", forms], ["2027", nextYear]]),
      peony: [{ ...peony[0], startsOn: "2027-02-10", endsOn: "2027-02-10" }],
      luxuria: [], today });
    expect(result.upcoming[0].people[0]).toMatchObject({ formMemberId: "F1", paid: false });
  });
  it("esclude eventi passati, limita la ricerca senza far sparire i moduli", () => {
    const result = buildPeopleOverview({
      people, currentForms: forms, formsByYear: new Map([["2026", forms]]),
      peony: [{...peony[0],startsOn:"2026-01-10",endsOn:"2026-01-12"},peony[0]],
      luxuria: [], today, query:"Mai Venuta" });
    expect(result.upcoming).toEqual([]);
    expect(result.formOnly.map((x) => x.name)).toEqual(["Persona Mai Venuta"]);
  });
  it("considera le iscrizioni LuXuria anche senza ticket Ticket Tailor", () => {
    const result = buildPeopleOverview({
      people, currentForms: forms, formsByYear: new Map([["2026", forms]]),
      peony: [], luxuria: [{key:"luxuria:w1",title:"LuXuria",startsOn:"2026-12-01",endsOn:null,href:"/gestione/w/w1",people:[{personId:"A"}]}],
      today });
    expect(result.upcoming[0].people[0]).toMatchObject({ personId:"A", paid:true });
    expect(result.otherPeople.map((x) => x.personId)).toEqual(["B"]);
  });
});
