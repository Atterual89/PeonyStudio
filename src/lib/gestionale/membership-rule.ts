// Stato associativo nel gestionale (D11, migrazione 016), puro.
//
// 1. Lo stato della pagina admin (deriveMembershipState di
//    src/lib/association/membership-state.ts, stesse fonti, comprese le
//    validazioni manuali "Quota ok"), calcolato per il periodo associativo
//    (membership-periods.ts) che contiene la data di inizio del workshop.
// 2. Nessuna riga trovata e nessun collegamento esplicito (validazione manuale
//    o email del libro soci) → "Non collegata al libro soci" (017).
//
// Le correzioni di gw_membership_overrides non si usano più (migrazione 022:
// convertite in validazioni manuali).

import { membershipPeriodFor, type MembershipPeriod } from "@/lib/association/membership-periods";
import { deriveMembershipState, type DeriveMembershipOptions, type DerivedMembershipState } from "@/lib/association/membership-state";

import type { MembershipBadge } from "./types";

/** Pagamenti che contano per un workshop: quelli del suo periodo associativo. */
export function paymentWindowFor(workshopStartsOn: string): { period: MembershipPeriod | null; options: DeriveMembershipOptions } {
  const period = membershipPeriodFor(workshopStartsOn);
  // Prima del primo periodo non c'è una regola: nessun pagamento conta.
  if (!period) return { period, options: { paymentsFrom: "9999-12-31" } };
  return { period, options: { paymentsFrom: period.paymentsFrom, paymentsUntil: period.validUntil } };
}

/** deriveMembershipState per il periodo associativo del workshop. */
export function deriveForWorkshop(
  rows: Parameters<typeof deriveMembershipState>[0],
  identity: Parameters<typeof deriveMembershipState>[1],
  workshopStartsOn: string,
): DerivedMembershipState {
  return deriveMembershipState(rows, identity, paymentWindowFor(workshopStartsOn).options);
}

export function membershipBadge(input: {
  workshopStartsOn: string;
  /** Risultato di deriveForWorkshop (periodo che contiene l'inizio del workshop). */
  state: DerivedMembershipState;
  /** Collegata esplicitamente al libro soci (member-key.ts). */
  linked: boolean;
  /** Il libro ufficiale conferma una quota in un periodo precedente. */
  knownHistoricalMember?: boolean;
}): MembershipBadge {
  const date = input.workshopStartsOn.slice(0, 10);
  switch (input.state.status) {
    case "valid":
      return { kind: "in_regola", expiresAt: input.state.membershipExpiresAt, match: input.state.paymentMatchMethod };
    case "payment_missing":
      return { kind: "quota_mancante", paymentsFrom: membershipPeriodFor(date)?.paymentsFrom ?? null };
    case "missing_form":
      // Un socio accertato in una annualità precedente non è "modulo assente":
      // la quota del nuovo periodo non è ancora registrata.
      if(input.linked && input.knownHistoricalMember)
        return {kind:"quota_mancante",paymentsFrom:membershipPeriodFor(date)?.paymentsFrom??null};
      return input.linked ? { kind: "modulo_mancante" } : { kind: "non_collegata" };
  }
}

const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "2025-09-01" → "1 set 2025" (senza Intl: identico su server e browser). */
export function formatShortDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Stati della pagina admin, in breve; "(manuale)" per le validazioni "Quota ok". */
export function membershipLabel(badge: MembershipBadge): string {
  switch (badge.kind) {
    case "in_regola":
      return badge.match === "manual" ? "In regola (manuale)" : "In regola";
    case "quota_mancante":
      return badge.paymentsFrom ? `Quota non registrata dal ${formatShortDate(badge.paymentsFrom)}` : "Quota non registrata";
    case "modulo_mancante":
      return "Modulo non trovato";
    case "non_collegata":
      return "Non collegata";
  }
}

/** Ricerca nel libro soci (4d): lo stato che risulterebbe collegando la persona a quel socio. */
export function memberOutcomeLabel(badge: MembershipBadge, inBook: boolean): string {
  switch (badge.kind) {
    case "in_regola":
      return badge.expiresAt ? `In regola fino al ${formatShortDate(badge.expiresAt)}` : "In regola";
    case "quota_mancante":
      return inBook ? "Nel libro soci, quota non registrata" : "Solo modulo, quota non registrata";
    default:
      return "Modulo non trovato";
  }
}

/** Etichette brevi (filtri, riepilogo). */
export const MEMBERSHIP_SHORT_LABELS: Record<MembershipBadge["kind"], string> = {
  in_regola: "In regola",
  quota_mancante: "Quota non registrata",
  modulo_mancante: "Modulo non trovato",
  non_collegata: "Non collegata",
};

/** 4e (#15): nome breve del periodo associativo, "2025/26" (primo periodo) o "2027" (anno solare). */
export function periodLabel(period: MembershipPeriod): string {
  const from = period.paymentsFrom.slice(0, 4);
  const until = period.validUntil.slice(0, 4);
  return from === until ? from : `${from}/${until.slice(2)}`;
}

/**
 * 4e (#15): periodi da mostrare nella scheda persona: quello di oggi e quelli
 * dei workshop della persona, dal più vecchio.
 */
export function personPeriods(today: string, workshopStarts: readonly string[]): MembershipPeriod[] {
  const periods = new Map<string, MembershipPeriod>();
  for (const date of [today, ...workshopStarts]) {
    const period = membershipPeriodFor(date);
    if (period) periods.set(period.paymentsFrom, period);
  }
  return [...periods.values()].sort((a, b) => a.paymentsFrom.localeCompare(b.paymentsFrom));
}

/** "1 set 2025 – 31 dic 2026": periodo associativo per la conferma di "Segna quota ok". */
export function formatPeriod(period: MembershipPeriod): string {
  return `${formatShortDate(period.paymentsFrom)} – ${formatShortDate(period.validUntil)}`;
}
