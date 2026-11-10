import { FIRST_MEMBERSHIP_PERIOD, membershipPeriodFor } from "./membership-periods";

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
  /** Tessera vigente attestata dal libro ufficiale; non crea un pagamento manuale. */
  verifiedInOfficialBook: boolean;
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
  /** Giorno dell'evento o della verifica, necessario per non usare tessere future. */
  referenceDate?: string;
};

export function deriveMembershipState(
  rows: MembershipEvidenceRow[],
  identity: { email?: string | null; firstName?: string | null; lastName?: string | null },
  options: DeriveMembershipOptions = {},
): DerivedMembershipState {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const defaultPeriod = membershipPeriodFor(today) ?? FIRST_MEMBERSHIP_PERIOD;
  const paymentWindow = { from: options.paymentsFrom ?? defaultPeriod.paymentsFrom, until: options.paymentsUntil ?? null };
  const targetEmail = normalizeEmail(identity.email);
  const targetName = normalizeNameKey(identity.firstName, identity.lastName);
  const samePerson = (row: MembershipEvidenceRow) => {
    const email = normalizeEmail(row.email);
    if (targetEmail && email === targetEmail) return true;
    return Boolean(targetName) && normalizeNameKey(row.first_name, row.last_name) === targetName &&
      (!targetEmail || !email || email === targetEmail);
  };
  // Il modulo Google non scade. Il libro ufficiale puo' confermare una
  // precedente registrazione: la sua scadenza limita SOLO la quota annuale.
  const googleFormPresent = rows.some(row => row.source === "google_sheet" && samePerson(row));
  // La quota è confermata esclusivamente da un pagamento email abbinato
  // oppure da un inserimento manuale salvato nel gestionale.
  const referenceDate = (options.referenceDate ?? (options.paymentsFrom ? paymentWindow.until : today) ?? today).slice(0, 10);
  const payments = rows.filter(row => row.source === "manual_override" &&
    isPaymentInWindow(row, paymentWindow, referenceDate) && samePerson(row));
  // Se esistono quota 2026 e rinnovo 2027, mostra la scadenza più lunga.
  const payment = [...payments].sort((a, b) =>
    (b.membership_expires_at ?? "").localeCompare(a.membership_expires_at ?? "") ||
    Number(Boolean(b.notes_admin?.startsWith("Quota confermata da email ("))) -
    Number(Boolean(a.notes_admin?.startsWith("Quota confermata da email (")))
  )[0];
  const paid = Boolean(payment);

  // Il libro ufficiale puo' attestare una tessera gia' verificata, ma una
  // registrazione scaduta non diventa una quota valida del nuovo periodo.
  const official = rows.filter(row => row.source === "official_members_book" &&
    row.membership_status === "verified" &&
    Boolean(row.membership_starts_at && row.membership_starts_at.slice(0, 10) <= referenceDate &&
      row.membership_expires_at && row.membership_expires_at.slice(0, 10) >= referenceDate));
  const sameOfficialName = (row: MembershipEvidenceRow) => Boolean(targetName) &&
    normalizeNameKey(row.first_name, row.last_name) === targetName;
  const directOfficial = targetEmail ? official.filter(row =>
    normalizeEmail(row.email) === targetEmail && (!targetName || sameOfficialName(row))) : [];
  // Un solo nome nel libro ufficiale e nessun conflitto tra due moduli Google.
  // I nickname non sono mai prove di identita' per questo automatismo.
  const nameOfficial = official.filter(row => sameOfficialName(row) &&
    (!normalizeEmail(row.email) || normalizeEmail(row.email) === targetEmail));
  const formEmails = new Set(rows.filter(row => row.source === "google_sheet" && sameOfficialName(row))
    .map(row => normalizeEmail(row.email)).filter(email => email.includes("@")));
  const safeNameMatch = nameOfficial.length === 1 && formEmails.size <= 1 &&
    (!targetEmail || formEmails.size === 0 || formEmails.has(targetEmail));
  const officialProof = directOfficial.length === 1 ? directOfficial[0] : safeNameMatch ? nameOfficial[0] : null;
  const verifiedInOfficialBook = Boolean(officialProof);
  const historicalOfficial = rows.filter(row => row.source === "official_members_book" &&
    (row.membership_status === "verified" || row.membership_status === "expired"));
  const directHistorical = targetEmail ? historicalOfficial.filter(row =>
    normalizeEmail(row.email) === targetEmail && (!targetName || sameOfficialName(row))) : [];
  const nameHistorical = historicalOfficial.filter(row => sameOfficialName(row) &&
    (!normalizeEmail(row.email) || normalizeEmail(row.email) === targetEmail));
  // Senza email, non fondere automaticamente omonimi o due moduli che
  // indicano indirizzi incompatibili: richiedono revisione manuale.
  const safeHistoricalName = nameHistorical.length === 1 && formEmails.size <= 1 &&
    (!targetEmail || formEmails.size === 0 || formEmails.has(targetEmail));
  const registeredInOfficialBook = directHistorical.length === 1 || safeHistoricalName;
  const formPresent = googleFormPresent || registeredInOfficialBook;

  return {
    status: verifiedInOfficialBook || (formPresent && paid) ? "valid" : !formPresent ? "missing_form" : "payment_missing",
    formPresent,
    currentYearPaid: paid,
    verifiedInOfficialBook,
    membershipStartsAt: payment?.membership_starts_at ?? officialProof?.membership_starts_at ?? null,
    membershipExpiresAt: payment?.membership_expires_at ?? officialProof?.membership_expires_at ?? null,
    paymentMatchMethod: !payment ? null :
      payment.notes_admin?.startsWith("Quota confermata da email (") ? "payment_email" : "manual",
  };
}

function isPaymentInWindow(
  row: MembershipEvidenceRow,
  window: { from: string; until: string | null },
  referenceDate: string,
) {
  return (
    row.membership_status === "verified" &&
    Boolean(
      row.membership_starts_at &&
        row.membership_starts_at >= window.from &&
        row.membership_starts_at.slice(0, 10) <= referenceDate &&
        Boolean(row.membership_expires_at && row.membership_expires_at.slice(0, 10) >= referenceDate) &&
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
