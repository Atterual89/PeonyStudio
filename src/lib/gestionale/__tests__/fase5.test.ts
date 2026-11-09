// Fase 5: libro soci (collegamento in blocco, stato per data del workshop),
// presenze (una spunta per iscrizione, D27), tab Email, storico. Dati inventati.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeMembershipEmail, normalizeMembershipNameKey, type MembershipEvidenceRow } from "@/lib/association/membership-state";

import { auditActionLabel, auditChanges, auditKindsFor, auditOperator, auditWhat, cleanAuditValue, formatAuditValue, isAuditKind, isSensitiveKey } from "../audit";
import { defaultEmailSelection, emailRows, emailText } from "../email-list";
import { memberLinkProposals, type LinkPerson, type MemberCandidate } from "../exact-matches";
import { deriveForWorkshop, membershipBadge, membershipLabel } from "../membership-rule";
import { canMarkPresent, presentCount, showPresence } from "../presence";
import type { BookingPersonView, BookingStatus, BookingView } from "../types";

// ---------------------------------------------------------------------------
// Libro soci
// ---------------------------------------------------------------------------

function linkPerson(id: string, first: string | null, last: string | null, email: string | null): LinkPerson {
  return {
    id,
    version: 1,
    name: [first, last].filter(Boolean).join(" ") || id,
    email,
    emailKey: normalizeMembershipEmail(email),
    nameKey: normalizeMembershipNameKey(first, last),
  };
}

function member(key: string, first: string, last: string, emails: string[]): MemberCandidate {
  return {
    key,
    name: `${first} ${last}`,
    email: emails[0] ?? null,
    emails: emails.map(normalizeMembershipEmail),
    nameKeys: [normalizeMembershipNameKey(first, last)],
  };
}

describe("collegamento in blocco al libro soci", () => {
  const members = [
    member("e:viola.serra@gmail.com", "Viola", "Serra", ["Viola.Serra@gmail.com"]),
    member("e:ortensia@example.test", "Ortensia", "Lauro", ["ortensia@example.test"]),
    member("n:pia uguale", "Pia", "Uguale", []),
    member("e:pia.due@example.test", "Pia", "Uguale", ["pia.due@example.test"]),
  ];

  it("per email (normalizzata come l'admin: Gmail senza punti), proposta preselezionata", () => {
    const { proposals, none } = memberLinkProposals([linkPerson("p1", null, null, "violaserra@GMAIL.com")], members);
    expect(none).toEqual([]);
    expect(proposals).toEqual([expect.objectContaining({ personId: "p1", memberId: "e:viola.serra@gmail.com", by: "email" })]);
  });

  it("per nome e cognome (anche in ordine inverso, anche con email diversa): da confermare", () => {
    const { proposals } = memberLinkProposals(
      [linkPerson("p2", "Lauro", "Ortensia", null), linkPerson("p3", "Ortensia Lauro", null, "altra@example.test")],
      members,
    );
    // Stesso socio proposto a due persone: nessuna delle due (unicità).
    expect(proposals).toEqual([]);
    const single = memberLinkProposals([linkPerson("p3", "Ortensia Lauro", null, "altra@example.test")], members).proposals;
    expect(single).toEqual([expect.objectContaining({ personId: "p3", by: "nome", differentEmail: true })]);
  });

  it("nessuna corrispondenza, o più soci con lo stesso nome → nessuna proposta", () => {
    const { proposals, none } = memberLinkProposals(
      [linkPerson("p4", "Nessuno", "Trovato", "nessuno@example.test"), linkPerson("p5", "Pia", "Uguale", null), linkPerson("p6", "Solo", null, null)],
      members,
    );
    expect(proposals).toEqual([]);
    expect(none.map((p) => p.id).sort()).toEqual(["p4", "p5", "p6"]);
  });

  it("l'email ha la precedenza sul nome", () => {
    const { proposals } = memberLinkProposals([linkPerson("p7", "Pia", "Uguale", "pia.due@example.test")], members);
    expect(proposals).toEqual([expect.objectContaining({ memberId: "e:pia.due@example.test", by: "email" })]);
  });
});

function evidence(fields: Partial<MembershipEvidenceRow>): MembershipEvidenceRow {
  return {
    first_name: "Viola",
    last_name: "Serra",
    email: "viola@example.test",
    source: "official_members_book",
    membership_status: "verified",
    membership_starts_at: "2025-10-01",
    membership_expires_at: "2026-12-31",
    ...fields,
  };
}

describe("stato associativo per data del workshop", () => {
  const identity = { email: "viola@example.test" };
  const badge = (rows: MembershipEvidenceRow[], startsOn: string, linked = true) =>
    membershipBadge({ workshopStartsOn: startsOn, state: deriveForWorkshop(rows, identity, startsOn), linked });

  it("valida fino al 31/12/2026: workshop di novembre 2026 in regola, di febbraio 2027 no", () => {
    const rows = [evidence({source:"manual_override"}), evidence({ source: "google_sheet" })];
    expect(badge(rows, "2026-11-14")).toMatchObject({ kind: "in_regola", expiresAt: "2026-12-31" });
    expect(membershipLabel(badge(rows, "2027-02-06"))).toBe("Quota non registrata dal 1 gen 2027");
  });

  it("persona non collegata e non trovata → Non collegata (da verificare)", () => {
    expect(membershipLabel(membershipBadge({ workshopStartsOn: "2026-11-14", state: deriveForWorkshop([], identity, "2026-11-14"), linked: false }))).toBe(
      "Non collegata",
    );
  });

  it("la validazione manuale prevale sul libro soci", () => {
    const rows = [
      evidence({ membership_status: "missing", membership_starts_at: null, membership_expires_at: null }),
      evidence({ source: "manual_override", membership_starts_at: "2025-09-01" }),
      evidence({ source: "google_sheet" }),
    ];
    expect(badge(rows, "2026-11-14")).toEqual({ kind: "in_regola", expiresAt: "2026-12-31", match: "manual" });
  });
});

// ---------------------------------------------------------------------------
// Presenze (una spunta per iscrizione) e tab Email
// ---------------------------------------------------------------------------

let seq = 0;
function entry(name: string, email: string | null, merged = false): BookingPersonView {
  seq += 1;
  return {
    participantId: `bp-${seq}`,
    isPrimary: true,
    enteredAs: null,
    enteredEmail: null,
    matchStatus: "confermato",
    possibleDuplicate: null,
    member: null,
    displayName: name,
    fullName: null,
    membership: { kind: "non_collegata" },
    contacts: [],
    person: {
      id: `p-${name}`,
      first_name: name,
      last_name: null,
      nickname: null,
      email,
      instagram: null,
      phone: null,
      teamartist_id: null,
      notes: null,
      association_member_id: null,
      membership_email: null,
      merged_into: merged ? "p-altra" : null,
      version: 1,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  };
}

function booking(id: string, status: BookingStatus, people: BookingPersonView[], present = false): BookingView {
  return { bookingId: id, version: 1, status, present, notes: null, agreedFeeCents: null, feeCustom: false, payments: [], createdBy: null, people, formerPartners: [] };
}

describe("presenze", () => {
  it("una spunta per iscrizione: la coppia conta 1; solo le confermate", () => {
    const couple = booking("b1", "saldato", [entry("Aster", null), entry("Bruma", null)], true);
    const single = booking("b2", "prenotato", [entry("Cedro", null)]);
    const waiting = booking("b3", "lista_attesa", [entry("Dalia", null)], true);
    expect(presentCount([couple, single, waiting])).toEqual({ present: 1, total: 2 });
    expect(canMarkPresent("acconto")).toBe(true);
    expect(canMarkPresent("interessato")).toBe(false);
    expect(canMarkPresent("cancellato")).toBe(false);
  });

  it("dal giorno di inizio del workshop", () => {
    expect(showPresence("2026-11-14", "2026-11-13")).toBe(false);
    expect(showPresence("2026-11-14", "2026-11-14")).toBe(true);
    expect(showPresence("2026-11-14", "2026-11-15")).toBe(true);
  });
});

describe("tab Email", () => {
  const bookings = [
    booking("b1", "saldato", [entry("Elio", "Elio@Example.test"), entry("Fiamma", "fiamma@example.test")]),
    booking("b2", "acconto", [entry("Gaia", "elio@example.test")]), // stessa email di Elio, maiuscole diverse
    booking("b3", "saldato", [entry("Iris", null)]),
    booking("b4", "interessato", [entry("Lauro", "lauro@example.test")]),
    booking("b5", "prenotato", [entry("Malva", "malva@example.test")]),
    booking("b6", "lista_attesa", [entry("Mirto", "mirto@example.test")]),
    booking("b7", "cancellato", [entry("Nespola", "nespola@example.test")]),
    booking("b8", "saldato", [entry("Olmo", "olmo@example.test", true)]),
  ];
  const rows = emailRows(bookings);

  it("per persona: confermati prima, poi interessati e prenotati a parola; esclusi lista d'attesa, cancellati e persone unite", () => {
    expect(rows.map((r) => [r.name, r.confirmed])).toEqual([
      ["Elio", true],
      ["Fiamma", true],
      ["Gaia", true],
      ["Iris", true],
      ["Lauro", false],
      ["Malva", false],
    ]);
  });

  it("selezionati all'apertura solo i confermati con l'email; testo per il Ccn senza doppioni", () => {
    const selected = defaultEmailSelection(rows);
    expect([...selected].sort()).toEqual(["p-Elio", "p-Fiamma", "p-Gaia"]);
    expect(emailText(rows, selected)).toEqual({ text: "Elio@Example.test, fiamma@example.test", count: 2 });
    // Aggiungere un prenotato a parola.
    expect(emailText(rows, new Set([...selected, "p-Malva"])).count).toBe(3);
    // Chi non ha l'email non entra nel testo anche se selezionato.
    expect(emailText(rows, new Set(["p-Iris"]))).toEqual({ text: "", count: 0 });
  });
});

// ---------------------------------------------------------------------------
// Storico
// ---------------------------------------------------------------------------

describe("storico modifiche", () => {
  it("descrizione: «Pagamento 250 € — Corvo — Level 2+»", () => {
    expect(
      auditWhat({ entity: "payment", before: null, after: { kind: "pagamento", amount_cents: 25000 }, subject: "Corvo", workshopName: "Level 2+" }),
    ).toBe("Pagamento 250 € — Corvo — Level 2+");
    expect(auditWhat({ entity: "payment", before: null, after: { kind: "rimborso", amount_cents: -5000 }, subject: "Corvo", workshopName: "Level 2+" })).toBe(
      "Rimborso 50 € — Corvo — Level 2+",
    );
    expect(auditWhat({ entity: "expense", before: null, after: { amount_cents: 5000, description: "Sala" }, subject: null, workshopName: "Level 2+" })).toBe(
      "Spesa 50 € — Sala — Level 2+",
    );
    expect(auditWhat({ entity: "booking", before: { present: false }, after: { present: true }, subject: "Corvo", workshopName: "W" })).toBe("Presenza — Corvo — W");
  });

  it("prima / dopo solo per i campi cambiati, con valori leggibili; niente chiavi tecniche", () => {
    const changes = auditChanges(
      { id: "x", version: 1, status: "prenotato", notes: "a", agreed_fee_cents: 40000, updated_at: "2026-10-01T10:00:00Z" },
      { id: "x", version: 2, status: "acconto", notes: "a", agreed_fee_cents: 45000, updated_at: "2026-10-02T10:00:00Z" },
    );
    expect(changes).toEqual([
      { key: "status", label: "Stato", before: "Prenotato a parola", after: "Acconto pagato" },
      { key: "agreed_fee_cents", label: "Prezzo", before: "400 €", after: "450 €" },
    ]);
    // Inserimento: solo i campi valorizzati.
    expect(auditChanges(null, { received_by: "redsabbath", method: null, paid_on: "2026-10-28" }).map((c) => [c.label, c.after])).toEqual([
      ["Incassato da", "Ale"],
      ["Data", "28 ott 2026"],
    ]);
    expect(formatAuditValue("fee_custom", true)).toBe("Sì");
  });

  it("nessun campo sensibile: PIN, hash, token, note fiscali", () => {
    for (const key of ["pin", "pin_hash", "token_hash", "ip_hash", "personal_tax_notes", "pin_changed"]) expect(isSensitiveKey(key)).toBe(true);
    const changes = auditChanges(null, { pin_hash: "scrypt$x", token_hash: "ab", personal_tax_notes: "segreto", name: "W" });
    expect(changes.map((c) => c.key)).toEqual(["name"]);
    expect(JSON.stringify(cleanAuditValue({ a: [{ token_hash: "x", ok: 1 }], pin: "123456" }))).toBe('{"a":[{"ok":1}]}');
    expect(auditActionLabel({ entity: "operator", action: "update", after: { pin_changed: true } })).toBe("PIN cambiato");
    expect(auditActionLabel({ entity: "booking", action: "update", after: { present: true } })).toBe("Segnata presente");
    expect(auditActionLabel({ entity: "booking", action: "update", after: { present: false } })).toBe("Tolta la presenza");
    expect(auditActionLabel({ entity: "payment", action: "update", after: { ripristinato: true } })).toBe("Ripristino");
  });
});

describe("storico per l'organizzatrice (etichette; il filtro vero è in gw_audit_list)", () => {
  it("solo iscrizioni, pagamenti, spese, trasferimenti, riporti e stato dei conti", () => {
    expect(auditKindsFor("organizzatrice").map((k) => k.key)).toEqual(["iscrizioni", "pagamenti", "spese", "trasferimenti", "riporti", "conti"]);
    expect(isAuditKind("anagrafica", "organizzatrice")).toBe(false);
    expect(isAuditKind("accessi", "organizzatrice")).toBe(false);
    expect(isAuditKind("anagrafica", "admin")).toBe(true);
  });

  it("chi ha fatto la modifica: il nome agli admin, solo Peony / Ale all'organizzatrice", () => {
    expect(auditOperator({ operatorName: "Laura", operatorRole: "admin" })).toBe("Laura");
    expect(auditOperator({ operatorName: null, operatorRole: "admin" })).toBe("Peony");
    expect(auditOperator({ operatorName: null, operatorRole: "organizzatrice" })).toBe("Ale");
    expect(auditOperator({ operatorName: null, operatorRole: null })).toBe("Script");
  });
});

// ---------------------------------------------------------------------------
// Verifiche a codice
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return name === "__tests__" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("libro soci a codice", () => {
  const read = (path: string) => ({ path: relative(ROOT, join(ROOT, path)).replaceAll("\\", "/"), code: readFileSync(join(ROOT, path), "utf8") });
  const gestionale = ["src/app/gestione", "src/components/gestionale", "src/lib/gestionale"].flatMap(files).map(read);
  const queries = (code: string) => code.match(/\.from\(\s*["']association_members["']\s*\)[\s\S]*?;/g) ?? [];

  it("nessuna query su association_members seleziona codice fiscale, data di nascita o numero di tessera", () => {
    for (const { path, code } of [...gestionale, read("src/lib/association/manual-validation.ts")]) {
      for (const chain of queries(code)) {
        const select = chain.match(/\.select\(([^)]*)\)/)?.[1] ?? "";
        expect(select, path).not.toMatch(/\*|fiscal_code|birth_date|membership_card_number/);
      }
    }
  });

  it("nessuna scrittura su association_members dal gestionale: solo la funzione condivisa delle validazioni manuali (D11)", () => {
    for (const { path, code } of gestionale) {
      for (const chain of queries(code)) expect(chain, path).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);
    }
    // Le nuove importazioni sono procedure di sincronizzazione, richiamate
    // esclusivamente dall'azione admin e senza pulizia automatica dei record.
    const imported = new Set(gestionale.flatMap(({ code }) => code.match(/@\/lib\/association\/[a-z-]+/g) ?? []));
    expect([...imported].sort()).toEqual([
      "@/lib/association/book-upload",
      "@/lib/association/manual-validation",
      "@/lib/association/members-book-sync",
      "@/lib/association/members-sync",
      "@/lib/association/membership-periods",
      "@/lib/association/membership-state",
    ]);
    const action = readFileSync(join(ROOT, "src/app/gestione/(app)/soci/sync/actions.ts"), "utf8");
    expect(action).toContain("await requireAdmin()");
    expect(action).toContain("applyAssociationMembersSync(db, { removeStaleRows: false })");
    expect(action).toContain("applyOfficialMembersBookSync(createSupabaseAdminClient(), { removeStaleRows: false })");
  });

  it("il gestionale non scrive mai su association_members con le funzioni Postgres della Fase 5", () => {
    const migration = readFileSync(join(ROOT, "supabase/migrations/027_gw_functions_v5.sql"), "utf8");
    expect(migration).not.toMatch(/association_members/);
  });
});
