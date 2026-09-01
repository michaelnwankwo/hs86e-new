"use client";

import { EventCard } from "@/components/ticketing/EventCard";
import { CatalogBanner } from "@/components/layout/CatalogBanner";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useLiveEvents } from "@/hooks/useLiveEvents";
import type { CatalogResult } from "@/services/catalog";

export function EventList({ initial }: { initial: CatalogResult }) {
  const query = useLiveEvents(initial);
  const catalog = query.data ?? initial;
  const overlay = query.isFetching && catalog.events.length === 0;

  return (
    <>
      <CatalogBanner catalog={catalog} />
      {catalog.events.length === 0 ? (
        <p className="rounded-2xl border border-gold/20 bg-surface-raised px-4 py-8 text-center text-sm text-ink-muted">
          No published ticket products were returned from WordPress.
        </p>
      ) : (
        <div className="space-y-5">
          {catalog.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
      <LoadingOverlay isLoading={overlay} />
    </>
  );
}
