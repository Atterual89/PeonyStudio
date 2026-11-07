import "server-only";

import { inflateRawSync } from "node:zlib";
import { google } from "googleapis";

const TARGET_SHEET = "Libro Soci";
export const MAX_BOOK_FILE_SIZE = 12 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 52;
type CellValue = string | number | boolean;

function activeBookYear(): number {
  return Math.max(2026, Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Europe/Rome" }).format(new Date())));
}

// Parser XLSX e backup prima della sostituzione: condivisi tra Admin legacy
// e il gestionale PIN, senza esporre il segreto admin al browser.
export async function replaceMembersBook(values: CellValue[][]) {
  const clientEmail = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getRequiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );
  const spreadsheetId = getRequiredEnv("GOOGLE_SHEET_ID");

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  });

  const target = metadata.data.sheets?.find(
    (sheet) => sheet.properties?.title === TARGET_SHEET,
  );
  const sheetId = target?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Tab "${TARGET_SHEET}" non trovato nel Google Sheet.`);
  }

  const backupTitle = `Libro Soci backup ${formatBackupTimestamp(new Date())}`;

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: sheetId,
              insertSheetIndex: metadata.data.sheets?.length ?? 1,
              newSheetName: backupTitle,
            },
          },
        ],
      },
    });
  } catch (error) {
    throw new Error(
      `Impossibile creare il backup del Libro Soci. Verifica il permesso Editor del service account. ${messageOf(error)}`,
    );
  }

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${TARGET_SHEET}'!A:AZ`,
      requestBody: {},
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${TARGET_SHEET}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  } catch (error) {
    throw new Error(
      `Backup creato come "${backupTitle}", ma l'aggiornamento del Libro Soci non è riuscito. ${messageOf(error)}`,
    );
  }

  return {
    backupTitle,
    importedRows: Math.max(0, values.length - 2),
  };
}

export function parseWorkbook(buffer: Buffer): CellValue[][] {
  const entries = unzip(buffer);
  const workbook = readEntry(entries, "xl/workbook.xml");
  const rels = readEntry(entries, "xl/_rels/workbook.xml.rels");

  const sheetAttrs = Array.from(workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g))
    .map((match) => parseAttributes(match[1]))
    .find((attrs) => attrs.name === TARGET_SHEET);

  if (!sheetAttrs?.["r:id"]) {
    throw new Error(`Il file Excel non contiene il foglio "${TARGET_SHEET}".`);
  }

  const relation = Array.from(
    rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/g),
  )
    .map((match) => parseAttributes(match[1]))
    .find((attrs) => attrs.Id === sheetAttrs["r:id"]);

  if (!relation?.Target) {
    throw new Error("Relazione del foglio Libro Soci non trovata.");
  }

  const worksheetPath = normalizePath(
    relation.Target.startsWith("/")
      ? relation.Target.slice(1)
      : `xl/${relation.Target}`,
  );
  const worksheet = readEntry(entries, worksheetPath);
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(readEntry(entries, "xl/sharedStrings.xml"))
    : [];
  const dateStyles = entries.has("xl/styles.xml")
    ? parseDateStyles(readEntry(entries, "xl/styles.xml"))
    : new Set<number>();

  const values: CellValue[][] = [];

  for (const rowMatch of worksheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    for (const cellMatch of rowMatch[1].matchAll(
      /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g,
    )) {
      const attrs = parseAttributes(cellMatch[1] ?? cellMatch[3] ?? "");
      if (!attrs.r) continue;

      const { rowIndex, columnIndex } = cellPosition(attrs.r);
      if (
        rowIndex < 0 ||
        columnIndex < 0 ||
        rowIndex >= MAX_ROWS ||
        columnIndex >= MAX_COLUMNS
      ) {
        continue;
      }

      while (values.length <= rowIndex) values.push([]);
      const row = values[rowIndex];
      while (row.length <= columnIndex) row.push("");

      row[columnIndex] = parseCell(
        cellMatch[2] ?? "",
        attrs.t,
        attrs.s ? Number(attrs.s) : null,
        sharedStrings,
        dateStyles,
      );
    }
  }

  while (values.length > 0 && isEmptyRow(values.at(-1) ?? [])) values.pop();
  for (const row of values) {
    while (row.length > 0 && row.at(-1) === "") row.pop();
  }

  return values;
}

function unzip(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let eocd = -1;
  const min = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("File XLSX non valido.");

  const totalEntries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("File XLSX non valido.");
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = normalizePath(
      buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"),
    );

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("File XLSX non valido.");
    }

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      entries.set(name, Buffer.from(compressed));
    } else if (method === 8) {
      entries.set(name, inflateRawSync(compressed));
    } else {
      throw new Error(`Compressione XLSX non supportata: ${method}.`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function parseCell(
  body: string,
  type: string | undefined,
  styleIndex: number | null,
  sharedStrings: string[],
  dateStyles: Set<number>,
): CellValue {
  if (type === "inlineStr") {
    return Array.from(body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
      .map((match) => decodeXml(match[1]))
      .join("");
  }

  const raw = decodeXml(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "").trim();
  if (!raw) return "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "b") return raw === "1";
  if (type === "str") return raw;

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;

  if (styleIndex !== null && dateStyles.has(styleIndex)) {
    return excelDate(numeric);
  }

  return numeric;
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g)).map((match) =>
    Array.from(match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join(""),
  );
}

function parseDateStyles(xml: string) {
  const customFormats = new Map<number, string>();

  for (const match of xml.matchAll(/<numFmt\b([^>]*)\/?\s*>/g)) {
    const attrs = parseAttributes(match[1]);
    const id = Number(attrs.numFmtId);
    if (Number.isFinite(id) && attrs.formatCode) {
      customFormats.set(id, attrs.formatCode.toLowerCase());
    }
  }

  const result = new Set<number>();
  const cellXfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  let index = 0;

  for (const match of cellXfs.matchAll(/<xf\b([^>]*)\/?\s*>/g)) {
    const attrs = parseAttributes(match[1]);
    const id = Number(attrs.numFmtId ?? 0);
    const format = (customFormats.get(id) ?? "").replace(/"[^"]*"/g, "");

    if (
      (id >= 14 && id <= 22) ||
      (id >= 45 && id <= 47) ||
      /(^|[^a-z])[dmy]{1,4}([^a-z]|$)/i.test(format)
    ) {
      result.add(index);
    }

    index += 1;
  }

  return result;
}

export function validateMembersBook(values: CellValue[][], year: number = activeBookYear()) {
  if (values.length < 3) {
    throw new Error("Il Libro Soci caricato non contiene righe dati.");
  }
  const headers = values[0]?.map((value) => normalizeHeader(String(value ?? ""))) ?? [];
  const subheaders = values[1]?.map((value) => normalizeHeader(String(value ?? ""))) ?? [];
  const hasFirst = headers.some((header) => header.includes("data richiesta"));
  const hasName = headers.some((header) => header === "nome");
  const hasSurname = headers.some((header) => header === "cognome");
  let yearIndex = -1;
  let foundQuota = false;
  for (let col = 0; col < headers.length; col += 1) {
    if (headers[col]?.includes(`anno sociale ${year}`)) {
      yearIndex = col;
      break;
    }
  }
  if (yearIndex >= 0) {
    // L'intestazione dell'annualità può coprire più colonne unite.
    for (let col = yearIndex; col < Math.max(headers.length, subheaders.length); col += 1) {
      if (col > yearIndex && headers[col]?.includes("anno sociale ")) break;
      if (subheaders[col]?.includes("quota")) { foundQuota = true; break; }
    }
  }
  if (!hasFirst || !hasName || !hasSurname || !foundQuota) {
    throw new Error(`Struttura Libro Soci non riconosciuta o colonna Quota dell'Anno Sociale ${year} assente. Carica l'export Team Artist aggiornato.`);
  }
}

function parseAttributes(value: string) {
  const attrs: Record<string, string> = {};

  for (const match of value.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeXml(match[2]);
  }

  return attrs;
}

function cellPosition(reference: string) {
  const match = reference.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return { rowIndex: -1, columnIndex: -1 };

  let column = 0;
  for (const char of match[1].toUpperCase()) {
    column = column * 26 + char.charCodeAt(0) - 64;
  }

  return {
    rowIndex: Number(match[2]) - 1,
    columnIndex: column - 1,
  };
}

function excelDate(serial: number) {
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (Number.isNaN(date.getTime())) return String(serial);

  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&");
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizePath(value: string) {
  const parts: string[] = [];

  for (const part of value.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }

  return parts.join("/");
}

function readEntry(entries: Map<string, Buffer>, path: string) {
  const entry = entries.get(normalizePath(path));
  if (!entry) throw new Error(`File XLSX non valido: ${path} mancante.`);
  return entry.toString("utf8");
}

function isEmptyRow(row: CellValue[]) {
  return row.every((value) => value === "" || value === null || value === undefined);
}

function formatBackupTimestamp(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replace(" ", "_")
    .replace(/:/g, "-");
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

