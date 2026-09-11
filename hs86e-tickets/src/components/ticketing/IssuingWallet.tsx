"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TICKET_POLL_MS } from "@/lib/constants";
import type { IssuedTicket } from "@/lib/types";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { TicketWallet } from "./TicketWallet";
import { patchWalletTicket, readWallet, writeWallet } from "@/lib/wallet-store";
import { Button } from "@/components/ui/Button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useWidgetSync } from "@/hooks/useWidgetSync";

interface LookupResult {
  tickets: IssuedTicket[];
  /** Human-readable error for 4xx/5xx/network failures. */
  error?: string;
  /** HTTP status of the response (0 for network failure). */
  status: number;
}

/**
 * Fetch the ticket wallet for a lookup. Never throws: every HTTP outcome
 * (200 / 401 / 404 / 429 / 500 / network failure) is normalized into a
 * LookupResult so the caller can guarantee its loading state is cleared.
 */
async function fetchTickets(
  order: string,
  key?: string,
  email?: string,
  ticket?: string,
): Promise<LookupResult> {
  const params = new URLSearchParams();
  if (ticket) params.set("ticketId", ticket);
  if (order) params.set("order", order);
  if (key) params.set("key", key);
  if (email) params.set("email", email);

  // Abort hung requests so the loading state ALWAYS settles (spinner can
  // never spin forever, even on a stalled proxy / serverless cold start).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(`/api/tickets?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    return {
      tickets: [],
      error:
        err instanceof Error && err.name === "AbortError"
          ? "The request timed out. Check your connection and retry."
          : err instanceof Error
            ? err.message
            : "Network error",
      status: 0,
    };
  }

  let tickets: IssuedTicket[] = [];
  let errorMsg: string | undefined;
  try {
    const payload = (await res.json()) as
      | { tickets?: unknown; error?: string; issuing?: boolean }
      | null
      | undefined;
    if (payload && Array.isArray(payload.tickets)) {
      tickets = payload.tickets.filter(
        (row): row is IssuedTicket =>
          Boolean(row) && typeof row === "object" && Boolean((row as IssuedTicket).ticketId),
      );
    }
    errorMsg = payload?.error;
  } catch {
    clearTimeout(timeout);
    return { tickets: [], error: `Server returned ${res.status}`, status: res.status };
  }
  clearTimeout(timeout);

  if (!res.ok) {
    return { tickets, error: errorMsg || `Server returned ${res.status}`, status: res.status };
  }
  return { tickets, status: res.status };
}

export function IssuingWallet({
  order,
  orderKey,
  email,
  ticket,
}: {
  order: string;
  orderKey?: string;
  email?: string;
  ticket?: string;
}) {
  const enabled = Boolean(ticket || order || email || orderKey);
  const [local, setLocal] = useState<IssuedTicket[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [remote, setRemote] = useState<IssuedTicket[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // ---- hydrate passes already saved on this device --------------------------
  // try/finally guarantees `hydrated` ALWAYS resolves: a storage exception or
  // a malformed stored row must never leave the full-screen overlay mounted.
  useEffect(() => {
    try {
      const stored = readWallet().filter((row) => {
        if (ticket) return row.ticketId === ticket;
        if (order && row.orderId === Number(order)) return true;
        if (email) {
          const token = String(email).trim().toLowerCase();
          // Null-safe: redacted passes may be missing some fields, and old
          // rows may hold non-string values — String() coerces both safely.
          return (
            String(row.attendeeEmail || "").toLowerCase() === token ||
            String(row.assignedEmail || "").toLowerCase() === token ||
            String(row.purchaserEmail || "").toLowerCase() === token
          );
        }
        return !enabled;
      });
      setLocal(stored);
    } catch {
      // storage unavailable / corrupt row — fall back to an empty wallet
      setLocal([]);
    } finally {
      setHydrated(true);
    }
  }, [enabled, order, email, ticket]);

  // ---- explicit, always-settling lookup with bounded polling ----------------
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    // Only ORDER lookups race with the payment webhook (which mints passes a
    // beat after the browser redirects), so only they get a short poll. A
    // ticket-ID or email lookup is definitive: a 404 means "no match" and we
    // render that empty state immediately — no endless spinner pulse.
    const maxPoll = order ? 4 : 0;

    async function lookup() {
      if (cancelled) return;
      setLoading(true);
      let result: LookupResult;
      try {
        result = await fetchTickets(order, orderKey, email, ticket);
      } catch (err) {
        result = {
          tickets: [],
          error: err instanceof Error ? err.message : "Lookup failed",
          status: 0,
        };
      } finally {
        // Loading-state guarantee: the spinner always unmounts after every
        // fetch settles, regardless of 200 / 401 / 404 / 429 / 500 / network.
        if (!cancelled) setLoading(false);
      }
      if (cancelled) return;

      attempts += 1;

      if (result.tickets.length > 0) {
        setRemote(result.tickets);
        setLookupError(null);
        writeWallet(result.tickets);
        setLocal(result.tickets);
        return;
      }

      // Empty result.
      if (result.status >= 429 || result.status === 0 || result.status >= 500) {
        // Transient/hard failure (429 / 5xx / network): stop auto-polling and
        // surface the error with a Retry action. No spinner churn.
        setRemote([]);
        setLookupError(result.error || "Unable to load tickets");
        return;
      }

      // Definitive empty response (404 "no match", or an order still being
      // issued). Poll only briefly for order lookups, then settle into the
      // empty state so the spinner never lingers.
      setRemote([]);
      if (attempts < maxPoll) {
        timer = window.setTimeout(() => void lookup(), TICKET_POLL_MS);
      }
    }

    void lookup();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [enabled, order, orderKey, email, ticket, reloadToken]);

  const retry = useCallback(() => {
    setLookupError(null);
    setLoading(false);
    setReloadToken((n) => n + 1);
  }, []);

  const tickets = remote.length > 0 ? remote : local;
  const overlay = !hydrated || loading;

  // Active pass for native/web widgets: the first pass that still holds a
  // live QR. Recomputes on load and after a transfer (which voids the QR),
  // so the widget store always mirrors the current door-valid pass.
  const activeTicket = useMemo(
    () =>
      tickets.find((row) => row.holder !== false && row.qrPayload) ??
      tickets.find((row) => row.qrPayload) ??
      null,
    [tickets],
  );
  useWidgetSync(activeTicket);

  function handleTicketChange(updated: IssuedTicket) {
    patchWalletTicket(updated.ticketId, updated);
    setLocal((current) =>
      current.map((row) => (row.ticketId === updated.ticketId ? { ...row, ...updated } : row)),
    );
  }

  const focused = useMemo(
    () => (ticket ? tickets.find((row) => row.ticketId === ticket) : undefined),
    [ticket, tickets],
  );

  const body = (() => {
    if (!enabled) {
      if (tickets.length === 0) return null;
      return <TicketWallet tickets={tickets} focusTicketId={ticket} onTicketChange={handleTicketChange} />;
    }

    if (lookupError && tickets.length === 0) {
      return (
        <div className="space-y-3">
          <StatusBanner tone="danger">{lookupError}</StatusBanner>
          <Button variant="ghost" block onClick={retry}>
            Retry
          </Button>
        </div>
      );
    }

    if (tickets.length === 0 && !loading) {
      return (
        <div className="space-y-3">
          <StatusBanner tone="warn">
            No pass matched. Use ticket ID, order ID, or the checkout email — any one is enough.
          </StatusBanner>
          <Button variant="ghost" block onClick={retry}>
            Retry
          </Button>
        </div>
      );
    }

    if (tickets.length === 0) return null;

    return (
      <div className="space-y-3">
        {focused && focused.holder !== false && focused.qrPayload ? (
          <StatusBanner tone="success">
            This is the live pass for {focused.ticketId}. The QR below is the current signed code.
          </StatusBanner>
        ) : null}
        <TicketWallet tickets={tickets} focusTicketId={ticket} onTicketChange={handleTicketChange} />
      </div>
    );
  })();

  return (
    <>
      {body}
      <LoadingOverlay isLoading={overlay} />
    </>
  );
}
