"use client";

import { useState } from "react";

import { parseEuroToCents } from "@/lib/gestionale/format";
import { feeChangeImpact, feeChangeQuestion, type FeeRow } from "@/lib/gestionale/payments";

/**
 * 4g (#40): prima di cambiare il prezzo del workshop, la domanda "Cambia il
 * prezzo di N iscrizioni (non quelle con prezzo speciale). M non risulteranno
 * più pagate. Confermi?". `check` restituisce true se si può salvare subito
 * (prezzo non valido, lo dirà il server, o nessuna iscrizione toccata).
 */
export function useFeeChangeConfirm(rows: readonly FeeRow[]) {
  const [question, setQuestion] = useState<string | null>(null);

  function check(feeText: string): boolean {
    const cents = parseEuroToCents(feeText);
    if (cents === null) return true;
    const asked = feeChangeQuestion(feeChangeImpact(rows, cents));
    if (!asked) return true;
    setQuestion(asked);
    return false;
  }

  return { question, check, clear: () => setQuestion(null) };
}
