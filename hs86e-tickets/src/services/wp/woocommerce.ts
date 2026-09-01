import { stripHtml } from "@/lib/utils";
import type { EventProduct, TicketTier, TicketVariation } from "@/lib/types";
import { LOGO_PATH } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import { wcClient } from "./client";
import { isFooEventsProduct, parseFooEventsSchedule, venueFromMeta } from "./dates";

interface WcImage {
  src?: string;
}

interface WcVariation {
  id: number;
  sku?: string;
  price?: string;
  regular_price?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  attributes?: { name: string; option: string }[];
}

interface WcProduct {
  id: number;
  slug: string;
  name: string;
  description?: string;
  short_description?: string;
  images?: WcImage[];
  price?: string;
  regular_price?: string;
  permalink?: string;
  type?: string;
  status?: string;
  stock_quantity?: number | null;
  meta_data?: { key: string; value: unknown }[];
  attributes?: { name: string; options?: string[] }[];
}

function meta(product: WcProduct, key: string) {
  const row = product.meta_data?.find((m) => m.key === key);
  return row?.value == null ? undefined : String(row.value);
}

function asTier(raw: string): TicketTier {
  const v = raw.toLowerCase();
  if (v.includes("table")) return "Table";
  if (v.includes("vip")) return "VIP";
  return "Regular";
}

function toNumber(value: string | undefined, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function mapWcProduct(
  product: WcProduct,
  variations: WcVariation[] = [],
  storeCurrency = "NGN",
): EventProduct {
  const currency = meta(product, "_hs86e_currency") || storeCurrency;
  const mappedVariations: TicketVariation[] =
    variations.length > 0
      ? variations.map((v) => {
          const option =
            v.attributes?.find((a) => /tier|ticket|variation/i.test(a.name))?.option ||
            v.attributes?.[0]?.option ||
            v.sku ||
            "Regular";
          return {
            id: String(v.id),
            productId: String(product.id),
            tier: asTier(option),
            name: option,
            price: toNumber(v.price || v.regular_price),
            currency,
            stock: v.manage_stock ? v.stock_quantity ?? 0 : null,
            sku: v.sku || `HS86E-${product.id}-${v.id}`,
          };
        })
      : [
          {
            id: String(product.id),
            productId: String(product.id),
            tier: asTier(product.name),
            name: product.attributes?.find((a) => /tier|ticket/i.test(a.name))?.options?.[0] || "Regular",
            price: toNumber(product.price || product.regular_price),
            currency,
            stock: product.stock_quantity ?? null,
            sku: `HS86E-${product.id}`,
          },
        ];

  const schedule = parseFooEventsSchedule(product.meta_data);
  const gallery = [...new Set((product.images ?? []).map((img) => img.src).filter((src): src is string => Boolean(src)))];

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    description: stripHtml(product.description || ""),
    shortDescription: stripHtml(product.short_description || product.description || ""),
    image: gallery[0] || LOGO_PATH,
    gallery,
    venue: venueFromMeta(product.meta_data),
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    doorsAt: schedule.doorsAt,
    currency,
    variations: mappedVariations,
    category: "event-tickets",
    featured: isFooEventsProduct(product.meta_data),
  };
}

async function storeCurrency() {
  try {
    const wc = wcClient();
    const { data } = await wc.get<{ id?: string; value?: string }[]>("/settings/general");
    const row = Array.isArray(data) ? data.find((s) => s.id === "woocommerce_currency") : undefined;
    return row?.value || "NGN";
  } catch {
    return "NGN";
  }
}

async function resolveCategoryId(slug: string) {
  const wc = wcClient();
  const { data } = await wc.get<{ id: number; slug: string }[]>("/products/categories", {
    params: { slug, per_page: 10 },
  });
  return Array.isArray(data) && data[0] ? data[0].id : null;
}

async function hydrate(product: WcProduct, currency: string): Promise<EventProduct> {
  const wc = wcClient();
  let variations: WcVariation[] = [];
  if (product.type === "variable") {
    const res = await wc.get<WcVariation[]>(`/products/${product.id}/variations`, {
      params: { per_page: 50 },
    });
    variations = Array.isArray(res.data) ? res.data : [];
  }
  return mapWcProduct(product, variations, currency);
}

export async function listEventProducts(): Promise<EventProduct[]> {
  const wc = wcClient();
  const env = getEnv();
  const currency = await storeCurrency();
  const slug = env.WC_CATEGORY_SLUG;
  const categoryId = slug ? await resolveCategoryId(slug).catch(() => null) : null;

  const { data } = await wc.get<WcProduct[]>("/products", {
    params: {
      per_page: 40,
      status: "publish",
      ...(categoryId ? { category: categoryId } : {}),
    },
  });
  const products = Array.isArray(data) ? data : [];
  const mapped: EventProduct[] = [];
  for (const product of products) {
    mapped.push(await hydrate(product, currency));
  }
  return mapped;
}

export async function getEventProduct(slugOrId: string): Promise<EventProduct | null> {
  const wc = wcClient();
  const currency = await storeCurrency();
  const bySlug = await wc.get<WcProduct[]>("/products", { params: { slug: slugOrId } });
  let product = Array.isArray(bySlug.data) ? bySlug.data[0] : undefined;
  if (!product && /^\d+$/.test(slugOrId)) {
    const byId = await wc.get<WcProduct>(`/products/${slugOrId}`);
    product = byId.data;
  }
  if (!product) return null;
  return hydrate(product, currency);
}

export interface CreateWcOrderInput {
  event: EventProduct;
  variationId: string;
  quantity: number;
  name: string;
  email: string;
  phone: string;
  gateway: "stripe" | "flutterwave";
}

export async function createPendingOrder(input: CreateWcOrderInput) {
  const wc = wcClient();
  const variation = input.event.variations.find((v) => v.id === input.variationId);
  if (!variation) throw new Error("Unknown ticket tier");

  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName;

  const { data } = await wc.post("/orders", {
    status: "pending",
    currency: input.event.currency,
    billing: {
      first_name: firstName,
      last_name: lastName,
      email: input.email,
      phone: input.phone,
    },
    line_items: [
      {
        product_id: Number(input.event.id),
        variation_id:
          variation.id !== input.event.id ? Number(variation.id) : undefined,
        quantity: input.quantity,
      },
    ],
    meta_data: [
      { key: "_hs86e_gateway", value: input.gateway },
      { key: "_hs86e_event_slug", value: input.event.slug },
      { key: "WooCommerceEventsAttendeeName", value: input.name },
      { key: "WooCommerceEventsAttendeeEmail", value: input.email },
      { key: "WooCommerceEventsAttendeeTelephone", value: input.phone },
      { key: "_hs86e_processed_events", value: "[]" },
    ],
    customer_note: `HS86E guest checkout · ${input.gateway}`,
  });

  return {
    id: Number(data.id),
    orderKey: String(data.order_key),
    total: String(data.total),
    currency: String(data.currency || input.event.currency),
    status: String(data.status),
  };
}

export async function getOrder(orderId: number) {
  const wc = wcClient();
  const { data } = await wc.get(`/orders/${orderId}`);
  return data as {
    id: number;
    order_key: string;
    status: string;
    billing?: { email?: string; first_name?: string; last_name?: string; phone?: string };
    meta_data?: { key: string; value: unknown }[];
    line_items?: { name: string; quantity: number }[];
    total?: string;
    currency?: string;
  };
}

export async function completeOrder(orderId: number, gatewayEventId: string) {
  const order = await getOrder(orderId);
  const processedRaw = order.meta_data?.find((m) => m.key === "_hs86e_processed_events")?.value;
  let processed: string[] = [];
  try {
    processed = processedRaw ? (JSON.parse(String(processedRaw)) as string[]) : [];
  } catch {
    processed = [];
  }
  if (processed.includes(gatewayEventId)) {
    return { order, already: true };
  }
  processed.push(gatewayEventId);
  const wc = wcClient();
  const { data } = await wc.put(`/orders/${orderId}`, {
    status: "completed",
    meta_data: [{ key: "_hs86e_processed_events", value: JSON.stringify(processed) }],
  });
  return { order: data, already: false };
}

export async function listCompletedOrderIdsByEmail(email: string): Promise<number[]> {
  const wc = wcClient();
  const { data } = await wc.get<{ id: number; billing?: { email?: string }; status?: string }[]>(
    "/orders",
    {
      params: {
        search: email,
        per_page: 20,
        status: "completed,processing",
      },
    },
  );
  const rows = Array.isArray(data) ? data : [];
  const token = email.trim().toLowerCase();
  return rows
    .filter((row) => (row.billing?.email || "").toLowerCase() === token)
    .map((row) => row.id);
}

export async function addOrderMeta(orderId: number, key: string, value: string) {
  const wc = wcClient();
  await wc.put(`/orders/${orderId}`, {
    meta_data: [{ key, value }],
  });
}
