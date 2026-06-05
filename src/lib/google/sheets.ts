import "server-only";

import { createHash } from "node:crypto";

import { google } from "googleapis";

import { getDefaultMembershipExpiryDate } from "@/lib/association/membership";

type SheetColumnKey =
  | "first_name"
  | "last_name"
  | "email"
  | "email_confirm"
  | "contact"
  | "membership_starts_at";

type DetectedSheetColumn = {
  index: number | null;
  header: string | null;
  normalizedHeader: string | null;
};

export type DetectedGoogleSheetColumns = Record<
  Exclude<SheetColumnKey, "email_confirm">,
  DetectedSheetColumn
> & {
  availableHeaders: string[];
};

export type GoogleSheetMemberRow = {
  rowNumber: number;
  source_row_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  contact: string | null;
  membership_status: "verified";
  membership_starts_at: string;
  membership_expires_at: string;
  source: "google_sheet";
  source_hash: string;
  fallbackStartDate: boolean;
  errors: string[];
};

export type GoogleSheetMembersReadResult = {
  totalRows: number;
  rows: GoogleSheetMemberRow[];
  errors: string[];
  detectedColumns: DetectedGoogleSheetColumns;
};

const COLUMN_PRIORITY: Record<SheetColumnKey, string[]> = {
  membership_starts_at: [
    "informazioni cronologiche",
    "timestamp",
    "submitted at",
  ],
  email: ["indirizzo email", "email", "e mail", "mail"],
  email_confirm: [
    "please confirm your e mail address",
    "conferma indirizzo email",
  ],
  first_name: ["name nome", "nome name", "name", "nome"],
  last_name: ["surname cognome", "cognome surname", "surname", "cognome"],
  contact: [
    "mobile phone number",
    "numero di cellulare",
    "cellulare",
    "phone",
    "telefono",
    "telegram",
    "where to contact me dove poter essere contattato",
    "where to contact me",
    "dove poter essere contattato",
    "contatto",
  ],
};

export async function readAssociationMembersFromGoogleSheet() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );
  const spreadsheetId = getRequiredEnv("GOOGLE_SHEET_ID");
  const range = getRequiredEnv("GOOGLE_SHEET_RANGE");
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
  const values = response.data.values ?? [];

  return normalizeGoogleSheetRows(values);
}

function normalizeGoogleSheetRows(values: unknown[][]): GoogleSheetMembersReadResult {
  const [headers, ...dataRows] = values;
  const errors: string[] = [];

  if (!headers) {
    return {
      totalRows: 0,
      rows: [],
      errors: ["Google Sheet is empty."],
      detectedColumns: createEmptyDetectedColumns(),
    };
  }

  const columns = mapColumns(headers.map((header) => String(header ?? "")));

  if (columns.first_name.index === null) {
    errors.push(
      `Missing nome column. Available normalized headers: ${columns.availableHeaders.join(", ")}`,
    );
  }
  if (columns.last_name.index === null) {
    errors.push(
      `Missing cognome column. Available normalized headers: ${columns.availableHeaders.join(", ")}`,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = dataRows.map<GoogleSheetMemberRow>((row, index) => {
    const rowNumber = index + 2;
    const rowErrors: string[] = [];
    const firstName = normalizeText(readCell(row, columns.first_name.index));
    const lastName = normalizeText(readCell(row, columns.last_name.index));
    const email =
      normalizeEmail(readCell(row, columns.email.index)) ??
      normalizeEmail(readCell(row, columns.email_confirm.index));
    const contact = normalizeText(readCell(row, columns.contact.index)) || null;
    const parsedStartDate = parseSheetDate(
      readCell(row, columns.membership_starts_at.index),
    );
    const membershipStartsAt = parsedStartDate ?? today;

    if (!firstName) rowErrors.push("Nome mancante.");
    if (!lastName) rowErrors.push("Cognome mancante.");
    if (!parsedStartDate) rowErrors.push("Data iscrizione non valida: usata data corrente.");

    const baseRow = {
      rowNumber,
      source_row_id: String(rowNumber),
      first_name: firstName,
      last_name: lastName,
      email,
      contact,
      membership_status: "verified" as const,
      membership_starts_at: membershipStartsAt,
      membership_expires_at: getDefaultMembershipExpiryDate(membershipStartsAt),
      source: "google_sheet" as const,
      fallbackStartDate: !parsedStartDate,
      errors: rowErrors,
    };

    return {
      ...baseRow,
      source_hash: createMemberHash(baseRow),
    };
  });

  return {
    totalRows: dataRows.length,
    rows,
    errors,
    detectedColumns: toDetectedColumns(columns),
  };
}

function mapColumns(headers: string[]) {
  const normalizedHeaders = headers.map((header) => ({
    header,
    normalizedHeader: normalizeHeader(header),
  }));

  return {
    first_name: findColumn(normalizedHeaders, COLUMN_PRIORITY.first_name),
    last_name: findColumn(normalizedHeaders, COLUMN_PRIORITY.last_name),
    email: findColumn(normalizedHeaders, COLUMN_PRIORITY.email),
    email_confirm: findColumn(normalizedHeaders, COLUMN_PRIORITY.email_confirm),
    contact: findColumn(normalizedHeaders, COLUMN_PRIORITY.contact),
    membership_starts_at: findColumn(
      normalizedHeaders,
      COLUMN_PRIORITY.membership_starts_at,
    ),
    availableHeaders: normalizedHeaders
      .map((header) => header.normalizedHeader)
      .filter(Boolean),
  };
}

function findColumn(
  headers: Array<{ header: string; normalizedHeader: string }>,
  priorities: string[],
): DetectedSheetColumn {
  for (const priority of priorities) {
    const exactIndex = headers.findIndex(
      (header) => header.normalizedHeader === priority,
    );

    if (exactIndex >= 0) {
      return {
        index: exactIndex,
        header: headers[exactIndex].header,
        normalizedHeader: headers[exactIndex].normalizedHeader,
      };
    }
  }

  for (const priority of priorities) {
    const partialIndex = headers.findIndex((header) =>
      header.normalizedHeader.includes(priority),
    );

    if (partialIndex >= 0) {
      return {
        index: partialIndex,
        header: headers[partialIndex].header,
        normalizedHeader: headers[partialIndex].normalizedHeader,
      };
    }
  }

  return {
    index: null,
    header: null,
    normalizedHeader: null,
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
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDetectedColumns(
  columns: ReturnType<typeof mapColumns>,
): DetectedGoogleSheetColumns {
  return {
    first_name: columns.first_name,
    last_name: columns.last_name,
    email:
      columns.email.index !== null ? columns.email : columns.email_confirm,
    contact: columns.contact,
    membership_starts_at: columns.membership_starts_at,
    availableHeaders: columns.availableHeaders,
  };
}

function createEmptyDetectedColumns(): DetectedGoogleSheetColumns {
  return {
    first_name: { index: null, header: null, normalizedHeader: null },
    last_name: { index: null, header: null, normalizedHeader: null },
    email: { index: null, header: null, normalizedHeader: null },
    contact: { index: null, header: null, normalizedHeader: null },
    membership_starts_at: { index: null, header: null, normalizedHeader: null },
    availableHeaders: [],
  };
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
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
    return validateDate(year, italianDate[2].padStart(2, "0"), italianDate[1].padStart(2, "0"));
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

function createMemberHash(
  row: Omit<GoogleSheetMemberRow, "source_hash">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        contact: row.contact,
        membership_status: row.membership_status,
        membership_starts_at: row.membership_starts_at,
        membership_expires_at: row.membership_expires_at,
        source: row.source,
        source_row_id: row.source_row_id,
      }),
    )
    .digest("hex");
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}
