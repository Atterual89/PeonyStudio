import "server-only";

import { createHash } from "node:crypto";

import { google } from "googleapis";

export type LegacyMember2025Row = {
  rowNumber: number;
  source_row_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  source: "legacy_members_2025";
  source_hash: string;
};

const LEGACY_MEMBERS_SPREADSHEET_ID =
  "1CR7J4tCbA_pG6mJGzGBlHjt577HRDBq1nClKeSO1ruw";
const LEGACY_MEMBERS_RANGE = "Foglio1!A:K";

export async function readLegacyMembers2025FromGoogleSheet() {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: LEGACY_MEMBERS_SPREADSHEET_ID,
    range: LEGACY_MEMBERS_RANGE,
  });

  return normalizeRows(response.data.values ?? []);
}

function normalizeRows(values: unknown[][]) {
  const [headers, ...dataRows] = values;
  if (!headers) return [];

  const normalizedHeaders = headers.map((value) =>
    normalizeHeader(String(value ?? "")),
  );
  const firstNameIndex = findHeader(normalizedHeaders, ["nome"]);
  const lastNameIndex = findHeader(normalizedHeaders, ["cognome"]);
  const emailIndex = findHeader(normalizedHeaders, [
    "indirizzo email",
    "email",
  ]);

  return dataRows
    .map((row, index): LegacyMember2025Row | null => {
      const rowNumber = index + 2;
      const firstName = normalizeText(readCell(row, firstNameIndex));
      const lastName = normalizeText(readCell(row, lastNameIndex));
      const email = normalizeEmail(readCell(row, emailIndex));

      if (!firstName || !lastName) return null;

      const base = {
        rowNumber,
        source_row_id: `legacy2025:${rowNumber}`,
        first_name: firstName,
        last_name: lastName,
        email,
        source: "legacy_members_2025" as const,
      };

      return {
        ...base,
        source_hash: createHash("sha256")
          .update(JSON.stringify(base))
          .digest("hex"),
      };
    })
    .filter((row): row is LegacyMember2025Row => Boolean(row));
}

function findHeader(headers: string[], priorities: string[]) {
  for (const priority of priorities) {
    const exact = headers.findIndex((header) => header === priority);
    if (exact >= 0) return exact;
  }

  for (const priority of priorities) {
    const partial = headers.findIndex((header) => header.includes(priority));
    if (partial >= 0) return partial;
  }

  return -1;
}

function readCell(row: unknown[], index: number) {
  if (index < 0) return "";
  return String(row[index] ?? "");
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is not configured.`);
  return value;
}
