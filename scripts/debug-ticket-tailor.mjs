import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const apiBaseUrl = "https://api.tickettailor.com";
const publicFallbackUrl = "https://www.tickettailor.com/events/peonystudio1";

loadDotEnvLocal();

const apiKey = process.env.TICKET_TAILOR_API_KEY;
const targetEventId = process.argv[2];
const debugState = {
  calls: [],
  normalized: [],
  discarded: [],
};

console.log(`.env.local presente: ${existsSync(resolve(process.cwd(), ".env.local")) ? "si" : "no"}`);
console.log(`API key presente: ${apiKey ? "si" : "no"}`);

if (apiKey) {
  const prefix = `${apiKey.slice(0, 4)}****`;
  console.log(`lunghezza key: ${apiKey.length}`);
  console.log(`prefix: ${prefix}`);
}

if (!apiKey) {
  console.log("TICKET_TAILOR_API_KEY mancante. Nessuna chiamata API eseguita.");
  process.exit(0);
}

const headers = {
  Accept: "application/json",
  Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
};

async function run() {
  await probe("Ping/auth base", `${apiBaseUrl}/v1/events?limit=1`);

  const eventsPayload = await probe("GET /v1/events", `${apiBaseUrl}/v1/events`);
  const eventRecords = extractRecords(eventsPayload);
  printSample("events", eventRecords);

  const seriesPayload = await probe(
    "GET /v1/event_series",
    `${apiBaseUrl}/v1/event_series`,
  );
  const seriesRecords = extractRecords(seriesPayload);
  printSample("event_series", seriesRecords);

  const occurrenceRecords = [];
  for (const series of seriesRecords.slice(0, 20)) {
    const seriesId = findString(series, ["id", "event_series_id", "eventSeriesId"]);
    if (!seriesId) {
      continue;
    }

    const occurrencePayload = await fetchFirstWorkingOccurrenceEndpoint(seriesId);
    occurrenceRecords.push(...extractRecords(occurrencePayload));
  }

  console.log(`occurrences trovate: ${occurrenceRecords.length > 0 ? "si" : "no"}`);
  console.log(`occurrences items: ${occurrenceRecords.length}`);
  printSample("occurrences", occurrenceRecords);

  const combinedRecords = [...eventRecords, ...occurrenceRecords];
  const detailEnrichedRecords = [];

  for (const record of combinedRecords) {
    const id = findString(record, ["id", "event_id", "eventId"]);
    const hasUsefulUrl = Boolean(findUrl(record, urlKeys));
    const hasUsefulImage = Boolean(findUrl(record, imageKeys));
    if (id && (!hasUsefulUrl || !hasUsefulImage)) {
      const detailPayload = await probe(
        `GET /v1/events/${id}`,
        `${apiBaseUrl}/v1/events/${encodeURIComponent(id)}`,
        { quiet404: true },
      );
      const detailRecord = extractRecord(detailPayload);
      detailEnrichedRecords.push(detailRecord ? { ...record, ...detailRecord } : record);
    } else {
      detailEnrichedRecords.push(record);
    }
  }

  for (const record of detailEnrichedRecords) {
    const result = normalizeRecord(record);
    if (result.event) {
      debugState.normalized.push(result.event);
    } else {
      debugState.discarded.push(result);
    }
  }

  if (targetEventId) {
    printTargetEventVisibility(detailEnrichedRecords, targetEventId);
  }

  console.log(`Ticket Tailor normalizzati visibili: ${debugState.normalized.length}`);
  console.log(`Ticket Tailor scartati: ${debugState.discarded.length}`);
  console.table(countDiscardReasons(debugState.discarded));
  console.table(debugState.discarded.slice(0, 20).map((item) => ({
    reason: item.reason,
    title: item.title ?? "",
    date: item.date ?? "",
    status: item.status ?? "",
    id: item.ticketTailorId ?? "",
  })));

  console.log("Primi 5 eventi Ticket Tailor normalizzati (base):");
  console.table(debugState.normalized.slice(0, 5).map((event) => ({
    title: event.title,
    date: event.date,
    endDate: event.endDate ?? "",
    dateLabel: event.dateLabel ?? "",
    durationLabel: event.durationLabel ?? "",
    bookingUrl: event.bookingUrl,
    imageUrl: event.imageUrl ?? "",
    status: event.status ?? "",
  })));

  console.log("\nPrimi 5 eventi — dettaglio orari:");
  for (const event of debugState.normalized.slice(0, 5)) {
    console.log(`\n▸ ${event.title} (${event.date})`);
    console.log(`  rawStart candidati:   ${event.debugTime?.rawStartCandidates ?? "-"}`);
    console.log(`  rawEnd candidati:     ${event.debugTime?.rawEndCandidates ?? "-"}`);
    console.log(`  rawStart usato:       ${event.debugTime?.rawStartMs ?? "-"}`);
    console.log(`  rawEnd usato:         ${event.debugTime?.rawEndMs ?? "-"}`);
    console.log(`  startTime:            ${event.startTime ?? "-"}`);
    console.log(`  endTime:              ${event.endTime ?? "-"}`);
    console.log(`  timeLabel:            ${event.timeLabel ?? "-"}`);
    console.log(`  campi ignorati:       ${event.debugTime?.ignoredFields ?? "-"}`);
  }

  console.log(
    `\nLocandine disponibili nei normalizzati: ${
      debugState.normalized.filter((event) => Boolean(event.imageUrl)).length
    }/${debugState.normalized.length}`,
  );
}

async function fetchFirstWorkingOccurrenceEndpoint(seriesId) {
  const candidates = [
    `${apiBaseUrl}/v1/event_series/${encodeURIComponent(seriesId)}/events`,
    `${apiBaseUrl}/v1/event_series/${encodeURIComponent(seriesId)}/occurrences`,
    `${apiBaseUrl}/v1/event_series/${encodeURIComponent(seriesId)}/event_occurrences`,
    `${apiBaseUrl}/v1/events?event_series_id=${encodeURIComponent(seriesId)}`,
  ];

  for (const url of candidates) {
    const payload = await probe(`occurrences for series ${seriesId}`, url, {
      quiet404: true,
    });
    const records = extractRecords(payload);
    if (records.length > 0) {
      return payload;
    }
  }

  return null;
}

async function probe(label, url, options = {}) {
  const result = {
    label,
    url,
    status: null,
    itemCount: 0,
    fields: [],
  };

  try {
    const response = await fetch(url, { headers });
    result.status = `${response.status} ${response.statusText}`;

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const records = extractRecords(payload);
    result.itemCount = records.length;
    result.fields = records[0] ? Object.keys(records[0]).sort() : [];
    debugState.calls.push(result);

    if (!options.quiet404 || response.status !== 404) {
      console.log(`\n${label}`);
      console.log(`URL: ${url}`);
      console.log(`status HTTP: ${result.status}`);
      console.log(`items: ${result.itemCount}`);
      console.log(`campi primo item: ${result.fields.join(", ") || "-"}`);
    }

    return response.ok ? payload : null;
  } catch (error) {
    result.status = error instanceof Error ? error.message : String(error);
    debugState.calls.push(result);
    console.log(`\n${label}`);
    console.log(`URL: ${url}`);
    console.log(`status HTTP: ${result.status}`);
    return null;
  }
}

function printSample(label, records) {
  console.log(`\nPrimi 5 ${label}:`);
  console.table(records.slice(0, 5).map((record) => ({
    id: findString(record, ["id", "event_id", "eventId", "event_series_id"]) ?? "",
    title: findString(record, titleKeys) ?? "",
    date: findDate(record, startDateKeys) ?? "",
    endDate: findDate(record, endDateKeys) ?? "",
    status: findString(record, ["status", "state"]) ?? "",
    url: findUrl(record, urlKeys) ?? "",
    thumbnail: findUrl(record, imageKeys) ?? "",
  })));
}

function printTargetEventVisibility(records, eventId) {
  const record = records.find(
    (item) => findString(item, ["id", "event_id", "eventId"]) === eventId,
  );

  console.log(`\nDebug visibilita evento ${eventId}:`);

  if (!record) {
    console.log("Evento non trovato nei payload recuperati.");
    return;
  }

  console.log("campi disponibili:");
  console.log(Object.keys(record).sort().join(", "));
  console.log("metadati visibilita:");
  console.table(collectVisibilityFields(record));
}

function normalizeRecord(record) {
  const title = findString(record, titleKeys);
  const ticketTailorId = findString(record, ["id", "event_id", "eventId"]);
  const date = findDate(record, startDateKeys);
  const endDate = findDate(record, endDateKeys);
  const status = findString(record, ["status", "state"]);

  if (!title) {
    return { reason: "titolo mancante", title, date, status, ticketTailorId };
  }

  if (!date) {
    return { reason: "data mancante", title, date, status, ticketTailorId };
  }

  const effectiveEndDate = endDate ?? date;
  if (effectiveEndDate < todayIso()) {
    return { reason: "evento passato", title, date, status, ticketTailorId };
  }

  if (!isPublishedStatus(status)) {
    return {
      reason: "status non valido o privato/draft/cancelled",
      title,
      date,
      status,
      ticketTailorId,
    };
  }

  const bookingUrl = findUrl(record, urlKeys) ?? publicFallbackUrl;
  const imageFields = collectImageFields(record);
  const imageUrl = findPreferredImageUrl(record) ?? undefined;
  const rawDescription = findString(record, ["short_description", "description", "subtitle"]);
  const description = rawDescription ? stripHtmlToText(rawDescription) : undefined;
  const shortDescription = description ? truncateText(description, 280) : undefined;

  const startMs = findTimestampMs(record, startTimeKeys);
  const endMs = findTimestampMs(record, endTimeKeys);
  const startTime = startMs !== null ? formatTimeRome(startMs) : undefined;
  const endTime = endMs !== null ? formatTimeRome(endMs) : undefined;
  const isMultiDay = Boolean(endDate && endDate !== date);
  const timeLabel = buildTimeLabel(startTime, endTime, isMultiDay);
  const dateLabel = buildDateLabel(date, endDate);
  const durationLabel = buildDurationLabel(date, endDate);

  const rawStartCandidates = startTimeKeys
    .map((k) => `${k}=${JSON.stringify(getPath(record, k) ?? null)}`)
    .filter((s) => !s.endsWith("null"))
    .join(", ") || "-";

  const rawEndCandidates = endTimeKeys
    .map((k) => `${k}=${JSON.stringify(getPath(record, k) ?? null)}`)
    .filter((s) => !s.endsWith("null"))
    .join(", ") || "-";

  const ignoredFields = Object.keys(record)
    .filter((k) =>
      /created_at|updated_at|published_at|sales_start|sales_end|sale_start|sale_end|checkout|availability/i.test(k),
    )
    .map((k) => `${k}=${JSON.stringify(record[k])}`)
    .join(", ") || "-";

  return {
    event: {
      title,
      date,
      endDate,
      dateLabel,
      durationLabel,
      bookingUrl,
      imageUrl,
      status,
      ticketTailorId,
      hasRawDescription: Boolean(rawDescription),
      shortDescription,
      imageFields,
      startTime,
      endTime,
      timeLabel,
      debugTime: {
        rawStartMs: startMs,
        rawEndMs: endMs,
        rawStartCandidates,
        rawEndCandidates,
        ignoredFields,
      },
    },
  };
}

function countDiscardReasons(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.reason, (counts.get(item.reason) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
}

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function extractRecords(payload) {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  const record = extractRecord(payload);
  if (!record) {
    return [];
  }

  const candidates = [
    record.data,
    record.items,
    record.results,
    record.events,
    record.event_series,
    record.occurrences,
    record.event_occurrences,
  ];
  const array = candidates.find(Array.isArray);

  return Array.isArray(array) ? array.filter(isRecord) : [];
}

function extractRecord(payload) {
  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload.event)) {
    return payload.event;
  }

  if (isRecord(payload.event_series)) {
    return payload.event_series;
  }

  if (isRecord(payload.occurrence)) {
    return payload.occurrence;
  }

  return payload;
}

function findString(record, keys) {
  for (const key of keys) {
    const value = getPath(record, key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const value of Object.values(record)) {
    if (isRecord(value)) {
      const nestedValue = findString(value, keys);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function findUrl(record, keys) {
  const keyedValue = findString(record, keys);
  if (keyedValue?.startsWith("http")) {
    return keyedValue;
  }

  for (const value of Object.values(record)) {
    if (typeof value === "string" && value.startsWith("http")) {
      return value;
    }

    if (isRecord(value)) {
      const nestedValue = findUrl(value, keys);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function findPreferredImageUrl(record) {
  for (const key of imageKeys) {
    const value = getPath(record, key);
    if (typeof value === "string" && isImageUrl(value)) {
      return value;
    }
  }

  return findNestedImageUrl(record);
}

function findNestedImageUrl(record) {
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && looksLikeImageField(key) && isImageUrl(value)) {
      return value;
    }

    if (isRecord(value)) {
      const nestedValue = findNestedImageUrl(value);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function collectImageFields(record) {
  const fields = {};
  const keys = [
    "thumbnail",
    "image",
    "image_url",
    "header_image",
    "cover_image",
    "banner",
    "event_image",
    "images",
    "images.header",
    "images.cover",
    "images.banner",
    "images.original",
    "images.thumbnail",
  ];

  for (const key of keys) {
    const value = getPath(record, key);
    if (typeof value === "string") {
      fields[key] = value;
    } else if (isRecord(value)) {
      fields[key] = JSON.stringify(value).slice(0, 240);
    } else if (Array.isArray(value)) {
      fields[key] = JSON.stringify(value).slice(0, 240);
    }
  }

  return fields;
}

function collectVisibilityFields(record, prefix = "") {
  const fields = [];

  for (const [key, value] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      /private|hidden|visibility|show.*box|box.*office|listed|unlisted|search|event_page|status|state/i.test(
        path,
      )
    ) {
      fields.push({
        field: path,
        value: isRecord(value) || Array.isArray(value)
          ? JSON.stringify(value).slice(0, 500)
          : String(value),
      });
    }

    if (isRecord(value)) {
      fields.push(...collectVisibilityFields(value, path));
    }
  }

  return fields;
}

function findDate(record, keys) {
  for (const key of keys) {
    const value = getPath(record, key);
    const normalized = normalizeDate(value);
    if (normalized) {
      return normalized;
    }

    if (isRecord(value)) {
      const nested = findDate(value, ["date", "iso", "datetime", "utc", "local"]);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function getPath(record, path) {
  return path.split(".").reduce((value, segment) => {
    if (!isRecord(value)) {
      return undefined;
    }

    return value[segment];
  }, record);
}

function normalizeDate(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue * (numericValue > 9999999999 ? 1 : 1000))
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function isImageUrl(value) {
  const normalized = value.toLowerCase();
  return (
    value.startsWith("http") &&
    (normalized.includes("uploads.tickettailorassets.com") ||
      normalized.includes("cloudfront") ||
      /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(normalized))
  );
}

function looksLikeImageField(key) {
  return /image|thumbnail|cover|banner|poster/i.test(key);
}

function stripHtmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|hr)\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, " ")
      .replace(/<li[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function truncateText(text, maxLength = 210) {
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  const truncated = cleanText.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${truncated || cleanText.slice(0, maxLength).trim()}…`;
}

function decodeHtmlEntities(text) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    ndash: "–",
    mdash: "—",
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    hellip: "…",
  };

  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, entity) => entities[entity] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function isPublishedStatus(status) {
  if (!status) {
    return true;
  }

  const normalized = status.toLowerCase();
  return !["draft", "private", "deleted", "cancelled", "canceled"].some((blocked) =>
    normalized.includes(blocked),
  );
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function findTimestampMs(record, keys) {
  for (const key of keys) {
    const value = getPath(record, key);
    const ms = valueToMs(value);
    if (ms !== null) return ms;
  }

  return null;
}

function valueToMs(value) {
  if (typeof value === "number") {
    return value > 9_999_999_999 ? value : value * 1000;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);

    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue > 9_999_999_999 ? numericValue : numericValue * 1000;
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }

  return null;
}

function formatTimeRome(ms) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Rome",
  }).format(new Date(ms));
}

function buildTimeLabel(startTime, endTime, isMultiDay = false) {
  if (!startTime || startTime === "00:00") return undefined;

  if (!isMultiDay && endTime && endTime !== "00:00" && endTime !== startTime) {
    return `${startTime} – ${endTime}`;
  }

  return `Dalle ${startTime}`;
}

function buildDateLabel(date, endDate) {
  if (!endDate || endDate === date) {
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "short",
      day: "numeric",
      month: "long",
    }).format(new Date(`${date}T12:00:00+02:00`));
  }

  const start = new Date(`${date}T12:00:00+02:00`);
  const end = new Date(`${endDate}T12:00:00+02:00`);

  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    const monthYear = new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
    }).format(start);

    return `${start.getDate()}–${end.getDate()} ${monthYear}`;
  }

  const fmtDay = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });
  const fmtDayYear = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

  return `${fmtDay.format(start)} – ${fmtDayYear.format(end)}`;
}

function buildDurationLabel(date, endDate) {
  if (!endDate || endDate === date) return undefined;

  const start = new Date(`${date}T12:00:00+02:00`);
  const end = new Date(`${endDate}T12:00:00+02:00`);
  const diffDays =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  return diffDays >= 2 ? `${diffDays} giorni` : undefined;
}

const titleKeys = ["name", "title", "event_name", "event.name", "event.title"];

const startTimeKeys = [
  "start",
  "starts_at",
  "start_at",
  "start_date",
  "event_start",
  "occurrence.start",
  "occurrence.starts_at",
  "event.start",
  "event.starts_at",
];

const endTimeKeys = [
  "end",
  "ends_at",
  "end_at",
  "end_date",
  "event_end",
  "occurrence.end",
  "occurrence.ends_at",
  "event.end",
  "event.ends_at",
];

const startDateKeys = [
  "start",
  "start_date",
  "start_at",
  "starts_at",
  "date",
  "occurrence.start",
  "occurrence.start_date",
  "occurrence.starts_at",
  "event.start",
  "event.start_date",
  "event.starts_at",
];
const endDateKeys = [
  "end",
  "end_date",
  "end_at",
  "ends_at",
  "occurrence.end",
  "occurrence.end_date",
  "occurrence.ends_at",
  "event.end",
  "event.end_date",
  "event.ends_at",
];
const urlKeys = [
  "url",
  "public_url",
  "event_url",
  "checkout_url",
  "booking_url",
  "links.public",
  "links.self",
  "event.url",
  "event.public_url",
];
const imageKeys = [
  "header_image",
  "cover_image",
  "banner",
  "event_image",
  "image_url",
  "image",
  "images.header",
  "images.cover",
  "images.banner",
  "images.original",
  "images.thumbnail",
  "thumbnail",
  "event.header_image",
  "event.cover_image",
  "event.banner",
  "event.event_image",
  "event.image_url",
  "event.image",
  "event.images.header",
  "event.images.cover",
  "event.images.banner",
  "event.images.original",
  "event.thumbnail",
  "event.images.thumbnail",
];

await run();
