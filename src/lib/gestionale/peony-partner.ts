/** Lettura non invasiva delle risposte Ticket Tailor per il partner. */
export type CheckoutPartner = { name: string | null; email: string | null; source: "ticket_tailor" };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function partnerFromCheckout(rawPayload: unknown): CheckoutPartner | null {
  if (!isObject(rawPayload) || !isObject(rawPayload.buyer_details)) return null;
  const fields = rawPayload.buyer_details.custom_questions;
  if (!Array.isArray(fields)) return null;
  for (const item of fields) {
    if (!isObject(item) || typeof item.question !== "string") continue;
    const q = item.question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Non confondere le domande di consenso con quella di identificazione partner.
    if (!q.includes("persona con cui") && !q.includes("nome e cognome") && !q.includes("nome del partner")) continue;
    const answer = typeof item.answer === "string" ? item.answer.trim() : "";
    if (!answer || /^(partner|non so|non lo so|da definire|n\/a)$/i.test(answer)) continue;
    if (answer.includes("@")) return { name: null, email: answer, source: "ticket_tailor" };
    return { name: answer, email: null, source: "ticket_tailor" };
  }
  return null;
}

export function peonyPartnerRequired(eventTitle: string, ticketType: string | null): boolean {
  if (/(observer|osservator)/i.test(ticketType ?? "")) return false;
  const title = eventTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_]+/g, " ");
  return !["rope jam", "open day", "pratica assistita", "aperi bottom", "aperibottom"].some((word) => title.includes(word));
}
