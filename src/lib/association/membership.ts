export function getDefaultMembershipExpiryDate(referenceDate: string | Date) {
  const date =
    typeof referenceDate === "string"
      ? new Date(`${referenceDate}T00:00:00.000Z`)
      : referenceDate;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const expiryYear = month >= 9 ? year + 1 : year;

  return `${expiryYear}-12-31`;
}
