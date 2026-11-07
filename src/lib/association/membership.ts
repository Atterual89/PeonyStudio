import { membershipPeriodFor } from "./membership-periods";

/** Scadenza associativa per la data di riferimento: 2025/26 unico periodo, poi anno solare. */
export function getDefaultMembershipExpiryDate(referenceDate: string | Date) {
  const iso = typeof referenceDate === "string"
    ? referenceDate.slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);
  return membershipPeriodFor(iso)?.validUntil ?? "2025-08-31";
}
