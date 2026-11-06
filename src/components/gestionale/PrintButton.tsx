"use client";

import { Printer } from "lucide-react";

import { buttonClass } from "./ui";

/** Pagina di stampa del consuntivo: "Salva come PDF" è quello del browser (D8). */
export function PrintButton() {
  return (
    <button type="button" className={`${buttonClass.primary} print:hidden`} onClick={() => window.print()}>
      <Printer className="h-5 w-5" aria-hidden="true" /> Stampa / Salva come PDF
    </button>
  );
}
