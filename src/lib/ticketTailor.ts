import type { PeonyEvent, PeonyEventCategory } from "@/lib/events";

const TICKET_TAILOR_API_BASE_URL = "https://api.tickettailor.com";
const TICKET_TAILOR_EVENTS_ENDPOINT = `${TICKET_TAILOR_API_BASE_URL}/v1/events`;
const TICKET_TAILOR_EVENT_SERIES_ENDPOINT = `${TICKET_TAILOR_API_BASE_URL}/v1/event_series`;
const TICKET_TAILOR_ORDERS_ENDPOINT = `${TICKET_TAILOR_API_BASE_URL}/v1/orders`;
export const TICKET_TAILOR_PUBLIC_URL =
  "https://www.tickettailor.com/events/peonystudio1";

type TicketTailorRecord = Record<string, unknown>;

export type TicketTailorOrder = {
  ticketTailorOrderId: string;
  buyerEmail?: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  ticketTailorEventId?: string;
  paymentStatus?: string;
  orderStatus?: string;
  totalTickets?: number;
  rawPayload: TicketTailorRecord;
};

export async function getTicketTailorEvents(): Promise<PeonyEvent[]> {
  const apiKey = process.env.TICKET_TAILOR_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const records = await fetchTicketTailorRecords(apiKey);
    const candidates = records
      .map((record) => ({
        record,
        event: normalizeTicketTailorEvent(record),
      }))
      .filter(
        (item): item is { record: TicketTailorRecord; event: PeonyEvent } => {
          if (!item.event) {
            return false;
          }

          return isVisibleTicketTailorEvent(item.event);
        },
      );

    const enriched = await Promise.all(
      candidates.map(async ({ event, record }) => {
        if (event.imageUrl && event.bookingUrl && event.bookingUrl !== TICKET_TAILOR_PUBLIC_URL) {
          return event;
        }

        const detail = event.ticketTailorId
          ? await fetchTicketTailorEventDetail(apiKey, event.ticketTailorId)
          : null;

        return detail
          ? normalizeTicketTailorEvent({ ...record, ...detail }) ?? event
          : event;
      }),
    );

    return enriched.filter(isVisibleTicketTailorEvent);
  } catch {
    return [];
  }
}

export async function getTicketTailorOrders(): Promise<TicketTailorOrder[]> {
  const apiKey = process.env.TICKET_TAILOR_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const records = await fetchTicketTailorEndpoint(
      apiKey,
      TICKET_TAILOR_ORDERS_ENDPOINT,
    );

    return records
      .map(normalizeTicketTailorOrder)
      .filter((order): order is TicketTailorOrder => Boolean(order));
  } catch {
    return [];
  }
}

export async function getTicketTailorOrdersForEvents(
  eventIds: string[],
): Promise<{
  orders: TicketTailorOrder[];
  pagesRead: number;
}> {
  const apiKey = process.env.TICKET_TAILOR_API_KEY;

  if (!apiKey || eventIds.length === 0) {
    return { orders: [], pagesRead: 0 };
  }

  const ordersById = new Map<string, TicketTailorOrder>();
  let pagesRead = 0;

  for (const eventId of eventIds) {
    const result = await fetchTicketTailorOrderRecordsForEvent(apiKey, eventId);
    pagesRead += result.pagesRead;

    for (const record of result.records) {
      const order = normalizeTicketTailorOrder(record);
      if (order) {
        ordersById.set(order.ticketTailorOrderId, order);
      }
    }
  }

  return {
    orders: Array.from(ordersById.values()),
    pagesRead,
  };
}

export function inferEventCategory(title: string): PeonyEventCategory {
  const normalized = title.toLowerCase();

  if (
    [
      "foundation",
      "base 1",
      "base 2",
      "classe 1",
      "class 1",
      "pratica guidata",
    ].some((term) => normalized.includes(term))
  ) {
    return "percorso";
  }

  if (
    normalized.includes("pratica assistita") ||
    normalized.includes("classe tematica") ||
    normalized.includes("classi tematiche")
  ) {
    return "pratica";
  }

  if (
    ["rope jam", "open day", "aperibottom", "aperi-bottom"].some((term) =>
      normalized.includes(term),
    )
  ) {
    return "community";
  }

  if (
    [
      "workshop",
      "kinbaku luxuria",
      "neck rope",
      "3 dimensions",
      "three dimensions",
    ].some((term) => normalized.includes(term))
  ) {
    return "workshop";
  }

  return "altro";
}

function inferEventCode(title: string): string | undefined {
  const normalized = title.toLowerCase();

  if (normalized.includes("class 1") || normalized.includes("classe 1")) {
    if (normalized.includes("1+") || normalized.includes("1 +")) {
      return "C1+";
    }

    return "C1";
  }

  return undefined;
}

async function fetchTicketTailorRecords(apiKey: string) {
  const [eventRecords, seriesRecords] = await Promise.all([
    fetchTicketTailorEndpoint(apiKey, TICKET_TAILOR_EVENTS_ENDPOINT),
    fetchTicketTailorEndpoint(apiKey, TICKET_TAILOR_EVENT_SERIES_ENDPOINT),
  ]);

  const occurrenceGroups = await Promise.all(
    seriesRecords.map(async (series) => {
      const seriesId = findString(series, [
        "id",
        "event_series_id",
        "eventSeriesId",
      ]);

      return seriesId ? fetchTicketTailorOccurrences(apiKey, seriesId) : [];
    }),
  );

  return [...eventRecords, ...occurrenceGroups.flat()];
}

async function fetchTicketTailorEndpoint(apiKey: string, url: string) {
  try {
    const response = await fetch(url, {
      headers: getTicketTailorHeaders(apiKey),
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as unknown;
    return extractTicketTailorRecords(payload);
  } catch {
    return [];
  }
}

async function fetchTicketTailorOrderRecordsForEvent(
  apiKey: string,
  eventId: string,
) {
  const records: TicketTailorRecord[] = [];
  let pagesRead = 0;
  let nextUrl: string | null =
    `${TICKET_TAILOR_ORDERS_ENDPOINT}?event_id=${encodeURIComponent(eventId)}&limit=100`;
  const maxPagesPerEvent = 20;

  while (nextUrl && pagesRead < maxPagesPerEvent) {
    try {
      const response = await fetch(nextUrl, {
        headers: getTicketTailorHeaders(apiKey),
        next: { revalidate: 900 },
      });

      pagesRead += 1;

      if (!response.ok) {
        break;
      }

      const payload = (await response.json()) as unknown;
      records.push(...extractTicketTailorRecords(payload));
      nextUrl = findNextPageUrl(payload);
    } catch {
      break;
    }
  }

  return { records, pagesRead };
}

function findNextPageUrl(payload: unknown) {
  const record = extractTicketTailorRecord(payload);
  if (!record) {
    return null;
  }

  return (
    getString(getPath(record, "links.next")) ??
    getString(getPath(record, "links.next.href")) ??
    getString(getPath(record, "pagination.next")) ??
    null
  );
}

async function fetchTicketTailorOccurrences(apiKey: string, seriesId: string) {
  const candidates = [
    `${TICKET_TAILOR_EVENT_SERIES_ENDPOINT}/${encodeURIComponent(seriesId)}/events`,
    `${TICKET_TAILOR_EVENT_SERIES_ENDPOINT}/${encodeURIComponent(seriesId)}/occurrences`,
    `${TICKET_TAILOR_EVENT_SERIES_ENDPOINT}/${encodeURIComponent(seriesId)}/event_occurrences`,
    `${TICKET_TAILOR_EVENTS_ENDPOINT}?event_series_id=${encodeURIComponent(seriesId)}`,
  ];

  for (const url of candidates) {
    const records = await fetchTicketTailorEndpoint(apiKey, url);
    if (records.length > 0) {
      return records;
    }
  }

  return [];
}

async function fetchTicketTailorEventDetail(
  apiKey: string,
  eventId: string,
): Promise<TicketTailorRecord | null> {
  try {
    const response = await fetch(
      `${TICKET_TAILOR_EVENTS_ENDPOINT}/${encodeURIComponent(eventId)}`,
      {
        headers: getTicketTailorHeaders(apiKey),
        next: { revalidate: 900 },
      },
    );

    if (!response.ok) {
      return null;
    }

    return extractTicketTailorRecord(await response.json());
  } catch {
    return null;
  }
}

function getTicketTailorHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
  };
}

function extractTicketTailorRecords(payload: unknown): TicketTailorRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  const record = extractTicketTailorRecord(payload);
  if (!record) {
    return [];
  }

  const candidates = [
    record.data,
    record.items,
    record.events,
    record.results,
    record.event_series,
    record.occurrences,
    record.event_occurrences,
  ];
  const array = candidates.find(Array.isArray);

  return Array.isArray(array) ? array.filter(isRecord) : [];
}

function extractTicketTailorRecord(payload: unknown): TicketTailorRecord | null {
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

function normalizeTicketTailorEvent(
  record: TicketTailorRecord,
): PeonyEvent | null {
  const title =
    findString(record, titleKeys) ??
    findString(record, ["description"]);
  const ticketTailorId = findString(record, ["id", "event_id", "eventId"]);
  const date = findDate(record, startDateKeys);

  if (!title || !ticketTailorId || !date) {
    return null;
  }

  const endDate = findDate(record, endDateKeys) ?? null;
  const rawDescription =
    findString(record, ["short_description", "description", "subtitle"]) ??
    undefined;
  const description = rawDescription
    ? stripHtmlToText(rawDescription)
    : undefined;
  const shortDescription = description
    ? truncateText(description, 280)
    : undefined;
  const status = findString(record, ["status", "state"]) ?? undefined;
  const isPublic = inferTicketTailorIsPublic(record, {
    title,
    description,
    shortDescription,
    status,
  });
  const sourceUrl = findUrl(record, urlKeys) ?? undefined;
  const imageUrl = findPreferredImageUrl(record) ?? undefined;

  const startMs = findTimestampMs(record, startTimeKeys);
  const endMs = findTimestampMs(record, endTimeKeys);
  const startTime = startMs !== null ? formatTimeRome(startMs) : undefined;
  const endTime = endMs !== null ? formatTimeRome(endMs) : undefined;
  const isMultiDay = Boolean(endDate && endDate !== date);
  const timeLabel = buildTimeLabel(startTime, endTime, isMultiDay);

  return {
    id: `ticket-tailor-${ticketTailorId}`,
    slug: createTicketTailorSlug(title, date),
    source: "ticket-tailor",
    ticketTailorId,
    date,
    endDate,
    title,
    code: inferEventCode(title),
    category: inferEventCategory(title),
    description,
    shortDescription,
    tags: [],
    isPublic,
    showOnHome: true,
    featured: false,
    bookingUrl: sourceUrl ?? TICKET_TAILOR_PUBLIC_URL,
    sourceUrl,
    imageUrl,
    status,
    startTime,
    endTime,
    timeLabel,
    rawTicketTailorPayload: record,
  };
}

function normalizeTicketTailorOrder(
  record: TicketTailorRecord,
): TicketTailorOrder | null {
  const ticketTailorOrderId = findString(record, [
    "id",
    "order_id",
    "orderId",
    "object_id",
  ]);

  if (!ticketTailorOrderId) {
    return null;
  }

  return {
    ticketTailorOrderId,
    buyerEmail:
      findString(record, [
        "buyer_email",
        "email",
        "customer_email",
        "purchaser_email",
        "buyer.email",
        "customer.email",
        "order.email",
      ]) ?? undefined,
    buyerFirstName:
      findString(record, [
        "buyer_first_name",
        "first_name",
        "customer_first_name",
        "purchaser_first_name",
        "buyer.first_name",
        "customer.first_name",
        "order.first_name",
      ]) ?? undefined,
    buyerLastName:
      findString(record, [
        "buyer_last_name",
        "last_name",
        "customer_last_name",
        "purchaser_last_name",
        "buyer.last_name",
        "customer.last_name",
        "order.last_name",
      ]) ?? undefined,
    ticketTailorEventId:
      findString(record, [
        "ticket_tailor_event_id",
        "event_id",
        "eventId",
        "event_summary.id",
        "event_summary.event_id",
        "event_summary.eventId",
        "event.id",
        "event.event_id",
        "event.object_id",
      ]) ?? undefined,
    paymentStatus:
      findString(record, [
        "payment_status",
        "paymentStatus",
        "payment_state",
        "payment.status",
        "payment.state",
      ]) ?? undefined,
    orderStatus:
      findString(record, ["order_status", "status", "state"]) ?? undefined,
    totalTickets:
      findNumber(record, [
        "total_tickets",
        "ticket_quantity",
        "quantity",
        "num_tickets",
        "number_of_tickets",
        "total_issued_tickets",
      ]) ?? countTicketLikeItems(record),
    rawPayload: record,
  };
}

function createTicketTailorSlug(title: string, date: string) {
  const titlePart = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return `${titlePart || "evento"}-${date}`;
}

function isVisibleTicketTailorEvent(event: PeonyEvent) {
  const today = new Date().toISOString().slice(0, 10);
  const effectiveEndDate = event.endDate ?? event.date;

  return (
    Boolean(event.date) &&
    effectiveEndDate >= today &&
    isPublishedStatus(event.status)
  );
}

function isPublishedStatus(status?: string) {
  if (!status) {
    return true;
  }

  const normalized = status.toLowerCase();
  return !["draft", "private", "deleted", "cancelled", "canceled"].some(
    (blocked) => normalized.includes(blocked),
  );
}

function inferTicketTailorIsPublic(
  record: TicketTailorRecord,
  text: {
    title?: string;
    description?: string;
    shortDescription?: string;
    status?: string;
  },
) {
  if (findBoolean(record, ["private"]) === true) {
    return false;
  }

  if (
    ["hidden", "unlisted", "private_event", "is_private"].some(
      (key) => findBoolean(record, [key]) === true,
    )
  ) {
    return false;
  }

  if (
    [
      "show_on_box_office",
      "showOnBoxOffice",
      "listed",
      "event_page",
      "search",
    ].some((key) => findBoolean(record, [key]) === false)
  ) {
    return false;
  }

  const visibility = findString(record, [
    "visibility",
    "status",
    "state",
    "box_office",
    "box_office.visibility",
    "event_page.visibility",
    "listing_status",
  ]);

  if (visibility && isPrivateVisibilityValue(visibility)) {
    return false;
  }

  const fallbackText = [
    text.title,
    text.description,
    text.shortDescription,
    text.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return !/\bprivate\b/.test(fallbackText);
}

function isPrivateVisibilityValue(value: string) {
  return [
    "hidden",
    "private",
    "unlisted",
    "not listed",
    "not_listed",
    "not-listed",
  ].some((term) => value.toLowerCase().includes(term));
}

function isRecord(value: unknown): value is TicketTailorRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findString(record: TicketTailorRecord, keys: string[]): string | null {
  for (const key of keys) {
    const directValue = getString(getPath(record, key));
    if (directValue) {
      return directValue;
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

function findBoolean(record: TicketTailorRecord, keys: string[]): boolean | null {
  for (const key of keys) {
    const directValue = getBoolean(getPath(record, key));
    if (directValue !== null) {
      return directValue;
    }
  }

  for (const value of Object.values(record)) {
    if (isRecord(value)) {
      const nestedValue = findBoolean(value, keys);
      if (nestedValue !== null) {
        return nestedValue;
      }
    }
  }

  return null;
}

function findNumber(record: TicketTailorRecord, keys: string[]): number | null {
  for (const key of keys) {
    const directValue = getNumber(getPath(record, key));
    if (directValue !== null) {
      return directValue;
    }
  }

  for (const value of Object.values(record)) {
    if (isRecord(value)) {
      const nestedValue = findNumber(value, keys);
      if (nestedValue !== null) {
        return nestedValue;
      }
    }
  }

  return null;
}

function findUrl(record: TicketTailorRecord, keys: string[]): string | null {
  const keyedValue = findString(record, keys);
  if (keyedValue && isUrl(keyedValue)) {
    return keyedValue;
  }

  for (const value of Object.values(record)) {
    const stringValue = getString(value);
    if (stringValue && isUrl(stringValue) && looksLikeMediaOrTicketUrl(stringValue)) {
      return stringValue;
    }
  }

  return null;
}

function findPreferredImageUrl(record: TicketTailorRecord): string | null {
  for (const key of imageKeys) {
    const value = getString(getPath(record, key));
    if (value && isImageUrl(value)) {
      return value;
    }
  }

  return findNestedImageUrl(record);
}

function findNestedImageUrl(record: TicketTailorRecord): string | null {
  const candidates: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(record)) {
    const stringValue = getString(value);
    if (stringValue && looksLikeImageField(key) && isImageUrl(stringValue)) {
      candidates.push({ key, value: stringValue });
    }

    if (isRecord(value)) {
      const nestedValue = findNestedImageUrl(value);
      if (nestedValue) {
        candidates.push({ key, value: nestedValue });
      }
    }
  }

  return (
    candidates.sort((a, b) => imageFieldScore(b.key) - imageFieldScore(a.key))[0]
      ?.value ?? null
  );
}

function findTimestampMs(record: TicketTailorRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = getPath(record, key);
    const ms = valueToMs(value);
    if (ms !== null) return ms;
  }

  return null;
}

function valueToMs(value: unknown): number | null {
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

function formatTimeRome(ms: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Rome",
  }).format(new Date(ms));
}

function buildTimeLabel(startTime?: string, endTime?: string, isMultiDay = false): string | undefined {
  if (!startTime || startTime === "00:00") return undefined;

  if (!isMultiDay && endTime && endTime !== "00:00" && endTime !== startTime) {
    return `${startTime} – ${endTime}`;
  }

  return `Dalle ${startTime}`;
}

function findDate(record: TicketTailorRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = getPath(record, key);
    const normalizedDate =
      normalizeDate(value) ??
      (isRecord(value)
        ? findDate(value, ["date", "iso", "datetime", "utc", "local"])
        : null);

    if (normalizedDate) {
      return normalizedDate;
    }
  }

  return null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }

  return null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function countTicketLikeItems(record: TicketTailorRecord): number | undefined {
  const candidates = [
    getPath(record, "tickets"),
    getPath(record, "issued_tickets"),
    getPath(record, "line_items"),
    getPath(record, "items"),
  ];
  const array = candidates.find(Array.isArray);

  return Array.isArray(array) ? array.length : undefined;
}

function getPath(record: TicketTailorRecord, path: string): unknown {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!isRecord(value)) {
      return undefined;
    }

    return value[segment];
  }, record);
}

function normalizeDate(value: unknown): string | null {
  if (typeof value === "number") {
    return normalizeDateFromString(String(value));
  }

  if (typeof value === "string") {
    return normalizeDateFromString(value);
  }

  return null;
}

function normalizeDateFromString(value: string): string | null {
  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue * (numericValue > 9999999999 ? 1 : 1000))
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isImageUrl(value: string) {
  const normalized = value.toLowerCase();
  return (
    isUrl(value) &&
    (normalized.includes("uploads.tickettailorassets.com") ||
      normalized.includes("cloudfront") ||
      /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(normalized))
  );
}

function looksLikeImageField(key: string) {
  return /image|thumbnail|cover|banner|poster/i.test(key);
}

function imageFieldScore(key: string) {
  const normalized = key.toLowerCase();

  if (/header|cover|banner|hero/.test(normalized)) return 4;
  if (/event.*image|image.*event|poster/.test(normalized)) return 3;
  if (/square|thumb|thumbnail/.test(normalized)) return 2;
  if (/image/.test(normalized)) return 1;

  return 0;
}

function looksLikeMediaOrTicketUrl(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("tickettailor") ||
    normalized.includes("cloudfront") ||
    /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(normalized)
  );
}

function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(h[1-6]|p|div|section|article)>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

function truncateText(text: string, maxLength = 210): string {
  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  const truncated = cleanText.slice(0, maxLength).replace(/\s+\S*$/, "");
  return `${truncated || cleanText.slice(0, maxLength).trim()}…`;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
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
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, entity: string) => entities[entity] ?? match)
    .replace(/\s+/g, " ")
    .trim();
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
  "header_image_url",
  "cover_image",
  "cover_image_url",
  "banner",
  "banner_image",
  "hero_image",
  "event_image",
  "event_image_url",
  "image_url",
  "image",
  "images.header",
  "images.cover",
  "images.banner",
  "images.hero",
  "images.original",
  "images.event",
  "images.event_image",
  "square_image",
  "square_image_url",
  "images.thumbnail",
  "images.square",
  "thumbnail_url",
  "thumbnail",
  "event.header_image",
  "event.header_image_url",
  "event.cover_image",
  "event.cover_image_url",
  "event.banner",
  "event.banner_image",
  "event.hero_image",
  "event.event_image",
  "event.event_image_url",
  "event.image_url",
  "event.image",
  "event.images.header",
  "event.images.cover",
  "event.images.banner",
  "event.images.hero",
  "event.images.original",
  "event.images.event",
  "event.images.event_image",
  "event.square_image",
  "event.square_image_url",
  "event.images.square",
  "event.thumbnail_url",
  "event.thumbnail",
  "event.images.thumbnail",
];
