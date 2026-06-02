import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TICKET_TAILOR_PRODUCTS_URL =
  "https://api.tickettailor.com/v1/products";

type TicketTailorProduct = Record<string, unknown>;

type NormalizedProduct = {
  id: string;
  name: string;
  variant?: string;
  description?: string;
  price?: string;
  currency?: string;
  image?: string;
  quantity?: number;
  status?: string;
};

export async function GET() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ products: [] satisfies NormalizedProduct[] });
  }

  try {
    const response = await fetch(TICKET_TAILOR_PRODUCTS_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { products: [] satisfies NormalizedProduct[] },
        { status: 200 },
      );
    }

    const payload = await response.json();
    const products = extractItems(payload)
      .filter(isVisibleStoreProduct)
      .map(normalizeProduct);

    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ products: [] satisfies NormalizedProduct[] });
  }
}

function extractItems(payload: unknown): TicketTailorProduct[] {
  if (Array.isArray(payload)) {
    return payload.filter(isObject);
  }

  if (!isObject(payload)) {
    return [];
  }

  const candidates = [payload.data, payload.items, payload.products];
  const list = candidates.find(Array.isArray);

  return list?.filter(isObject) ?? [];
}

function isVisibleStoreProduct(product: TicketTailorProduct) {
  return (
    String(product.sell_in_store).toLowerCase() === "true" &&
    String(product.status).toUpperCase() === "ON_SALE"
  );
}

function normalizeProduct(product: TicketTailorProduct): NormalizedProduct {
  const currency = getString(product.currency) ?? "EUR";

  return {
    id: getString(product.id) ?? getString(product.object_id) ?? "",
    name: getString(product.name) ?? getString(product.title) ?? "Prodotto",
    variant:
      getString(product.variant) ??
      getString(product.variant_name) ??
      getString(product.option),
    description: stripHtmlToText(
      getString(product.description) ?? getString(product.details) ?? "",
    ),
    price: formatPrice(getNumber(product.price), currency),
    currency,
    image:
      getString(product.image) ??
      getString(product.image_url) ??
      getString(product.thumbnail) ??
      getNestedString(product, ["images", "original"]) ??
      getNestedString(product, ["images", "thumbnail"]),
    quantity:
      getNumber(product.quantity) ??
      getNumber(product.stock) ??
      getNumber(product.available_quantity),
    status: getString(product.status),
  };
}

function formatPrice(priceInCents: number | undefined, currency: string) {
  if (typeof priceInCents !== "number") {
    return undefined;
  }

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
  }).format(priceInCents / 100);
}

function stripHtmlToText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|li|h1|h2|h3|h4)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getNestedString(
  value: TicketTailorProduct,
  path: [string, string],
) {
  const parent = value[path[0]];

  if (!isObject(parent)) {
    return undefined;
  }

  return getString(parent[path[1]]);
}

function isObject(value: unknown): value is TicketTailorProduct {
  return typeof value === "object" && value !== null;
}
