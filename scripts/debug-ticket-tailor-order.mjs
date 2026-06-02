import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const apiBaseUrl = "https://api.tickettailor.com";
const orderId = process.argv[2];

loadDotEnvLocal();

const apiKey = process.env.TICKET_TAILOR_API_KEY;

if (!orderId) {
  console.log("Uso: node scripts/debug-ticket-tailor-order.mjs or_XXXXXXXX");
  process.exit(1);
}

console.log(`.env.local presente: ${existsSync(resolve(process.cwd(), ".env.local")) ? "si" : "no"}`);
console.log(`API key presente: ${apiKey ? "si" : "no"}`);

if (!apiKey) {
  console.log("TICKET_TAILOR_API_KEY mancante. Nessuna chiamata API eseguita.");
  process.exit(0);
}

const headers = {
  Accept: "application/json",
  Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
};

const order = await findOrder(orderId);

if (!order) {
  console.log(`Ordine ${orderId} non trovato.`);
  process.exit(0);
}

console.log("\nOrder");
console.log({
  id: findString(order, ["id", "order_id", "orderId"]),
  status: findString(order, ["status", "state", "order_status"]),
});

console.log("\nBuyer details");
console.dir(getPath(order, "buyer_details") ?? collectBuyerFields(order), {
  depth: 5,
});

console.log("\nEvent summary");
console.dir(getPath(order, "event_summary") ?? null, { depth: 6 });

console.log("\nIssued tickets event ids");
console.table(collectNestedEventIds(getPath(order, "issued_tickets")));

console.log("\nLine items event ids");
console.table(collectNestedEventIds(getPath(order, "line_items")));

console.log("\nTutti i possibili campi event_id / event_series_id trovati");
console.table(collectEventIdentifierFields(order));

async function findOrder(id) {
  const detail = await fetchRecord(`${apiBaseUrl}/v1/orders/${encodeURIComponent(id)}`);
  if (detail) {
    return detail;
  }

  const list = await fetchRecords(`${apiBaseUrl}/v1/orders`);
  return list.find(
    (item) => findString(item, ["id", "order_id", "orderId"]) === id,
  );
}

async function fetchRecord(url) {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    return extractRecord(await response.json());
  } catch {
    return null;
  }
}

async function fetchRecords(url) {
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    return extractRecords(await response.json());
  } catch {
    return [];
  }
}

function collectBuyerFields(record) {
  return {
    buyer_email: findString(record, ["buyer_email", "email", "customer_email"]),
    buyer_first_name: findString(record, [
      "buyer_first_name",
      "first_name",
      "customer_first_name",
    ]),
    buyer_last_name: findString(record, [
      "buyer_last_name",
      "last_name",
      "customer_last_name",
    ]),
  };
}

function collectNestedEventIds(value, prefix = "") {
  const rows = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      rows.push(...collectNestedEventIds(item, `${prefix}[${index}]`));
    });
    return rows;
  }

  if (!isRecord(value)) {
    return rows;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (/event(_series)?_id|eventId|eventSeriesId/i.test(key)) {
      rows.push({ field: path, value: String(child) });
    }

    if (isRecord(child) || Array.isArray(child)) {
      rows.push(...collectNestedEventIds(child, path));
    }
  }

  return rows;
}

function collectEventIdentifierFields(record, prefix = "") {
  return collectNestedEventIds(record, prefix);
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
    if (!isRecord(value)) {
      return undefined;
    }

    return value[segment];
  }, record);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
