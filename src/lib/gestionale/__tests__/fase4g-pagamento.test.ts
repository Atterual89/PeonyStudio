// Fase 4g, gruppo 2 (pagamento più veloce): ricerca, "+ Pagamento", tipo
// dedotto, metodo proposto, Modifica senza "Storna", correzioni solo agli
// admin, "Ho restituito", Aggiungi compatto. Database simulato, dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { emptyPaymentDraft, draftFromPayment } from "@/components/gestionale/PaymentForm";

import { deducedPaymentType, lastUsedMethod } from "../payments";
import { matchesSearch } from "../registrations";
import type { Payment } from "../types";

vi.mock("@/lib/gestionale/server/auth", () => ({ requireOperator: async () => ({ id: "op", role: "organizzatrice" }) }));

const OP = "00000000-0000-4000-8000-0000000000c1";
let rows: unknown[] = [];
const calls: [string, unknown[]][] = [];
function query() {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "is", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null });
  return builder;
}
vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query }) }));

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

beforeEach(() => {
  rows = [];
  calls.length = 0;
});

describe("ipotesi 1 — tipo dedotto", () => {
  it("manca ancora qualcosa → acconto; quota raggiunta o superata → saldo", () => {
    expect(deducedPaymentType(0, 25000, 50000)).toBe("acconto");
    expect(deducedPaymentType(25000, 25000, 50000)).toBe("saldo");
    expect(deducedPaymentType(0, 60000, 50000)).toBe("saldo");
    expect(deducedPaymentType(30000, 10000, 50000)).toBe("acconto");
  });

  it("senza quota o senza importo → acconto; rimborso → altro", () => {
    expect(deducedPaymentType(0, 25000, null)).toBe("acconto");
    expect(deducedPaymentType(0, null, 50000)).toBe("acconto");
    expect(deducedPaymentType(0, 25000, 50000, "rimborso")).toBe("altro");
  });

  it("il modulo parte dal tipo dedotto; un pagamento esistente tiene il suo (scelto)", () => {
    const auto = (cents: number | null) => deducedPaymentType(25000, cents, 50000);
    const draft = emptyPaymentDraft("2026-11-02", { amountCents: 25000, method: "paypal" }, auto);
    expect(draft).toMatchObject({ amount: "250", paymentType: "saldo", typeChosen: false, method: "paypal", receivedBy: "redsabbath" });
    expect(emptyPaymentDraft("2026-11-02", {}, auto).paymentType).toBe("acconto");
    const payment: Payment = {
      id: "p",
      kind: "pagamento",
      amountCents: 20000,
      paymentType: "altro",
      paidOn: null,
      method: "contanti",
      receivedBy: "peony",
      description: null,
      correctsPaymentId: null,
      createdAt: "2026-10-01T10:00:00Z",
    };
    expect(draftFromPayment(payment)).toMatchObject({ paymentType: "altro", typeChosen: true });
  });

  it("Tipo e Note in 'altro…', 'Incassato da Ale · cambia' in una riga piccola", () => {
    const form = source("src/components/gestionale/PaymentForm.tsx");
    expect(form).toContain('{more ? "meno" : "altro…"}');
    expect(form).toContain("cambia");
    expect(form).not.toMatch(/Storna|reverseMovement/);
    expect(form).toContain('"Salva modifica"');
    expect(form).toContain("Elimina pagamento");
  });
});

describe("#10 — metodo proposto = ultimo usato da quell'operatore", () => {
  const base = { kind: "pagamento" as const, createdAt: "2026-10-01T10:00:00Z" };
  it("l'ultimo pagamento con metodo registrato da lui, non da altri", () => {
    const payments = [
      { ...base, method: "contanti" as const, createdBy: OP, createdAt: "2026-10-01T10:00:00Z" },
      { ...base, method: "paypal" as const, createdBy: OP, createdAt: "2026-10-03T10:00:00Z" },
      { ...base, method: "bonifico" as const, createdBy: "altro", createdAt: "2026-10-05T10:00:00Z" },
      { ...base, method: null, createdBy: OP, createdAt: "2026-10-06T10:00:00Z" },
      { ...base, kind: "rimborso" as const, method: "contanti" as const, createdBy: OP, createdAt: "2026-10-07T10:00:00Z" },
    ];
    expect(lastUsedMethod(payments, OP)).toBe("paypal");
    expect(lastUsedMethod(payments, "nessuno")).toBeNull();
  });

  it("lettura sul server: solo i pagamenti di quell'operatore, con metodo, non eliminati, il più recente", async () => {
    const { getLastPaymentMethod } = await import("../server/registrations");
    rows = [{ kind: "pagamento", method: "bonifico", created_by: OP, created_at: "2026-10-09T10:00:00Z" }];
    expect(await getLastPaymentMethod(OP)).toBe("bonifico");
    expect(calls).toContainEqual(["eq", ["created_by", OP]]);
    expect(calls).toContainEqual(["eq", ["kind", "pagamento"]]);
    expect(calls).toContainEqual(["is", ["deleted_at", null]]);
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
    rows = [];
    expect(await getLastPaymentMethod(OP)).toBeNull();
    expect(await getLastPaymentMethod("non-un-id")).toBeNull();
  });
});

describe("#7 — Cerca un nome", () => {
  const reg = (enteredAs: string, enteredEmail: string | null = null) => ({
    people: [{ participantId: "p", isPrimary: true, enteredAs, enteredEmail, alreadyAs: null }],
  });
  it("filtro sul testo di Ale, senza accenti né maiuscole", () => {
    expect(matchesSearch(reg("Claudia"), "cla")).toBe(true);
    expect(matchesSearch(reg("Clàudia Neri"), "CLAU ner")).toBe(true);
    expect(matchesSearch(reg("Dalia"), "cla")).toBe(false);
    expect(matchesSearch(reg("Dalia", "dalia@esempio.it"), "esempio")).toBe(true);
    expect(matchesSearch(reg("Dalia"), "  ")).toBe(true);
  });
});

describe("#8, #11–#13, #16, #21 — riga, elenco e Aggiungi", () => {
  const tab = source("src/components/gestionale/RegistrationsTab.tsx");
  it("'+ Pagamento' sulla riga chiusa, Pagamenti aperti di default, ricerca e Aggiungi in alto", () => {
    expect(tab).toContain("+ Pagamento");
    expect(tab).toContain("useState(true);");
    expect(tab).toContain('label="Cerca un nome"');
    expect(tab.indexOf("<AddRegistration")).toBeLessThan(tab.indexOf('label="Cerca un nome"'));
    expect(tab.indexOf("<AddRegistration")).toBeLessThan(tab.indexOf("visible.flatMap"));
  });

  it("Ale vede solo i pagamenti validi; le correzioni solo agli admin", () => {
    expect(tab).not.toContain("showCorrections");
    expect(source("src/components/gestionale/AccountsTab.tsx")).toContain("showCorrections={isAdmin}");
    const bits = source("src/components/gestionale/PaymentBits.tsx");
    expect(bits).toContain("showCorrections && corrections > 0");
    expect(bits).toContain("showCorrections && entry.modified");
  });

  it("'Ho restituito dei soldi' e 'Ho restituito X € a questa persona'", () => {
    expect(tab).toContain('"Ho restituito dei soldi"');
    expect(tab).toContain("Ho restituito {total} a questa persona");
    expect(tab).not.toContain("Registra rimborso");
  });

  it("Aggiungi: Nome · Partner · Stato · + Pagamento; email, note e prezzo speciale in 'altro…'", () => {
    const add = source("src/components/gestionale/AddRegistration.tsx");
    expect(add).toContain("Quanto ha già pagato?");
    expect(add).toContain("altro… (email, note, prezzo speciale)");
    const visible = add.slice(add.indexOf("<h3"), add.indexOf("{more ? ("));
    expect(visible).not.toContain("<FeeEditor");
    expect(visible).not.toContain('type="email"');
    expect(visible).toContain("<StatusPicker");
    expect(visible).toContain("dateInMore");
  });
});
