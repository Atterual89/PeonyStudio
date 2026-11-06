// Periodi associativi: UNICO punto in cui sono definiti.
//
//   - Primo periodo: quote pagate dal 01/09/2025, valide fino al 31/12/2026.
//   - Dal 2027: anno solare, quote pagate dal 01/01, valide fino al 31/12.
//
// Ogni periodo ha la data da cui contano i pagamenti e la data di fine
// validità (date YYYY-MM-DD, entrambe incluse).

export type MembershipPeriod = {
  /** Primo giorno da cui un pagamento conta per il periodo. */
  paymentsFrom: string;
  /** Ultimo giorno di validità della quota. */
  validUntil: string;
};

export const FIRST_MEMBERSHIP_PERIOD: MembershipPeriod = {
  paymentsFrom: "2025-09-01",
  validUntil: "2026-12-31",
};

/** Primo anno in cui vale l'anno solare. */
const FIRST_CALENDAR_YEAR = Number(FIRST_MEMBERSHIP_PERIOD.validUntil.slice(0, 4)) + 1;

/**
 * Periodo che contiene `date` (YYYY-MM-DD), oppure null se la data è prima
 * del primo periodo (regole precedenti non definite qui).
 */
export function membershipPeriodFor(date: string): MembershipPeriod | null {
  const day = date.slice(0, 10);
  if (day < FIRST_MEMBERSHIP_PERIOD.paymentsFrom) return null;
  if (day <= FIRST_MEMBERSHIP_PERIOD.validUntil) return FIRST_MEMBERSHIP_PERIOD;
  const year = Math.max(Number(day.slice(0, 4)), FIRST_CALENDAR_YEAR);
  return { paymentsFrom: `${year}-01-01`, validUntil: `${year}-12-31` };
}
