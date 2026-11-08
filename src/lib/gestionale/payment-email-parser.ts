/** Pure parsers for received PayPal/Qonto notifications. Never infer payment from amount alone. */
export type PaymentCandidate = {
  provider: "paypal" | "qonto";
  transactionRef: string | null;
  payerName: string | null;
  amountCents: number;
  note: string | null;
};
const normalize = (s: string) => s.replace(/\r/g, "").replace(/\u00a0/g, " ");
const cents = (s: string): number | null => {
  const clean = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
};
const line = (body: string, pattern: RegExp): string | null =>
  body.match(pattern)?.[1]?.trim() || null;

export function parsePaymentNotification(input: {
  from: string; subject: string; body: string;
}): PaymentCandidate | null {
  const body = normalize(input.body);
  const parsedEmail = input.from.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1]
    ?? input.from.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]
    ?? "";
  const senderDomain = parsedEmail.toLowerCase().split("@").at(-1) ?? "";
  const isPayPal = senderDomain === "paypal.com" || senderDomain === "paypal.it" ||
    senderDomain.endsWith(".paypal.com") || senderDomain.endsWith(".paypal.it");
  const isQonto = senderDomain === "qonto.com" || senderDomain.endsWith(".qonto.com");
  const subject = input.subject.toLowerCase();
  if (subject.includes("hai ricevuto denaro") && isPayPal) {
    const match = body.match(/([^\n]{2,120}?)\s+ti ha inviato\s+([\d.,]+)\s*€\s*EUR/i);
    const amount = match ? cents(match[2]) : null;
    if (!amount) return null;
    return {
      provider: "paypal",
      payerName: match![1].trim(),
      amountCents: amount,
      transactionRef: line(body, /Codice transazione\s*\n\s*\[?([A-Z0-9]{12,25})/i),
      note: line(body, /Messaggio da [^\n]+\n([^\n]+)/i),
    };
  }
  if (subject === "hai ricevuto un bonifico" && isQonto) {
    const amount = cents(line(body, /Importo:?\s*([\d.,]+)\s*(?:EUR|€)/i) || "");
    const payer = line(body, /^Da:?\s*([^\n]+)/im);
    // Stripe transfers are settlements, not individual membership payments.
    if (!amount || !payer || /^(stripe|paypal)\b/i.test(payer)) return null;
    return { provider: "qonto", payerName: payer, amountCents: amount,
      transactionRef: null, note: null };
  }
  return null;
}

/** Suggest, never confirm, possible fee payments. Net PayPal receipts may be smaller. */
export function suggestedQuotaCount(candidate: PaymentCandidate): number {
  if (candidate.amountCents === 1500) return 1;
  if (candidate.amountCents === 3000) return 2;
  if (candidate.amountCents === 4500) return 3;
  if (candidate.provider === "paypal") {
    for (const count of [1, 2, 3]) {
      const nominal = count * 1500;
      if (candidate.amountCents >= Math.floor(nominal * 0.92) &&
          candidate.amountCents < nominal) return count;
    }
  }
  return 0;
}
