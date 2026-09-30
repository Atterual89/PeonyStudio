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
  const identitySources = new Set(["google_sheet", "legacy_members_2025"]);
  const identityRows = rows.filter((row) => identitySources.has(row.source ?? ""));

  const emailMatches = targetEmail
    ? identityRows.filter(
        (row) => normalizeEmail(row.email) === targetEmail,
      )
    : [];
  const nameMatches = explicitNameKey
    ? identityRows.filter(
        (row) =>
          normalizeNameKey(row.first_name, row.last_name) ===
          explicitNameKey,
      )
    : [];

  let matchedIdentityRows: MembershipEvidenceRow[] = [];

  if (emailMatches.length > 0) {
    const distinctNameKeys = new Set(
      emailMatches
        .map((row) => normalizeNameKey(row.first_name, row.last_name))
        .filter(Boolean),
    );

    if (explicitNameKey && distinctNameKeys.size > 1) {
      const disambiguated = emailMatches.filter(
        (row) =>
          normalizeNameKey(row.first_name, row.last_name) ===
          explicitNameKey,
      );
      matchedIdentityRows =
        disambiguated.length > 0 ? disambiguated : emailMatches;
    } else {
      matchedIdentityRows = emailMatches;
    }
  } else if (nameMatches.length > 0) {
    matchedIdentityRows = nameMatches;
  }

  const formPresent = matchedIdentityRows.length > 0;

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
      formPresent,
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
        ...matchedIdentityRows.map((row) =>
          normalizeNameKey(row.first_name, row.last_name),
        ),
      ].filter(Boolean),
    ),
  );

  // If an email maps to more than one historical person and Ticket Tailor
  // gives no usable name, do not guess which person owns the current payment.
  const emailIsAmbiguous =
    emailMatches.length > 0 &&
    new Set(
      emailMatches
        .map((row) => normalizeNameKey(row.first_name, row.last_name))
        .filter(Boolean),
    ).size > 1 &&
    !explicitNameKey;

  if (!emailIsAmbiguous) {
    for (const nameKey of candidateNameKeys) {
      const officialMatches = rows.filter(
        (row) =>
          row.source === "official_members_book" &&
          normalizeNameKey(row.first_name, row.last_name) === nameKey,
      );

      if (officialMatches.length !== 1) continue;

      const officialRow = officialMatches[0];
      if (!isCurrentYearPayment(officialRow)) continue;

      return {
        status: "valid",
        formPresent: true,
        currentYearPaid: true,
        membershipStartsAt: officialRow.membership_starts_at,
        membershipExpiresAt: officialRow.membership_expires_at,
        paymentMatchMethod: "name",
      };
    }
  }

  if (!formPresent) {
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
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized.includes("@")) return normalized;

  const [rawLocal, rawDomain] = normalized.split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;

  if (domain !== "gmail.com") {
    return `${rawLocal}@${domain}`;
  }

  const local = rawLocal.split("+")[0].replace(/\./g, "");
  return `${local}@gmail.com`;
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
