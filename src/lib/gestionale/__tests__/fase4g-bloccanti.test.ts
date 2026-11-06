// Fase 4g, gruppo 1 (bloccanti per Ale): PIN, Modifica visibile, Annulla per
// 30 secondi, bozza del box di testo. Dati inventati.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { UNDO_MAX_SECONDS, UNDO_SECONDS, undoShouldHide } from "../deletions";
import { DRAFT_DAYS, draftExpired, draftKey, draftPrompt, draftStorage, readDraft, serializeDraft } from "../draft";
import { PIN_HELP } from "../labels";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("#1 — PIN", () => {
  it("sotto l'errore generico, cosa fare", () => {
    expect(PIN_HELP).toBe("Se non riesci a entrare, aspetta 15 minuti o scrivi a Laura.");
    expect(source("src/components/gestionale/PinPad.tsx")).toContain("{PIN_HELP}");
  });
});

describe("#11 — Modifica visibile", () => {
  it("Modifica è un pulsante sulla riga del pagamento, non una voce del menu …", () => {
    const tab = source("src/components/gestionale/RegistrationsTab.tsx");
    const actions = tab.slice(tab.indexOf("function PaymentActions"), tab.indexOf("function RefundPaid"));
    expect(actions).toMatch(/>\s*Modifica\s*<\/button>/);
    const menu = actions.slice(actions.indexOf("<RowMenu"));
    expect(menu).not.toContain('"Modifica"');
    expect(menu).toContain('"Elimina"');
  });
});

describe("#18 — Eliminato · Annulla", () => {
  it("almeno 30 secondi, poi resta finché non si tocca altro (al massimo 10 minuti, come il server)", () => {
    expect(UNDO_SECONDS).toBe(30);
    expect(UNDO_MAX_SECONDS).toBe(600);
    expect(undoShouldHide(5, true)).toBe(false);
    expect(undoShouldHide(29, true)).toBe(false);
    expect(undoShouldHide(31, false)).toBe(false);
    expect(undoShouldHide(120, false)).toBe(false);
    expect(undoShouldHide(30, true)).toBe(true);
    expect(undoShouldHide(600, false)).toBe(true);
  });

  it("il messaggio compare vicino alla riga (UndoSlot) per pagamenti e iscrizioni di Ale", () => {
    const tab = source("src/components/gestionale/RegistrationsTab.tsx");
    expect(tab).toContain("<UndoSlot scope={`payments:${registration.bookingId}`} />");
    expect(tab).toContain("undoScope={`payments:${registration.bookingId}`}");
    expect(tab).toContain("undoScope={`booking:${registration.bookingId}`}");
    expect(tab).toContain("<UndoSlot scope={`booking:${deleted.id}`} />");
  });
});

describe("#23 — bozza del box di testo", () => {
  const row = {
    key: 0,
    line: 1,
    original: "Claudia 250 paypal",
    people: ["Claudia"],
    emails: [null],
    include: true,
    feeText: "500",
    payments: [{ amountText: "250", paymentType: "acconto", typeAuto: true, method: "paypal", paidOn: "", receivedBy: "redsabbath", removed: false, parsed: null, extra: "x" }],
    // Campi non previsti (es. risposte del server su altre iscrizioni): si scartano.
    serverMatch: { bookingId: "b1", enteredAs: "Claudia Rossi" },
    registrations: [{ enteredAs: "Altra persona" }],
  };

  it("chiave per workshop e operatore", () => {
    expect(draftKey("w1", "op1")).toBe("gw-bozza:w1:op1");
    expect(draftKey("w1", "op2")).not.toBe(draftKey("w1", "op1"));
  });

  it("conservata e ripresa: testo e anteprima, niente dati altrui", () => {
    const raw = serializeDraft("Claudia 250 paypal", [row], "2026-10-29T09:00:00Z")!;
    expect(raw).not.toContain("Claudia Rossi");
    expect(raw).not.toContain("Altra persona");
    expect(raw).not.toContain("extra");
    const draft = readDraft<typeof row>(raw, "2026-10-30")!;
    expect(draft.text).toBe("Claudia 250 paypal");
    expect(draft.rows).toHaveLength(1);
    expect(draft.rows![0]).not.toHaveProperty("serverMatch");
    expect(draft.rows![0].people).toEqual(["Claudia"]);
    expect(draftPrompt(draft.savedAt)).toBe("Hai un testo non salvato del 29 ott");
  });

  it("svuotata: niente da conservare", () => {
    expect(serializeDraft("", null, "2026-10-29T09:00:00Z")).toBeNull();
    expect(serializeDraft("   ", null, "2026-10-29T09:00:00Z")).toBeNull();
    expect(readDraft(null, "2026-10-29")).toBeNull();
  });

  it("scaduta dopo 7 giorni; non valida = ignorata", () => {
    expect(DRAFT_DAYS).toBe(7);
    const raw = serializeDraft("Claudia 250 paypal", null, "2026-10-22T10:00:00Z")!;
    expect(readDraft(raw, "2026-10-29")).not.toBeNull();
    expect(readDraft(raw, "2026-10-30")).toBeNull();
    expect(draftExpired("2026-10-22T23:30:00Z", "2026-10-30")).toBe(false); // 23 ott a Roma
    expect(readDraft("non json", "2026-10-29")).toBeNull();
    expect(readDraft(JSON.stringify({ v: 9, savedAt: "2026-10-29T09:00:00Z", text: "x", rows: null }), "2026-10-29")).toBeNull();
  });

  it("il componente legge e scrive solo con draftStorage (try/catch) e la cancella al salvataggio", () => {
    const box = source("src/components/gestionale/TextImport.tsx");
    expect(box).not.toMatch(/window\.localStorage/);
    expect(box).toContain("draftStorage.set(storageKey, null)");
    expect(box).toContain("Riprendi");
    expect(box).toContain("Svuota");
    const storage = source("src/lib/gestionale/draft.ts");
    expect(storage.match(/window\.localStorage/g)).toHaveLength(4);
    expect(storage.match(/try \{/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it("Fase 6: cancellata all'uscita (tutte le bozze del gestionale, nient'altro)", () => {
    const items = new Map([
      [draftKey("w1", "op1"), "a"],
      [draftKey("w2", "op1"), "b"],
      ["lingua-del-sito", "it"],
    ]);
    const localStorage = {
      get length() {
        return items.size;
      },
      key: (index: number) => [...items.keys()][index] ?? null,
      removeItem: (key: string) => void items.delete(key),
    };
    const globals = globalThis as { window?: unknown };
    globals.window = { localStorage };
    try {
      draftStorage.clearAll();
    } finally {
      delete globals.window;
    }
    expect([...items.keys()]).toEqual(["lingua-del-sito"]);
    // Senza window (o con lo storage bloccato) non lancia.
    expect(() => draftStorage.clearAll()).not.toThrow();

    const logout = source("src/components/gestionale/LogoutButton.tsx");
    expect(logout).toContain("onSubmit={() => draftStorage.clearAll()}");
    expect(source("src/app/gestione/(app)/altro/page.tsx")).toContain("<LogoutButton action={logoutAction} />");
  });
});
