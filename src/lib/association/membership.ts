import { membershipPeriodForPayment } from "./membership-periods";

/** Scadenza della quota in base alla data effettiva del versamento. */
export function getDefaultMembershipExpiryDate(referenceDate: string | Date) {
  const iso = typeof referenceDate === "string"
    ? referenceDate.slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);
  return membershipPeriodForPayment(iso)?.validUntil ?? "2025-08-31";
}
