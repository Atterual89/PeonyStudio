// Regola unica per la quota associativa UR Expression APS.
// L'anno associativo termina sempre il 31 dicembre. Un versamento eseguito
// dal 1 gennaio al 31 agosto vale fino al 31 dicembre dello stesso anno;
// dal 1 settembre al 31 dicembre vale fino al 31 dicembre dell'anno dopo.
// La prima finestra storica parte dal 1 settembre 2025 e termina nel 2026.

export type MembershipPeriod = {
  /** Primo giorno in cui una quota può essere versata per questa annualità. */
  paymentsFrom: string;
  /** Ultimo giorno (incluso) di validità dell'annualità. */
  validUntil: string;
};

export const FIRST_MEMBERSHIP_PERIOD: MembershipPeriod = {
  paymentsFrom: "2025-09-01",
  validUntil: "2026-12-31",
};

const FIRST_DAY = FIRST_MEMBERSHIP_PERIOD.paymentsFrom;

/** Annualità richiesta da una data evento / da una verifica di copertura. */
export function membershipPeriodFor(date: string): MembershipPeriod | null {
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < FIRST_DAY) return null;
  if (day <= FIRST_MEMBERSHIP_PERIOD.validUntil) return FIRST_MEMBERSHIP_PERIOD;
  const year = Number(day.slice(0, 4));
  return { paymentsFrom: `${year - 1}-09-01`, validUntil: `${year}-12-31` };
}

/** Annualità da attribuire a un pagamento, NON alla data del workshop. */
export function membershipPeriodForPayment(paidOn: string): MembershipPeriod | null {
  const day = paidOn.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < FIRST_DAY) return null;
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (month < 1 || month > 12) return null;
  const expiryYear = month >= 9 ? year + 1 : year;
  if (expiryYear === 2026) return FIRST_MEMBERSHIP_PERIOD;
  return { paymentsFrom: `${expiryYear - 1}-09-01`, validUntil: `${expiryYear}-12-31` };
}
