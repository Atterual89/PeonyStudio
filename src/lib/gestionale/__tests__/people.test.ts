import { describe, expect, it } from "vitest";

import { displayName } from "../format";
import {
  findPossibleDuplicates,
  peopleSharingEmail,
  personFieldsFromFreeText,
  searchPeople,
  validatePersonForm,
  type PersonFormValues,
} from "../people";

// Dati inventati.
function person(id: string, fields: Partial<Record<"first_name" | "last_name" | "nickname" | "email" | "instagram", string>> & { merged_into?: string }) {
  return {
    id,
    first_name: fields.first_name ?? null,
    last_name: fields.last_name ?? null,
    nickname: fields.nickname ?? null,
    email: fields.email ?? null,
    instagram: fields.instagram ?? null,
    merged_into: fields.merged_into ?? null,
  };
}

const EMPTY_FORM: PersonFormValues = {
  nickname: "",
  first_name: "",
  last_name: "",
  email: "",
  instagram: "",
  phone: "",
  teamartist_id: "",
  notes: "",
};

describe("anagrafica", () => {
  it("persona con solo nickname: valida; nome visualizzato = nickname", () => {
    const result = validatePersonForm({ ...EMPTY_FORM, nickname: "Nebbia" });
    expect(result.ok).toBe(true);
    expect(displayName({ nickname: "Nebbia", first_name: null, last_name: null })).toBe("Nebbia");
  });

  it("persona completata dopo: email normalizzata, nome visualizzato resta il nickname", () => {
    const result = validatePersonForm({
      ...EMPTY_FORM,
      nickname: "Nebbia",
      first_name: " Ilaria ",
      last_name: "Fumo",
      email: "Nebbia@Example.TEST",
    });
    expect(result.ok && result.payload).toMatchObject({ first_name: "Ilaria", email: "nebbia@example.test" });
  });

  it("serve almeno nome o nickname; email non valida rifiutata", () => {
    expect(validatePersonForm({ ...EMPTY_FORM, last_name: "Solo" }).ok).toBe(false);
    expect(validatePersonForm({ ...EMPTY_FORM, nickname: "X", email: "non-email" }).ok).toBe(false);
  });

  it("'Crea nuova': una parola → nickname, più parole → nome + cognome", () => {
    expect(personFieldsFromFreeText("Salice")).toEqual({ nickname: "Salice", first_name: null, last_name: null });
    expect(personFieldsFromFreeText("Gaia  De Monti")).toEqual({ nickname: null, first_name: "Gaia", last_name: "De Monti" });
  });
});

describe("ricerca", () => {
  const people = [
    person("1", { nickname: "Nebbia", first_name: "Ilaria", last_name: "Fumo", email: "nebbia@example.test" }),
    person("2", { first_name: "Niccolò", last_name: "Àlberi", instagram: "@ramo.verde" }),
    person("3", { nickname: "Nebbia vecchia", merged_into: "1" }),
  ];

  it("senza distinzione di maiuscole e accenti, su tutti i campi", () => {
    expect(searchPeople(people, "NICCOLO alberi").map((p) => p.id)).toEqual(["2"]);
    expect(searchPeople(people, "fumo").map((p) => p.id)).toEqual(["1"]);
    expect(searchPeople(people, "@ramo").map((p) => p.id)).toEqual(["2"]);
    expect(searchPeople(people, "example.test").map((p) => p.id)).toEqual(["1"]);
  });

  it("le persone unite non compaiono", () => {
    expect(searchPeople(people, "nebbia").map((p) => p.id)).toEqual(["1"]);
  });
});

describe("duplicati", () => {
  const people = [
    person("a", { nickname: "Nebbia", first_name: "Ilaria", last_name: "Fumo", email: "nebbia@example.test" }),
    person("b", { nickname: "nébbia" }),
    person("c", { first_name: "ilaria", last_name: "FUMO" }),
    person("d", { nickname: "Altro", email: "NEBBIA@example.test" }),
    person("e", { nickname: "Nebbia", merged_into: "a" }),
    person("f", { first_name: "Ilaria" }),
  ];

  it("riconosce nickname, nome+cognome ed email uguali (normalizzati); ignora unite e omonimi parziali", () => {
    const found = findPossibleDuplicates(people[0], people);
    expect(found.map((d) => [d.person.id, d.reasons])).toEqual([
      ["b", ["nickname"]],
      ["c", ["nome_cognome"]],
      ["d", ["email"]],
    ]);
  });

  it("email condivisa: avviso", () => {
    expect(peopleSharingEmail(people[0], people).map((p) => p.id)).toEqual(["d"]);
  });
});

describe("3b — differenze con il libro soci", () => {
  it("solo i campi pieni e diversi; maiuscole e spazi non contano; l'email si confronta in minuscolo", async () => {
    const { memberDifferences } = await import("../people");
    expect(
      memberDifferences(
        { first_name: "Lavi", last_name: " corsi ", email: "vecchia@example.test" },
        { first_name: "Lavinia", last_name: "Corsi", email: "Lavinia@Example.test" },
      ),
    ).toEqual([
      { field: "first_name", value: "Lavinia" },
      { field: "email", value: "lavinia@example.test" },
    ]);
    // Campo vuoto: lo riempie il database, nessun suggerimento.
    expect(memberDifferences({ first_name: null, last_name: "", email: null }, { first_name: "A", last_name: "B", email: "a@b.test" })).toEqual([]);
    // Socio senza email: nessun suggerimento sull'email.
    expect(memberDifferences({ email: "x@example.test" }, { email: null })).toEqual([]);
  });
});
