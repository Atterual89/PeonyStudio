import { FIRST_MEMBERSHIP_PERIOD } from "./membership-periods";

// Periodo in corso per la pagina admin (stessi valori di prima: 2025-09-01 e
// 2026-12-31), definito in membership-periods.ts.
export const CURRENT_MEMBERSHIP_START = FIRST_MEMBERSHIP_PERIOD.paymentsFrom;
export const CURRENT_MEMBERSHIP_EXPIRY = FIRST_MEMBERSHIP_PERIOD.validUntil;

export type MembershipEvidenceRow = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  source: string | null;
  membership_status: string | null;
  membership_starts_at: string | null;
  membership_expires_at: string | null;
  /** Provenienza della verifica; non è inviata ai client pubblici. */
  notes_admin?: string | null;
};

export type DerivedMembershipState = {
  status: "missing_form" | "payment_missing" | "valid";
  formPresent: boolean;
  currentYearPaid: boolean;
  membershipStartsAt: string | null;
  membershipExpiresAt: string | null;
  paymentMatchMethod: "email" | "name" | "manual" | "payment_email" | null;
};

export type DeriveMembershipOptions = {
  /**
   * Data da cui conta un pagamento (YYYY-MM-DD, inclusa): l'inizio pagamenti
   * del periodo associativo (membership-periods.ts). Senza, come sempre:
   * CURRENT_MEMBERSHIP_START.
   */
  paymentsFrom?: string;
  /**
   * Ultimo giorno (incluso) in cui un pagamento conta: la fine validità del
   * periodo, così una quota del periodo dopo non vale per questo. Senza,
   * nessun limite (come sempre).
   */
  paymentsUntil?: string;
};

export function deriveMembershipState(
  rows: MembershipEvidenceRow[],
  identity: { email?: string | null; firstName?: string | null; lastName?: string | null },
  options: DeriveMembershipOptions = {},
): DerivedMembershipState {
  const paymentWindow = { from: options.paymentsFrom ?? CURRENT_MEMBERSHIP_START, until: options.paymentsUntil ?? null };
  const targetEmail = normalizeEmail(identity.email);
  const targetName = normalizeNameKey(identity.firstName, identity.lastName);
  const samePerson = (row: MembershipEvidenceRow) => {
    const email = normalizeEmail(row.email);
    if (targetEmail && email === targetEmail) return true;
    return Boolean(targetName) && normalizeNameKey(row.first_name, row.last_name) === targetName &&
      (!targetEmail || !email || email === targetEmail);
  };
  // La registrazione è attestata soltanto dal modulo Google.
  const formPresent = rows.some(row => row.source === "google_sheet" && samePerson(row));
  // La quota è confermata esclusivamente da un pagamento email abbinato
  // oppure da un inserimento manuale salvato nel gestionale.
  const payments = rows.filter(row => row.source === "manual_override" &&
    isPaymentInWindow(row, paymentWindow) && samePerson(row));
  const payment = payments.find(row => row.notes_admin?.startsWith("Quota confermata da email (")) ?? payments[0];
  const paid = Boolean(payment);
  return {
    status: !formPresent ? "missing_form" : paid ? "valid" : "payment_missing",
    formPresent,
    currentYearPaid: paid,
    membershipStartsAt: payment?.membership_starts_at ?? null,
    membershipExpiresAt: payment?.membership_expires_at ?? null,
    paymentMatchMethod: !payment ? null :
      payment.notes_admin?.startsWith("Quota confermata da email (") ? "payment_email" : "manual",
  };
}

function isPaymentInWindow(
  row: MembershipEvidenceRow,
  window: { from: string; until: string | null },
) {
  return (
    row.membership_status === "verified" &&
    Boolean(
      row.membership_starts_at &&
        row.membership_starts_at >= window.from &&
        (window.until === null || row.membership_starts_at.slice(0, 10) <= window.until),
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
