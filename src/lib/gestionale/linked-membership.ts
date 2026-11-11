// Fase C audit anagrafica: stato socio calcolato dalle prove GIÀ collegate alla
// persona (gw_person_sources), senza confrontare nomi o email.
//
// Regole identiche a deriveMembershipState (src/lib/association/membership-state.ts):
// - il modulo Google (o cartaceo verificato) prova la registrazione e non scade;
// - la quota conta se è verificata, cade nell'annualità dell'evento
//   (membership-periods.ts, regola del 1 settembre), è iniziata entro la data
//   dell'evento e scade dopo;
// - il libro ufficiale TeamArtist non conta (solo archivio).

import { FIRST_MEMBERSHIP_PERIOD, membershipPeriodFor } from "@/lib/association/membership-periods";

import { formatShortDate } from "./membership-rule";

export type LinkedEvidence =
  | { kind: "form" }
  | {
      kind: "fee";
      /** Inizio validità (YYYY-MM-DD): data della quota manuale o inizio annualità della quota email. */
      startsAt: string | null;
      /** Fine validità inclusa (YYYY-MM-DD). */
      expiresAt: string | null;
      verified: boolean;
      method: "manual" | "payment_email";
    };

export type LinkedMembershipState = {
  status: "valid" | "payment_missing" | "missing_form";
  formPresent: boolean;
  feePaid: boolean;
  expiresAt: string | null;
  method: "manual" | "payment_email" | null;
};

export function linkedMembershipState(evidence: readonly LinkedEvidence[], eventDate: string): LinkedMembershipState {
  const day = eventDate.slice(0, 10);
  const period = membershipPeriodFor(day);
  const formPresent = evidence.some((item) => item.kind === "form");
  const fees = evidence.filter((item): item is Extract<LinkedEvidence, { kind: "fee" }> =>
    item.kind === "fee" && Boolean(period) && feeCovers(item, period!.paymentsFrom, period!.validUntil, day));
  // Più quote valide (es. 2026 e rinnovo 2027): la scadenza più lunga, a parità la email.
  const fee = [...fees].sort((a, b) =>
    (b.expiresAt ?? "").localeCompare(a.expiresAt ?? "") ||
    Number(b.method === "payment_email") - Number(a.method === "payment_email"))[0];
  return {
    status: formPresent && fee ? "valid" : !formPresent ? "missing_form" : "payment_missing",
    formPresent,
    feePaid: Boolean(fee),
    expiresAt: fee?.expiresAt?.slice(0, 10) ?? null,
    method: fee?.method ?? null,
  };
}

function feeCovers(fee: Extract<LinkedEvidence, { kind: "fee" }>, from: string, until: string, day: string): boolean {
  const starts = fee.startsAt?.slice(0, 10);
  const expires = fee.expiresAt?.slice(0, 10);
  return fee.verified && Boolean(starts && expires) &&
    starts! >= from && starts! <= day && starts! <= until && expires! >= day;
}

/**
 * Ultimo giorno dell'annualità che parte da period_from (allocazioni delle
 * quote email, come la migrazione 043): 2025-09-01 → 2026-12-31, poi
 * AAAA-09-01 → (AAAA+1)-12-31. Non è membershipPeriodFor: il 1 settembre 2026
 * cade ancora nella prima annualità, ma come inizio è quella del 2027.
 */
export function periodUntilFrom(periodFrom: string): string | null {
  const day = periodFrom.slice(0, 10);
  if (day === FIRST_MEMBERSHIP_PERIOD.paymentsFrom) return FIRST_MEMBERSHIP_PERIOD.validUntil;
  if (!/^\d{4}-09-01$/.test(day) || day < FIRST_MEMBERSHIP_PERIOD.paymentsFrom) return null;
  return `${Number(day.slice(0, 4)) + 1}-12-31`;
}

// ---------------------------------------------------------------------------
// Pallino della pagina evento
// ---------------------------------------------------------------------------

export type EventDotColor = "verde" | "rosso" | "giallo";

export type EventDot = {
  color: EventDotColor;
  /** Motivo in una riga, come lo legge l'admin. */
  reason: string;
  expiresAt: string | null;
};

export function eventDot(input: {
  /** Stato della riga di registro della fonte (iscrizione o biglietto). */
  link: "collegata" | "da_confermare" | "assente";
  /** Nota del registro per le righe da confermare. */
  note?: string | null;
  /** La persona collegata ha email oppure nome e cognome. */
  hasIdentity: boolean;
  state: LinkedMembershipState | null;
  eventDate: string;
}): EventDot {
  if (input.link === "assente") {
    return { color: "giallo", reason: "Da chiarire: non ancora collegata a una persona", expiresAt: null };
  }
  if (input.link === "da_confermare" || !input.state) {
    return { color: "giallo", reason: `Da chiarire: ${input.note ?? "persona da confermare"}`, expiresAt: null };
  }
  const state = input.state;
  if (!input.hasIdentity && !state.formPresent) {
    return { color: "giallo", reason: "Solo nickname: mancano email o nome e cognome", expiresAt: null };
  }
  if (state.status === "valid") {
    return {
      color: "verde",
      reason: state.expiresAt ? `In regola · fino al ${formatShortDate(state.expiresAt)}` : "In regola",
      expiresAt: state.expiresAt,
    };
  }
  if (state.status === "missing_form") {
    return { color: "rosso", reason: state.feePaid ? "Non in regola · quota pagata, modulo mancante" : "Non in regola · nessun modulo", expiresAt: null };
  }
  const period = membershipPeriodFor(input.eventDate.slice(0, 10));
  const year = period ? period.validUntil.slice(0, 4) : "";
  return { color: "rosso", reason: `Non in regola · quota ${year} mancante`.trim(), expiresAt: null };
}

export function countDots(dots: readonly EventDot[]): Record<EventDotColor, number> {
  const counts: Record<EventDotColor, number> = { verde: 0, rosso: 0, giallo: 0 };
  for (const dot of dots) counts[dot.color] += 1;
  return counts;
}
