"use client";

import { useEffect } from "react";
import type { IssuedTicket } from "@/lib/types";
import { syncActiveTicket, toActiveTicketSnapshot } from "@/lib/widget-storage";

/**
 * Mirrors the user's active ticket pass into the shared widget stores
 * (localStorage for the web PWA widget + App Group preferences for native
 * iOS/Android widgets) whenever a pass is loaded or transferred.
 *
 * Usage: call once in a component that owns the current ticket list, e.g.
 *
 *   const active = tickets.find((t) => t.holder !== false && t.qrPayload) ?? null;
 *   useWidgetSync(active);
 */
export function useWidgetSync(ticket: IssuedTicket | null | undefined): void {
  const snapshotKey = ticket ? JSON.stringify(toActiveTicketSnapshot(ticket)) : "";
  useEffect(() => {
    void syncActiveTicket(ticket ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey]);
}
