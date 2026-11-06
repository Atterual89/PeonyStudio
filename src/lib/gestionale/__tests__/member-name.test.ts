// D11: nome e cognome del socio collegato e "Completa con i dati del libro
// soci" (solo campi vuoti). Caricatori del libro soci e del modulo: colonne
// Nome / Cognome riconosciute anche con intestazioni a due righe. Dati inventati.

import { describe, expect, it } from "vitest";

import { normalizeOfficialMembersBookRows } from "@/lib/google/members-book";
import { normalizeGoogleSheetRows } from "@/lib/google/sheets";

import { memberFill, memberFullName, resolveMemberName, singleNameOrder, unsplitMemberName } from "../member-name";
import type { MemberSummary } from "../types";

const row = (first_name: string | null, last_name: string | null, source = "official_members_book") => ({ first_name, last_name, source });

function member(fields: Partial<MemberSummary>): MemberSummary {
  return { id: "e:x@example.test", first_name: null, last_name: null, email: null, expires_at: null, source: "libro", name_split: true, ...fields };
}

describe("caricatori: colonne Nome e Cognome", () => {
  it("libro soci con intestazione su due righe e Cognome prima di Nome: 'nome' non trova 'cognome'", () => {
    const result = normalizeOfficialMembersBookRows([
      ["Socio", "", "Contatti", "Anno sociale 2026"],
      ["Cognome", "Nome", "Email", "Quota soci"],
      ["Brunoir", "Quentin", "quentin@example.test", "30"],
    ]);
    expect(result.detectedColumns.first_name.index).toBe(1);
    expect(result.detectedColumns.last_name.index).toBe(0);
    expect(result.rows[0]).toMatchObject({ first_name: "Quentin", last_name: "Brunoir", email: "quentin@example.test" });
  });

  it("modulo con colonne separate, Cognome prima", () => {
    const result = normalizeGoogleSheetRows(
      [
        ["Informazioni cronologiche", "Cognome / Surname", "Nome / Name", "Indirizzo email"],
        ["10/01/2026", "Brunoir", "Quentin", "quentin@example.test"],
      ],
      "it-",
    );
    expect(result.rows[0]).toMatchObject({ first_name: "Quentin", last_name: "Brunoir" });
  });

  it("modulo con un solo campo 'Cognome e nome': resta un campo unico, l'ordine si legge dall'intestazione", () => {
    const result = normalizeGoogleSheetRows(
      [
        ["Informazioni cronologiche", "Cognome e nome", "Indirizzo email"],
        ["10/01/2026", "Brunoir Quentin", "quentin@example.test"],
      ],
      "it-",
    );
    expect(result.rows[0]).toMatchObject({ first_name: "Brunoir Quentin", last_name: "" });
    expect(singleNameOrder(result.detectedColumns.first_name.normalizedHeader)).toBe("cognome_nome");
    expect(singleNameOrder("nome e cognome")).toBe("nome_cognome");
    expect(singleNameOrder("name")).toBeNull();
  });
});

describe("nome e cognome del socio", () => {
  it("colonne separate: si usano così come sono", () => {
    expect(resolveMemberName([row("Quentin", "Brunoir")], [])).toEqual({ firstName: "Quentin", lastName: "Brunoir", split: true });
  });

  it("campo unico nel modulo: si separa con l'unica riga del libro soci con le stesse parole", () => {
    const form = row("Brunoir Quentin", "", "google_sheet");
    expect(resolveMemberName([form], [row("Quentin", "Brunoir"), row("Altra", "Persona")])).toEqual({
      firstName: "Quentin",
      lastName: "Brunoir",
      split: true,
    });
  });

  it("campo unico con due parole e ordine noto dall'intestazione", () => {
    const form = row("Brunoir Quentin", "", "google_sheet");
    expect(resolveMemberName([form], [], "cognome_nome")).toEqual({ firstName: "Quentin", lastName: "Brunoir", split: true });
    expect(resolveMemberName([form], [], "nome_cognome")).toEqual({ firstName: "Brunoir", lastName: "Quentin", split: true });
  });

  it("campo unico ambiguo (ordine ignoto, tre parole o omonimi): non si indovina", () => {
    expect(resolveMemberName([row("Brunoir Quentin", "", "google_sheet")], [])).toEqual({ firstName: "Brunoir Quentin", lastName: null, split: false });
    expect(resolveMemberName([row("De Brunoir Quentin", "", "google_sheet")], [], "cognome_nome").split).toBe(false);
    const twins = [row("Quentin", "Brunoir"), row("Brunoir", "Quentin")];
    expect(resolveMemberName([row("Quentin Brunoir", "", "google_sheet")], twins).split).toBe(false);
  });

  it("'Collegata a <Nome> <Cognome>'", () => {
    expect(memberFullName({ first_name: "Quentin", last_name: "Brunoir" })).toBe("Quentin Brunoir");
  });
});

describe("Completa con i dati del libro soci: solo i campi vuoti", () => {
  const linked = member({ first_name: "Quentin", last_name: "Brunoir", email: "Quentin@Example.test" });

  it("persona con solo nickname: nome, cognome ed email dal socio", () => {
    expect(memberFill({ first_name: null, last_name: null, email: null }, linked)).toEqual({
      first_name: "Quentin",
      last_name: "Brunoir",
      email: "quentin@example.test",
    });
  });

  it("campi pieni non si toccano (anche se diversi); niente se tutto è pieno", () => {
    expect(memberFill({ first_name: "Quinto", last_name: null, email: "altra@example.test" }, linked)).toEqual({ last_name: "Brunoir" });
    expect(memberFill({ first_name: "Quinto", last_name: "Bruno", email: "q@example.test" }, linked)).toEqual({});
    expect(memberFill({ first_name: null, last_name: null, email: null }, null)).toEqual({});
  });

  it("nome in un campo unico non separabile: solo l'email, con l'avviso di completarli a mano", () => {
    const single = member({ first_name: "Brunoir Quentin", last_name: null, email: "q@example.test", name_split: false });
    expect(memberFill({ first_name: null, last_name: null, email: null }, single)).toEqual({ email: "q@example.test" });
    expect(unsplitMemberName({ first_name: null, last_name: null }, single)).toBe("Brunoir Quentin");
    expect(unsplitMemberName({ first_name: "Quentin", last_name: "Brunoir" }, single)).toBeNull();
    expect(unsplitMemberName({ first_name: null, last_name: null }, linked)).toBeNull();
  });
});
