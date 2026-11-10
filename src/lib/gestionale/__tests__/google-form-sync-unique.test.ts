import { describe, expect, it } from "vitest";
import { distinctStoredGoogleForms, isGoogleFormImportSuspicious } from "@/lib/association/form-import-integrity";

describe("sincronizzazione Google: confronto delle registrazioni distinte", () => {
  it("non blocca 459 moduli distinti quando 714 righe storiche rappresentano 456 registrazioni", () => {
    const stored = Array.from({ length: 456 }, (_, i) => ({
      id: `form-${i}`,
      source_row_id: String(i + 2),
      email: `person-${i}@example.test`,
    }));
    const duplicateCopies = stored.slice(0, 258).map((row, i) => ({
      ...row, id: `old-copy-${i}`,
    }));
    const rows = [...stored, ...duplicateCopies];
    expect(rows).toHaveLength(714);
    const unique = distinctStoredGoogleForms(rows);
    expect(unique).toBe(456);
    expect(isGoogleFormImportSuspicious(459, unique)).toBe(false);
    // Il confronto precedente bloccava erroneamente la stessa importazione.
    expect(isGoogleFormImportSuspicious(459, rows.length)).toBe(true);
  });

  it("blocca una vera perdita della maggior parte delle risposte", () => {
    expect(isGoogleFormImportSuspicious(100, 456)).toBe(true);
    expect(isGoogleFormImportSuspicious(456, 456)).toBe(false);
    expect(isGoogleFormImportSuspicious(0, 0)).toBe(false);
  });

  it("non confonde righe senza ID e conserva le identità di fonte diversa", () => {
    expect(distinctStoredGoogleForms([
      {id:"a",source_row_id:"424",email:"liliia@example.test"},
      {id:"b",source_row_id:"424",email:"liliia@example.test"},
      {id:"c",source_row_id:"eng:424",email:"other@example.test"},
      {id:"d",source_row_id:null,email:"third@example.test"},
      {id:"e",source_row_id:null,email:"THIRD@example.test"},
      {id:"f",source_row_id:null,email:null},
    ])).toBe(4);
  });
});
