"use client";

import { useQuery } from "@tanstack/react-query";
import type { CatalogResult } from "@/services/catalog";
import type { EventProduct } from "@/lib/types";

const POLL_MS = 12_000;

async function fetchCatalog(): Promise<CatalogResult> {
  const res = await fetch("/api/events", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Unable to refresh events");
  const data = (await res.json()) as {
    source: CatalogResult["source"];
    error?: string | null;
    events: EventProduct[];
  };
  return {
    source: data.source,
    error: data.error ?? undefined,
    events: data.events ?? [],
  };
}

export function useLiveEvents(initial: CatalogResult) {
  return useQuery({
    queryKey: ["events-catalog"],
    queryFn: fetchCatalog,
    initialData: initial,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}
