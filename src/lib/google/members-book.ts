import "server-only";

import { createHash } from "node:crypto";

import { google } from "googleapis";

export type DetectedMembersBookColumns = {
  first_name: DetectedBookColumn;
  last_name: DetectedBookColumn;
  fiscal_code: DetectedBookColumn;
  birth_date: DetectedBookColumn;
  email: DetectedBookColumn;
  accepted_at: DetectedBookColumn;
  ceased_at: DetectedBookColumn;
  current_year_quota: DetectedBookColumn;
  current_year_card_number: DetectedBookColumn;
  availableHeaders: string[];
};

export type OfficialMembersBookRow = {
  rowNumber: number;
  source_row_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  fiscal_code: string | null;
  birth_date: string | null;
  membership_status: "verified" | "expired";
  membership_starts_at: string | null;
  membership_expires_at: string;
  membership_card_number: string | null;
  source: "official_members_book";
  source_hash: string;
  match_key_name_birth: string;
  match_key_name: string;
  errors: string[];
};

export type OfficialMembersBookReadResult = {
  totalRows: number;
  rows: OfficialMembersBookRow[];
  errors: string[];
  detectedColumns: DetectedMembersBookColumns;
};

type DetectedBookColumn = {
  index: number | null;
  header: string | null;
  normalizedHeader: string | null;
};

const CURRENT_ASSOCIATION_YEAR = "anno sociale 2026";
const CURRENT_YEAR_START = "2025-09-01";
const CURRENT_YEAR_EXPIRY = "2026-12-31";
const PREVIOUS_YEAR_EXPIRY = "2025-12-31";

export async function readOfficialMembersBookFromGoogleSheet() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );
  const spreadsheetId = getRequiredEnv("GOOGLE_SHEET_ID");
  const range = getRequiredEnv("GOOGLE_MEMBERS_BOOK_RANGE");
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return normalizeOfficialMembersBookRows(response.data.values ?? []);
}

function normalizeOfficialMembersBookRows(
  values: unknown[][],
): OfficialMembersBookReadResult {
  const [mainHeaders, subHeaders, ...dataRows] = values;

  if (!mainHeaders || !subHeaders) {
    return {
      totalRows: 0,
      rows: [],
      errors: ["Libro soci vuoto o senza due righe di intestazione."],
      detectedColumns: createEmptyDetectedColumns(),
    };
  }

  const headers = combineHeaders(mainHeaders, subHeaders);
  const detectedColumns = detectColumns(headers);
  const errors: string[] = [];

  if (detectedColumns.first_name.index === null) {
    errors.push("Colonna Nome non trovata.");
  }
  if (detectedColumns.last_name.index === null) {
    errors.push("Colonna Cognome non trovata.");
  }
  if (detectedColumns.current_year_quota.index === null) {
    errors.push("Colonna Anno Sociale 2026 / Quota soci non trovata.");
  }

  const rows = dataRows
    .map<OfficialMembersBookRow>((row, index) => {
      const rowNumber = index + 3;
      const firstName = normalizeText(readCell(row, detectedColumns.first_name.index));
      const lastName = normalizeText(readCell(row, detectedColumns.last_name.index));
      const fiscalCode = normalizeFiscalCode(
        readCell(row, detectedColumns.fiscal_code.index),
      );
      const birthDate = parseSheetDate(readCell(row, detectedColumns.birth_date.index));
      const acceptedAt = parseSheetDate(readCell(row, detectedColumns.accepted_at.index));
      const ceasedAt = parseSheetDate(readCell(row, detectedColumns.ceased_at.index));
      const quota = parseAmount(readCell(row, detectedColumns.current_year_quota.index));
      const membershipCardNumber =
        normalizeText(readCell(row, detectedColumns.current_year_card_number.index)) ||
        null;
      const email = normalizeEmail(readCell(row, detectedColumns.email.index));
      const rowErrors: string[] = [];

      if (!firstName && !lastName) {
        rowErrors.push("Riga senza nome e cognome: ignorata.");
      } else {
        if (!firstName) rowErrors.push("Nome mancante.");
        if (!lastName) rowErrors.push("Cognome mancante.");
      }

      const statusAndDates = getMembershipStatusAndDates({
        acceptedAt,
        ceasedAt,
        quota,
      });
      const baseRow = {
        rowNumber,
        source_row_id: String(rowNumber),
        first_name: firstName,
        last_name: lastName,
        email,
        fiscal_code: fiscalCode,
        birth_date: birthDate,
        membership_status: statusAndDates.membership_status,
        membership_starts_at: statusAndDates.membership_starts_at,
        membership_expires_at: statusAndDates.membership_expires_at,
        membership_card_number: membershipCardNumber,
        source: "official_members_book" as const,
        match_key_name_birth: createNameBirthKey(firstName, lastName, birthDate),
        match_key_name: createNameKey(firstName, lastName),
        errors: rowErrors,
      };

      return {
        ...baseRow,
        source_hash: createOfficialMemberHash(baseRow),
      };
    })
    .filter((row) => !(row.errors.length === 1 && row.errors[0].startsWith("Riga senza")));

  return {
    totalRows: dataRows.length,
    rows,
    errors,
    detectedColumns,
  };
}

function getMembershipStatusAndDates({
  acceptedAt,
  ceasedAt,
  quota,
}: {
  acceptedAt: string | null;
  ceasedAt: string | null;
  quota: number;
}) {
  if (ceasedAt) {
    return {
      membership_status: "expired" as const,
      membership_starts_at: acceptedAt,
      membership_expires_at: ceasedAt,
    };
  }

  if (quota > 0) {
    return {
      membership_status: "verified" as const,
      membership_starts_at: CURRENT_YEAR_START,
      membership_expires_at: CURRENT_YEAR_EXPIRY,
    };
  }

  return {
    membership_status: "expired" as const,
    membership_starts_at: acceptedAt,
    membership_expires_at: PREVIOUS_YEAR_EXPIRY,
  };
}

function combineHeaders(mainHeaders: unknown[], subHeaders: unknown[]) {
  const maxLength = Math.max(mainHeaders.length, subHeaders.length);

  return Array.from({ length: maxLength }, (_, index) => {
    const main = normalizeText(String(mainHeaders[index] ?? ""));
    const sub = normalizeText(String(subHeaders[index] ?? ""));
    const header = main && sub ? `${main} / ${sub}` : main || sub;

    return {
      header,
      normalizedHeader: normalizeHeader(header),
    };
  });
}

function detectColumns(
  headers: Array<{ header: string; normalizedHeader: string }>,
): DetectedMembersBookColumns {
  return {
    first_name: findColumn(headers, ["nome"]),
    last_name: findColumn(headers, ["cognome"]),
    fiscal_code: findColumn(headers, ["codice fiscale"]),
    birth_date: findColumn(headers, ["data di nascita", "data nascita"]),
    email: findColumn(headers, ["email", "indirizzo email", "e mail"]),
    accepted_at: findColumn(headers, ["data accettazione"]),
    ceased_at: findColumn(headers, ["data cessazione"]),
    current_year_quota: findColumn(headers, [
      `${CURRENT_ASSOCIATION_YEAR} quota soci`,
      `${CURRENT_ASSOCIATION_YEAR} quota`,
    ]),
    current_year_card_number: findColumn(headers, [
      `${CURRENT_ASSOCIATION_YEAR} n tessera`,
      `${CURRENT_ASSOCIATION_YEAR} numero tessera`,
      `${CURRENT_ASSOCIATION_YEAR} tessera`,
    ]),
    availableHeaders: headers.map((header) => header.normalizedHeader).filter(Boolean),
  };
}

function findColumn(
  headers: Array<{ header: string; normalizedHeader: string }>,
  priorities: string[],
): DetectedBookColumn {
  for (const priority of priorities) {
    const exactIndex = headers.findIndex(
      (header) => header.normalizedHeader === priority,
    );

    if (exactIndex >= 0) return toDetectedColumn(headers, exactIndex);
  }

  for (const priority of priorities) {
    const partialIndex = headers.findIndex((header) =>
      header.normalizedHeader.includes(priority),
    );

    if (partialIndex >= 0) return toDetectedColumn(headers, partialIndex);
  }

  return {
    index: null,
    header: null,
    normalizedHeader: null,
  };
}

function toDetectedColumn(
  headers: Array<{ header: string; normalizedHeader: string }>,
  index: number,
): DetectedBookColumn {
  return {
    index,
    header: headers[index].header,
    normalizedHeader: headers[index].normalizedHeader,
  };
}

function readCell(row: unknown[], index: number | null | undefined) {
  if (index === undefined || index === null || index < 0) return "";
  return String(row[index] ?? "");
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/["'“”‘’]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[°º]/g, "")
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeFiscalCode(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").toUpperCase();
  return normalized || null;
}

function parseAmount(value: string) {
  const normalized = value
    .trim()
    .replace(/[€\s]/g, "")
    .replace(",", ".");

  if (!normalized) return 0;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseSheetDate(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return validateDate(isoDate[1], isoDate[2], isoDate[3]);

  const italianDate = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (italianDate) {
    const year =
      italianDate[3].length === 2 ? `20${italianDate[3]}` : italianDate[3];
    return validateDate(
      year,
      italianDate[2].padStart(2, "0"),
      italianDate[1].padStart(2, "0"),
    );
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString().slice(0, 10);
}

function validateDate(year: string, month: string, day: string) {
  const value = `${year}-${month}-${day}`;
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return value;
}

function createNameKey(firstName: string, lastName: string) {
  return `${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`.trim();
}

function createNameBirthKey(
  firstName: string,
  lastName: string,
  birthDate: string | null,
) {
  return birthDate ? `${createNameKey(firstName, lastName)} ${birthDate}` : "";
}

function normalizeNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function createOfficialMemberHash(
  row: Omit<OfficialMembersBookRow, "source_hash">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        fiscal_code: row.fiscal_code,
        birth_date: row.birth_date,
        membership_status: row.membership_status,
        membership_starts_at: row.membership_starts_at,
        membership_expires_at: row.membership_expires_at,
        membership_card_number: row.membership_card_number,
        source: row.source,
        source_row_id: row.source_row_id,
      }),
    )
    .digest("hex");
}

function createEmptyDetectedColumns(): DetectedMembersBookColumns {
  const empty = { index: null, header: null, normalizedHeader: null };
  return {
    first_name: empty,
    last_name: empty,
    fiscal_code: empty,
    birth_date: empty,
    email: empty,
    accepted_at: empty,
    ceased_at: empty,
    current_year_quota: empty,
    current_year_card_number: empty,
    availableHeaders: [],
  };
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}
