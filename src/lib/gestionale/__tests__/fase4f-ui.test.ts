// Fase 4f, parte 1b: interfaccia compatta. Le misure stanno in un unico punto
// (UI in ui.tsx) e nessun componente del gestionale torna ai 44–48 px.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { UI, buttonClass, inputClass, shortDateLabel } from "@/components/gestionale/ui";

const ROOT = process.cwd();
const COMPONENTS = join(ROOT, "src/components/gestionale");

describe("misure compatte (4f)", () => {
  it("campi e menu 40 px con testo 15 px, etichette 12 px, card 12 px", () => {
    expect(UI.control).toBe("h-10 text-[15px]");
    expect(inputClass).toContain(UI.control);
    expect(UI.label).toContain("text-xs");
    expect(UI.label).toContain("mb-1");
    expect(UI.pad).toBe("p-3");
  });

  it("pulsanti: principali 40 px, secondari 36 px e piccoli 32 px con area di tocco di 40 px", () => {
    expect(buttonClass.primary).toContain("h-10");
    for (const name of ["secondary", "ghost", "danger"] as const) {
      expect(buttonClass[name]).toContain("h-9");
      expect(buttonClass[name]).toContain(UI.touch36);
    }
    expect(buttonClass.small).toContain("h-8");
    expect(buttonClass.small).toContain(UI.touch32);
  });

  it("nessun componente usa più le vecchie altezze (44–48 px), salvo il tastierino del PIN e la barra in basso (icona + nome)", () => {
    const offenders = readdirSync(COMPONENTS)
      .filter((file) => file.endsWith(".tsx") && file !== "PinPad.tsx" && file !== "GestioneNav.tsx")
      .filter((file) => /\b(min-h-1[12]|h-1[12])\b/.test(readFileSync(join(COMPONENTS, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("data compatta", () => {
  it("oggi, giorno e mese (anno se diverso), nessuna", () => {
    expect(shortDateLabel("2026-10-29", "2026-10-29")).toBe("oggi");
    expect(shortDateLabel("2026-10-28", "2026-10-29")).toBe("28 ott");
    expect(shortDateLabel("2025-12-30", "2026-01-02")).toBe("30 dic 25");
    expect(shortDateLabel("", "2026-10-29")).toBe("nessuna");
  });
});
