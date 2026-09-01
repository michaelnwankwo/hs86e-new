import { getEnv, hasWooCommerce, isDemoMode } from "@/lib/env";
import type { EventProduct } from "@/lib/types";
import { DEMO_EVENTS, findDemoEvent } from "./demo/catalog";
import { getEventProduct, listEventProducts } from "./wp/woocommerce";
import { getPublicStoreProduct, listPublicStoreProducts } from "./wp/storefront";

export type CatalogSource = "demo" | "wordpress";

export interface CatalogResult {
  events: EventProduct[];
  source: CatalogSource;
  error?: string;
}

function mergeEvents(base: EventProduct[], overlay: EventProduct[]) {
  const map = new Map<string, EventProduct>();
  for (const event of base) map.set(event.id, event);
  for (const event of overlay) map.set(event.id, event);
  return [...map.values()];
}

export async function listEventsResult(): Promise<CatalogResult> {
  const env = getEnv();

  if (!env.WP_BASE_URL) {
    if (isDemoMode()) return { events: DEMO_EVENTS, source: "demo" };
    return { events: [], source: "wordpress", error: "WP_BASE_URL is not set" };
  }

  let events: EventProduct[] = [];
  let error: string | undefined;

  try {
    events = await listPublicStoreProducts();
  } catch (err) {
    error = err instanceof Error ? err.message : "Public store catalog failed";
  }

  if (hasWooCommerce()) {
    try {
      const live = await listEventProducts();
      events = mergeEvents(events, live);
      error = undefined;
    } catch (err) {
      if (events.length === 0) {
        error = err instanceof Error ? err.message : "WooCommerce catalog failed";
      }
    }
  }

  if (events.length === 0 && isDemoMode()) {
    return { events: DEMO_EVENTS, source: "demo", error };
  }

  return { events, source: "wordpress", error: events.length === 0 ? error : undefined };
}

export async function listEvents(): Promise<EventProduct[]> {
  const result = await listEventsResult();
  return result.events;
}

export async function getEvent(slug: string): Promise<EventProduct | null> {
  const env = getEnv();
  if (env.WP_BASE_URL) {
    if (hasWooCommerce()) {
      try {
        const live = await getEventProduct(slug);
        if (live) return live;
      } catch {
        // public fallback
      }
    }
    try {
      return await getPublicStoreProduct(slug);
    } catch {
      return null;
    }
  }
  if (isDemoMode()) return findDemoEvent(slug);
  return null;
}
