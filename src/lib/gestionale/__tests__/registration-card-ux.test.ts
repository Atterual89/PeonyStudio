import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const tab = read("src/components/gestionale/RegistrationsTab.tsx");
const payment = read("src/components/gestionale/PaymentForm.tsx");

describe("Schede iscrizioni di Ale: confini, orientamento e chiusura", () => {
  it("evidenzia il nominativo e separa ogni scheda aperta dalle altre", () => {
    expect(tab).toContain('font-serif text-[22px] font-semibold');
    expect(tab).toContain('space-y-4');
    expect(tab).toContain('border-[#a8583e]/55');
    expect(tab).toContain('bg-[#f7f3ec]');
    expect(tab).toContain("Chiudi scheda");
  });

  it("all'apertura scorre al nominativo e impedisce al pagamento di rubare il focus", () => {
    expect(tab).toContain('scroll-mt-24');
    expect(tab).toContain('scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })');
    expect(tab).toContain("}, [openId, paymentStart?.n]);");
    expect(tab).toContain("autoFocus={false}");
    expect(payment).toContain("autoFocus?: boolean;");
    expect(payment).toContain("autoFocus={autoFocus}");
  });

  it("dopo conferma riuscita chiude la scheda e conserva la riga in vista", () => {
    expect(tab).toContain("function closeAfterSave(id: string, message: string)");
    expect(tab).toContain("setOpenId(null);");
    expect(tab).toContain("setPaymentStart(null);");
    expect(tab).toContain('onSaved={(message) => closeAfterSave(registration.bookingId, message)}');
    expect(tab).toContain('onSaved?.("Prezzo salvato.")');
    expect(tab).toContain("onSaved?.(text)");
    expect(tab).toContain("if (field !== \"notes\") onSaved?");
    expect(tab).toContain("role=\"status\"");
  });

  it("non chiude in caso di errore o mentre si richiede ancora il pagamento per cambiare stato", () => {
    expect(tab).toContain("if (!justified) return;");
    const run = tab.slice(tab.indexOf("function run(field: SavedField"), tab.indexOf("function saveRegistration"));
    expect(run.indexOf("onSaved?.")).toBeGreaterThan(run.indexOf("if (result.ok)"));
    expect(run.indexOf("onSaved?.")).toBeLessThan(run.indexOf("} else {"));
    const form = payment.slice(payment.indexOf("function submit()"), payment.indexOf("const cents = parseEuroToCents",payment.indexOf("function submit()")));
    expect(form).toContain("if (!result.ok)");
    expect(form).toContain("onDone(kind ===");
  });
});
