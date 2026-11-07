import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Regole di leggibilità delle schede Peony su schermi piccoli. */
describe("schede partecipanti ed email Peony senza informazioni ridondanti", () => {
  const source = readFileSync(
    join(process.cwd(), "src/components/gestionale/PeonyEventOperations.tsx"),
    "utf8",
  );

  it("mostra uno stato breve senza ripetere la verifica nel riepilogo", () => {
    expect(source).toContain('info.status === "valid" ? "Verificata"');
    expect(source).not.toContain("Verificata per il periodo dell'evento");
    expect(source).not.toContain("Quota verificata per il periodo");
    expect(source).not.toContain("Biglietto Ticket Tailor</span>");
  });

  it("conserva scadenza, modulo, quota, partner e dati ordine su richiesta", () => {
    for (const detail of [
      "Dettagli associazione",
      "Tessera fino al",
      "Modulo:",
      "Quota:",
      "Abbinamento:",
      "Partner:",
      "Dati biglietto",
      "Ordine:",
    ]) expect(source).toContain(detail);
  });

  it("specifica a quale persona si riferiscono i dettagli associativi", () => {
    expect(source).toContain("Dettagli associazione · {ownerLabel}");
    expect(source).toContain("ownerLabel={person.name}");
    expect(source).toContain('Partner: ${partnerLabel}');
  });

  it("non mostra l'anteprima email finché non viene richiesta", () => {
    expect(source).toContain("<details className=\"mt-3 border-t");
    expect(source).toContain("Anteprima HTML");
    expect(source).toContain("Modifica selezione");
    expect(source).toContain("Copia per Gmail");
  });
});
