export const CURRENT_MEMBERSHIP_START = "2025-09-01";

export type MembershipEvidenceRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  source: string | null;
  membership_status: string | null;
  membership_starts_at: string | null;
  membership_expires_at: string | null;
};

export type DerivedMembershipState = {
  status: "missing_form" | "payment_missing" | "valid";
  formPresent: boolean;
  currentYearPaid: boolean;
  membershipStartsAt: string | null;
  membershipExpiresAt: string | null;
  paymentMatchMethod: "email" | "name" | null;
};

export function deriveMembershipState(
  rows: MembershipEvidenceRow[],
  identity: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  },
): DerivedMembershipState {
  const targetEmail = normalizeEmail(identity.email);
  const explicitNameKey = normalizeNameKey(
    identity.firstName,
    identity.lastName,
  );

  const formRows = rows.filter((row) => {
    if (row.source !== "google_sheet") return false;

    const emailMatches =
      Boolean(targetEmail) && normalizeEmail(row.email) === targetEmail;
    const nameMatches =
      Boolean(explicitNameKey) &&
      normalizeNameKey(row.first_name, row.last_name) === explicitNameKey;

    return emailMatches || nameMatches;
  });

  const directEmailPayment = targetEmail
    ? rows.find(
        (row) =>
          row.source === "official_members_book" &&
          normalizeEmail(row.email) === targetEmail &&
          isCurrentYearPayment(row),
      )
    : undefined;

  if (directEmailPayment) {
    return {
      status: "valid",
      formPresent: formRows.length > 0,
      currentYearPaid: true,
      membershipStartsAt: directEmailPayment.membership_starts_at,
      membershipExpiresAt: directEmailPayment.membership_expires_at,
      paymentMatchMethod: "email",
    };
  }

  const candidateNameKeys = Array.from(
    new Set(
      [
        explicitNameKey,
        ...formRows.map((row) =>
          normalizeNameKey(row.first_name, row.last_name),
        ),
      ].filter(Boolean),
    ),
  );

  for (const nameKey of candidateNameKeys) {
    const officialMatches = rows.filter(
      (row) =>
        row.source === "official_members_book" &&
        normalizeNameKey(row.first_name, row.last_name) === nameKey,
    );

    // Accept a name match only if it resolves to one unique official record.
    if (officialMatches.length !== 1) continue;

    const officialRow = officialMatches[0];
    if (!isCurrentYearPayment(officialRow)) continue;

    // The official members book is authoritative for legacy members whose
    // historical form response is no longer present in the current form tabs.
    return {
      status: "valid",
      formPresent: true,
      currentYearPaid: true,
      membershipStartsAt: officialRow.membership_starts_at,
      membershipExpiresAt: officialRow.membership_expires_at,
      paymentMatchMethod: "name",
    };
  }

  if (formRows.length === 0) {
    return {
      status: "missing_form",
      formPresent: false,
      currentYearPaid: false,
      membershipStartsAt: null,
      membershipExpiresAt: null,
      paymentMatchMethod: null,
    };
  }

  return {
    status: "payment_missing",
    formPresent: true,
    currentYearPaid: false,
    membershipStartsAt: null,
    membershipExpiresAt: null,
    paymentMatchMethod: null,
  };
}

function isCurrentYearPayment(row: MembershipEvidenceRow) {
  return (
    row.membership_status === "verified" &&
    Boolean(
      row.membership_starts_at &&
        row.membership_starts_at >= CURRENT_MEMBERSHIP_START,
    )
  );
}

export function normalizeMembershipEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeMembershipNameKey(
  firstName?: string | null,
  lastName?: string | null,
) {
  const tokens = normalizeNamePart(
    [firstName, lastName].filter(Boolean).join(" "),
  )
    .split(/\s+/)
    .filter(Boolean)
    .sort();

  return tokens.length >= 2 ? tokens.join(" ") : "";
}

function normalizeEmail(value?: string | null) {
  return normalizeMembershipEmail(value);
}

function normalizeNameKey(
  firstName?: string | null,
  lastName?: string | null,
) {
  return normalizeMembershipNameKey(firstName, lastName);
}

function normalizeNamePart(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
