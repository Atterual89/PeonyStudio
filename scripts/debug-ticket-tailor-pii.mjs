import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const apiBaseUrl = "https://api.tickettailor.com";
const orderId = process.argv[2] ?? "or_77144989";

loadDotEnvLocal();

const apiKey = process.env.TICKET_TAILOR_API_KEY;

console.log(`.env.local presente: ${existsSync(resolve(process.cwd(), ".env.local")) ? "si" : "no"}`);
console.log(`API key presente: ${apiKey ? "si" : "no"}`);
console.log(`API key lunghezza: ${apiKey ? apiKey.length : 0}`);
console.log(`Ordine test: ${orderId}`);

if (!apiKey) {
  console.log("TICKET_TAILOR_API_KEY mancante. Nessuna chiamata API eseguita.");
  process.exit(0);
}

const headers = {
  Accept: "application/json",
  Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
};

const detailResponse = await fetchJson(
  `${apiBaseUrl}/v1/orders/${encodeURIComponent(orderId)}`,
);
const detailOrder = extractRecord(detailResponse.payload);
const detailEventId = detailOrder
  ? findString(detailOrder, [
      "event_summary.event_id",
      "event_summary.id",
      "issued_tickets.0.event_id",
      "line_items.0.event_id",
    ])
  : null;

let listResponse = null;
let listOrder = null;

if (detailEventId) {
  listResponse = await fetchJson(
    `${apiBaseUrl}/v1/orders?event_id=${encodeURIComponent(detailEventId)}&limit=100`,
  );
  const listOrders = extractRecords(listResponse.payload);
  listOrder = listOrders.find(
    (item) => findString(item, ["id", "order_id", "orderId"]) === orderId,
  );
}

console.log("\nGET /v1/orders/:order_id");
console.log({
  status: detailResponse.status,
  ok: detailResponse.ok,
  topLevelFields: detailOrder ? Object.keys(detailOrder).sort() : [],
  eventId: detailEventId,
  pii: detailOrder ? inspectPii(detailOrder) : null,
});

console.log("\nGET /v1/orders?event_id=...");
console.log({
  status: listResponse?.status ?? null,
  ok: listResponse?.ok ?? null,
  foundOrderInList: Boolean(listOrder),
  topLevelFields: listOrder ? Object.keys(listOrder).sort() : [],
  pii: listOrder ? inspectPii(listOrder) : null,
});

console.log("\nAPI/privacy note");
console.log(
  "Se sia lista sia dettaglio mostrano MASKED per buyer/holder, il masking arriva da Ticket Tailor/API key e non dal codice locale.",
);

async function fetchJson(url) {
  try {
    const response = await fetch(url, { headers });
    const text = await response.text();
    let payload = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { parse_error: true, text_length: text.length };
    }

    return {
      url,
      status: response.status,
      ok: response.ok,
      payload,
    };
  } catch (error) {
    return {
      url,
      status: null,
      ok: false,
      payload: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

function inspectPii(order) {
  const issuedTickets = getPath(order, "issued_tickets");
  const firstTicket = Array.isArray(issuedTickets) ? issuedTickets[0] : null;

  return {
    buyer_details: {
      first_name: classifyValue(getPath(order, "buyer_details.first_name")),
      last_name: classifyValue(getPath(order, "buyer_details.last_name")),
      name: classifyValue(getPath(order, "buyer_details.name")),
      email: classifyValue(getPath(order, "buyer_details.email")),
      phone: classifyValue(getPath(order, "buyer_details.phone")),
    },
    direct_fields: {
      first_name: classifyValue(getPath(order, "first_name")),
      last_name: classifyValue(getPath(order, "last_name")),
      email: classifyValue(getPath(order, "email")),
      buyer_email: classifyValue(getPath(order, "buyer_email")),
    },
    issued_tickets_first: firstTicket
      ? {
          first_name: classifyValue(getPath(firstTicket, "first_name")),
          last_name: classifyValue(getPath(firstTicket, "last_name")),
          name: classifyValue(getPath(firstTicket, "name")),
          email: classifyValue(getPath(firstTicket, "email")),
          holder_first_name: classifyValue(getPath(firstTicket, "holder_first_name")),
          holder_last_name: classifyValue(getPath(firstTicket, "holder_last_name")),
          holder_email: classifyValue(getPath(firstTicket, "holder_email")),
        }
      : null,
  };
}

function classifyValue(value) {
  if (value === undefined || value === null) {
    return "MISSING";
  }

  if (typeof value !== "string") {
    return typeof value;
  }

  if (!value.trim()) {
    return "EMPTY";
  }

  return value.trim() === "****" ? "MASKED" : "REAL_VALUE";
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

  const candidates = [record.data, record.items, record.orders, record.results];
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

  if (isRecord(payload.order)) {
    return payload.order;
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

  return null;
}

function getPath(record, path) {
  return path.split(".").reduce((value, segment) => {
    if (Array.isArray(value)) {
      return value[Number(segment)];
    }

    if (!isRecord(value)) {
      return undefined;
    }

    return value[segment];
  }, record);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
