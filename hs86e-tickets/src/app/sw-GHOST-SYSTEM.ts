/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope &
  typeof globalThis & { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // PWA widget payloads are PUBLIC read-only (event countdown / ticket
      // shell). Cache them network-first so home-screen widgets keep working
      // offline. Registered BEFORE the /api/ catch-all below so it wins.
      matcher: ({ url }) => url.pathname.startsWith("/api/widgets/"),
      handler: new NetworkFirst({
        cacheName: "hs86e-widgets",
        networkTimeoutSeconds: 3,
      }),
    },
    {
      // Never cache any other API response: wallet lookups, scan verdicts,
      // staff auth, and webhooks must always hit the server. Prevents stale or
      // cross-user state being served from the Cache Storage API.
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url }) =>
        request.mode === "navigate" &&
        (url.pathname === "/events" ||
          url.pathname.startsWith("/events/") ||
          url.pathname === "/tickets" ||
          url.pathname.startsWith("/tickets") ||
          url.pathname.startsWith("/widgets") ||
          url.pathname === "/offline"),
      handler: new NetworkFirst({
        cacheName: "hs86e-events-pages",
        networkTimeoutSeconds: 3,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

/* ---------------------------------------------------------------------------
 * PWA Widget events (Chromium Widgets API — experimental, safely ignored on
 * browsers that do not dispatch them). The service worker pre-caches widget
 * payloads on install, refreshes them on update, and opens the app deep link
 * on click/resume. Widget templates are served by the Next.js app at
 * /widgets/[tag] and read their data from /api/widgets/[tag].
 * ------------------------------------------------------------------------- */

interface Hs86eWidgetEvent extends ExtendableEvent {
  widget?: { definition?: { tag?: string }; instance?: { id?: string } };
  action?: string;
  tag?: string;
}

const WIDGET_TAGS = new Set(["next-event-countdown", "quick-ticket-pass"]);

function widgetTagOf(event: Hs86eWidgetEvent): string | undefined {
  return event.widget?.definition?.tag || event.tag;
}

async function cacheWidgetData(tag: string): Promise<void> {
  const url = `/api/widgets/${encodeURIComponent(tag)}`;
  try {
    const cache = await caches.open("hs86e-widgets");
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) await cache.put(url, res.clone());
  } catch {
    // keep any previously cached payload
  }
}

self.addEventListener("widgetinstall", (event) => {
  const tag = widgetTagOf(event as Hs86eWidgetEvent);
  if (!tag || !WIDGET_TAGS.has(tag)) return;
  (event as ExtendableEvent).waitUntil(cacheWidgetData(tag));
});

self.addEventListener("widgetupdate", (event) => {
  const tag = widgetTagOf(event as Hs86eWidgetEvent);
  if (!tag || !WIDGET_TAGS.has(tag)) return;
  (event as ExtendableEvent).waitUntil(cacheWidgetData(tag));
});

self.addEventListener("widgetclick", (event) => {
  const tag = widgetTagOf(event as Hs86eWidgetEvent);
  if (!tag) return;
  const path = tag === "quick-ticket-pass" ? "/tickets" : "/events";
  (event as ExtendableEvent).waitUntil(
    self.clients.openWindow(`${self.location.origin}${path}`).then(() => undefined),
  );
});

self.addEventListener("widgetresume", (event) => {
  const tag = widgetTagOf(event as Hs86eWidgetEvent);
  if (!tag) return;
  const path = tag === "quick-ticket-pass" ? "/tickets" : "/events";
  (event as ExtendableEvent).waitUntil(
    self.clients.openWindow(`${self.location.origin}${path}`).then(() => undefined),
  );
});
