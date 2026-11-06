// Fase 4g, gruppo 3 (parole e frasi): le sostituzioni dell'ipotesi 5, le
// frasi "Devi dare / Peony ti deve / Siete pari", il conflitto con il nome di
// chi ha cambiato e "Aggiorna", gli errori col campo. Dati inventati.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFLICT_MESSAGE, INVALID_FIELDS_MESSAGE, conflictText, isConflictMessage, rpcErrorMessage } from "../errors";
import { importDoneMessage } from "../import-preview";
import { debtPhrase, economicText, settleLabels } from "../recap";
import { residuoPhrase } from "../settlement";

vi.mock("@/lib/gestionale/server/db", () => ({ getGestionaleDb: () => ({ from: query }) }));

let audit: { operator_id: string | null }[] = [];
let role: string | null = "admin";
function query(table: string) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) builder[method] = () => builder;
  builder.maybeSingle = async () => ({ data: role ? { role } : null, error: null });
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: table === "gw_audit_log" ? audit : [], error: null });
  return builder;
}

const ROOT = process.cwd();
function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return name === "__tests__" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const SOURCES = ["src/app/gestione", "src/components/gestionale", "src/lib/gestionale"].flatMap(files).map((path) => ({
  path: relative(ROOT, join(ROOT, path)).replaceAll("\\", "/"),
  // Solo il testo visibile: senza commenti.
  code: readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ""),
}));
const source = (path: string) => readFileSync(join(ROOT, path), "utf8");

beforeEach(() => {
  audit = [];
  role = "admin";
});

describe("ipotesi 5 — parole sostituite ovunque (anche per gli admin)", () => {
  it("niente Rimane, Uscite, Concordato, Eccedenze, Anticipata da, Interpreta, Storna, operatore nei testi", () => {
    const words = /["'>`]\s*(Rimane|Uscite|Concordato|Eccedenze|Anticipata da|Anticipate da|Interpreta|Storna movimento|Operatore connesso|Registra trasferimento di|Registra rimborso)\b/;
    const offenders = SOURCES.filter(({ code }) => words.test(code)).map((f) => f.path);
    expect(offenders).toEqual([]);
    expect(SOURCES.filter(({ code }) => /(?:"|>)[^"<]*\boperatore\b[^"<]*(?:"|<)/.test(code)).map((f) => f.path)).toEqual([]);
  });

  it("riquadri e tabella: Entrate · Spese · Guadagno", () => {
    const recap = source("src/components/gestionale/Recap.tsx");
    expect(recap).toContain('label="Spese"');
    expect(recap).toContain('label="Guadagno"');
    const table = source("src/components/gestionale/HomeControls.tsx");
    expect(table).toContain('label: "Spese"');
    expect(table).toContain('label: "Guadagno"');
  });

  it("totali: Totale prezzi · Ricevuto · Mancano; Pagato in più; frasi intere solo se diversi da zero", () => {
    const bits = source("src/components/gestionale/PaymentBits.tsx");
    for (const text of ["Totale prezzi", "Ricevuto", "Mancano", "Pagato in più:", "Pagato da chi ha cancellato:", "senza prezzo non sono contate."]) {
      expect(bits).toContain(text);
    }
  });

  it("prezzo: 'Prezzo', 'Prezzo speciale · torna al prezzo normale'; Info e Altro", () => {
    const fee = source("src/components/gestionale/FeeEditor.tsx");
    expect(fee).toContain(">Prezzo<");
    expect(fee).toContain("Prezzo speciale");
    expect(fee).toContain("torna al prezzo normale");
    expect(fee.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/tariffa dedicata|Ripristina quota/);
    const page = source("src/app/gestione/(app)/w/[id]/page.tsx");
    expect(page).toContain("Nome e date (si cambiano sul sito)");
    const info = source("src/components/gestionale/WorkshopSettingsForm.tsx");
    expect(info).toContain("Cambia per tutti, tranne i prezzi speciali.");
    expect(info).toContain("Divisione: {PARTY_LABELS.peony}");
    const altro = source("src/app/gestione/(app)/altro/page.tsx");
    expect(altro).toContain("Sei entrata come");
    expect(source("src/components/gestionale/LogoutButton.tsx")).toContain("Esci (poi servirà il PIN)");
    const box = source("src/components/gestionale/TextImport.tsx");
    expect(box).toContain("Leggi il testo");
    expect(box).toContain("Sì, è lei (aggiungo i pagamenti)");
    expect(box).toContain("No, è un'altra persona");
    expect(source("src/components/gestionale/ExpensesBlock.tsx")).toContain('label="Pagata da"');
  });
});

describe("#2, #4, #33 — chi deve dare quanto", () => {
  it("ad Ale in seconda persona, agli admin in terza", () => {
    expect(debtPhrase(95000, "organizzatrice")).toBe("Devi dare 950 € a Peony");
    expect(debtPhrase(-12000, "organizzatrice")).toBe("Peony ti deve 120 €");
    expect(debtPhrase(0, "organizzatrice")).toBe("Siete pari");
    expect(debtPhrase(95000, "admin")).toBe("Ale deve dare 950 € a Peony");
    expect(debtPhrase(-12000, "admin")).toBe("Peony deve dare 120 € ad Ale");
    expect(debtPhrase(0, "admin")).toBe("Pari");
    expect(debtPhrase(null, "organizzatrice")).toBeNull();
    expect(residuoPhrase(95000)).toBe("Ale deve dare 950 € a Peony");
  });

  it("badge: 'Pari' oppure la frase", () => {
    expect(economicText("saldato", 0, "organizzatrice")).toBe("Pari");
    expect(economicText("aperto", 95000, "organizzatrice")).toBe("Devi dare 950 € a Peony");
  });

  it("'Ho dato X € a Peony' con 'L'hai già dato? Lo segno come fatto oggi'", () => {
    expect(settleLabels(95000, "organizzatrice")).toEqual({ button: "Ho dato 950 € a Peony", question: "L'hai già dato? Lo segno come fatto oggi." });
    expect(settleLabels(-12000, "organizzatrice")?.button).toBe("Peony mi ha dato 120 €");
    expect(settleLabels(95000, "admin")?.button).toBe("Ale ha dato 950 € a Peony");
    expect(settleLabels(0, "organizzatrice")).toBeNull();
    expect(settleLabels(null, "admin")).toBeNull();
  });
});

describe("#19 — conflitto: chi ha cambiato e 'Aggiorna'", () => {
  it("frasi senza 'operatore' né 'ricarica'", () => {
    expect(CONFLICT_MESSAGE).not.toMatch(/operatore|ricarica/i);
    expect(conflictText("Peony", "questa iscrizione")).toBe("Peony ha appena cambiato questa iscrizione.");
    expect(conflictText("io", "questa iscrizione")).toBe("Hai appena cambiato questa iscrizione da un'altra schermata.");
    expect(conflictText(null, "questa iscrizione")).toBe(CONFLICT_MESSAGE);
    for (const text of [CONFLICT_MESSAGE, conflictText("Ale", "il prezzo del workshop"), conflictText("io", "x")]) expect(isConflictMessage(text)).toBe(true);
    expect(isConflictMessage("Fatto: pagamento registrato.")).toBe(false);
    expect(rpcErrorMessage({ code: "GW409" })).toBe(CONFLICT_MESSAGE);
  });

  it("sul server: dall'ultima riga dello storico, solo Peony / Ale (mai il nome)", async () => {
    const { explainConflict } = await import("../server/conflicts");
    const conflict = { ok: false as const, error: CONFLICT_MESSAGE };
    audit = [{ operator_id: "laura" }];
    expect(await explainConflict(conflict, "b1", "ale", "questa iscrizione")).toEqual({ ok: false, error: "Peony ha appena cambiato questa iscrizione." });
    audit = [{ operator_id: "ale" }];
    expect((await explainConflict(conflict, "b1", "ale", "questa iscrizione")).ok).toBe(false);
    expect(await explainConflict(conflict, "b1", "ale", "questa iscrizione")).toEqual({
      ok: false,
      error: "Hai appena cambiato questa iscrizione da un'altra schermata.",
    });
    expect(await explainConflict({ ok: false, error: "Altro errore." }, "b1", "ale", "x")).toEqual({ ok: false, error: "Altro errore." });
  });

  it("Notice aggiunge 'Aggiorna' ai messaggi di conflitto", () => {
    expect(source("src/components/gestionale/ui.tsx")).toContain("isConflictMessage(children) ? <ConflictRefresh /> : null");
    expect(source("src/components/gestionale/ConflictRefresh.tsx")).toContain("router.refresh()");
  });
});

describe("#20, #42 — errori col campo, esiti in seconda persona", () => {
  it("valori non validi: si dice quale campo controllare", () => {
    expect(rpcErrorMessage({ code: "23514" })).toBe(INVALID_FIELDS_MESSAGE);
    expect(INVALID_FIELDS_MESSAGE).not.toBe("Dati non validi: controlla i campi.");
    const actions = source("src/app/gestione/(app)/w/registration-actions.ts");
    expect(actions).toContain("Importo: scrivi un numero, es. 250.");
    expect(actions).toContain("Prezzo: scrivi un numero, es. 450 o 450,50.");
    expect(source("src/components/gestionale/PaymentForm.tsx")).toContain("amountMissing");
  });

  it("'Fatto: 3 nuove, 1 aggiornata, 4 pagamenti'", () => {
    expect(importDoneMessage(3, 1, 4)).toBe("Fatto: 3 nuove, 1 aggiornata, 4 pagamenti.");
    expect(importDoneMessage(1, 0, 1)).toBe("Fatto: 1 nuova, 1 pagamento.");
    expect(importDoneMessage(0, 0, 0)).toBe("Fatto.");
  });
});
