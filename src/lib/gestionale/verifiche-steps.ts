// Pagina Verifiche: conteggi dei passi, letti con le stesse regole delle
// schede "Da verificare" e "Modulo da cercare" di PaymentEmailReview.

export type PaymentForCount = {
  status: string;
  slots: readonly number[];
  availableSlots: number;
  formCheck: "found" | "review" | "missing";
};

/**
 * Pagamenti con almeno una quota ancora da assegnare.
 * - toAssign: c'è da scegliere la persona (o dire che non è una quota);
 * - waitingForm: nessun modulo trovato, si aspetta che la persona lo compili.
 */
export function paymentStepCounts(payments: readonly PaymentForCount[]): { toAssign: number; waitingForm: number } {
  const open = payments.filter((p) => p.status === "pending" && p.slots.length < p.availableSlots);
  const waitingForm = open.filter((p) => p.formCheck === "missing").length;
  return { toAssign: open.length - waitingForm, waitingForm };
}

export type StepState = "done" | "todo" | "unknown";

/** Un passo è fatto quando non resta nulla; senza conteggio non si dichiara nulla. */
export function stepState(count: number | null): StepState {
  if (count === null) return "unknown";
  return count > 0 ? "todo" : "done";
}
