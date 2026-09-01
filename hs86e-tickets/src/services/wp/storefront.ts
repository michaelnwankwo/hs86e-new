import axios from "axios";
import { LOGO_PATH } from "@/lib/constants";
import { stripHtml } from "@/lib/utils";
import type { EventProduct, TicketVariation } from "@/lib/types";
import { getEnv } from "@/lib/env";

interface StoreImage {
  src?: string;
  thumbnail?: string;
}

interface StoreProduct {
  id: number;
  name: string;
  slug: string;
  type?: string;
  description?: string;
  short_description?: string;
  permalink?: string;
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  images?: StoreImage[];
  prices?: {
    price?: string;
    regular_price?: string;
    currency_code?: string;
    currency_minor_unit?: number;
  };
  categories?: { id: number; slug: string; name: string }[];
  variations?: { id: number }[];
}

interface FooEventPost {
  ID?: number;
  id?: number;
  post_title?: string;
  post_name?: string;
  post_content?: string;
  post_excerpt?: string;
  post_date?: string;
  post_status?: string;
}

const LOCAL_ART: Record<string, string> = {
  "global-waitlist": "/events/global-waitlist.jpg",
};

function storeClient() {
  const base = getEnv().WP_BASE_URL;
  if (!base) throw new Error("WP_BASE_URL is not set");
  return axios.create({
    baseURL: `${base}/wp-json`,
    timeout: 15_000,
    headers: { "User-Agent": "HS86E-Tickets/1.0" },
  });
}

function money(raw: string | undefined, minor = 2) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** minor;
}

function uniqueImages(images: StoreImage[] | undefined) {
  const urls = (images ?? [])
    .map((img) => img.src || img.thumbnail)
    .filter((src): src is string => Boolean(src));
  return [...new Set(urls)];
}

function mapStoreProduct(product: StoreProduct, fallbackDate?: string): EventProduct {
  const currency = product.prices?.currency_code || "USD";
  const minor = product.prices?.currency_minor_unit ?? 2;
  const price = money(product.prices?.price || product.prices?.regular_price, minor);
  const gallery = uniqueImages(product.images);
  const variation: TicketVariation = {
    id: String(product.id),
    productId: String(product.id),
    tier: "Regular",
    name: product.type === "simple" && price === 0 ? "Waitlist" : "Regular",
    price,
    currency,
    stock: product.is_in_stock === false ? 0 : null,
    sku: `HS86E-${product.id}`,
  };

  return {
    id: String(product.id),
    slug: product.slug,
    name: product.name,
    description: stripHtml(product.description || ""),
    shortDescription: stripHtml(product.short_description || product.description || ""),
    image: LOCAL_ART[product.slug] || gallery[0] || LOGO_PATH,
    gallery,
    venue: {
      name: "Hot Since 86 Entertainment",
      city: "",
      address: "",
    },
    startsAt: fallbackDate || new Date().toISOString(),
    endsAt: "",
    doorsAt: "",
    currency,
    variations: [variation],
    category: product.categories?.[0]?.slug || "event-tickets",
    featured: true,
  };
}

export async function listPublicStoreProducts(): Promise<EventProduct[]> {
  const client = storeClient();
  const { data } = await client.get<StoreProduct[]>("/wc/store/v1/products", {
    params: { per_page: 40 },
  });
  const products = Array.isArray(data) ? data : [];

  let fooDates = new Map<string, string>();
  try {
    const fe = await client.get<FooEventPost[]>("/fooevents/v1/events");
    const rows = Array.isArray(fe.data) ? fe.data : [];
    fooDates = new Map(
      rows
        .filter((row) => row.post_name && row.post_date)
        .map((row) => [String(row.post_name), new Date(String(row.post_date)).toISOString()]),
    );
  } catch {
    fooDates = new Map();
  }

  return products
    .filter((p) => p.slug)
    .map((p) => mapStoreProduct(p, fooDates.get(p.slug)));
}

export async function getPublicStoreProduct(slugOrId: string): Promise<EventProduct | null> {
  const client = storeClient();
  if (/^\d+$/.test(slugOrId)) {
    try {
      const { data } = await client.get<StoreProduct>(`/wc/store/v1/products/${slugOrId}`);
      if (data?.id) return mapStoreProduct(data);
    } catch {
      return null;
    }
  }
  const { data } = await client.get<StoreProduct[]>("/wc/store/v1/products", {
    params: { slug: slugOrId },
  });
  const product = Array.isArray(data) ? data[0] : undefined;
  return product ? mapStoreProduct(product) : null;
}
