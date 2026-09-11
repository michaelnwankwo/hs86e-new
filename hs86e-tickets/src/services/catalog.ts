import { getEnvIssues, getEnvSafe, hasWooCommerce, isDemoMode } from "@/lib/env";
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

const CONFIG_ERROR_MESSAGE =
  "Event feed is temporarily unavailable while we finish a configuration update. Please check back shortly.";

function mergeEvents(base: EventProduct[], overlay: EventProduct[]) {
  const map = new Map<string, EventProduct>();
  for (const event of base) map.set(event.id, event);
  for (const event of overlay) map.set(event.id, event);
  return [...map.values()];
}

function emptyCatalogWithIssue(): CatalogResult | null {
  const issues = getEnvIssues();
  if (!issues) return null;
  // Never leak raw secret names/validation detail into the rendered page.
  console.warn(`[hs86e] Catalog falling back to an empty list: ${issues}`);
  if (isDemoMode()) return { events: DEMO_EVENTS, source: "demo" };
  return { events: [], source: "wordpress", error: CONFIG_ERROR_MESSAGE };
}

/**
 * Total function: NEVER rejects. Whatever the configuration or upstream state,
 * the events page renders — with live events, demo events, or a graceful
 * branded notice — instead of throwing a server-side exception.
 */
export async function listEventsResult(): Promise<CatalogResult> {
  try {
    const degraded = emptyCatalogWithIssue();
    if (degraded) return degraded;

    const env = getEnvSafe();

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
  } catch (err) {
    // Last-resort guard: the events page must always render.
    console.error("[hs86e] listEventsResult recovered from unexpected failure:", err);
    if (isDemoMode()) return { events: DEMO_EVENTS, source: "demo" };
    return { events: [], source: "wordpress", error: CONFIG_ERROR_MESSAGE };
  }
}

export async function listEvents(): Promise<EventProduct[]> {
  const result = await listEventsResult();
  return result.events;
}

/** Total function: NEVER rejects. A failure reads as "event not found". */
export async function getEvent(slug: string): Promise<EventProduct | null> {
  try {
    if (getEnvIssues()) return isDemoMode() ? findDemoEvent(slug) : null;
    const env = getEnvSafe();
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
  } catch (err) {
    console.error(`[hs86e] getEvent("${slug}") recovered from unexpected failure:`, err);
    return null;
  }
}
