"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QUEUE_REPLAY_POLL_MS, SCAN_QUEUE_KEY } from "@/lib/constants";
import { safeJson } from "@/lib/utils";
import type { QueuedScan } from "@/lib/types";

function readQueue(): QueuedScan[] {
  if (typeof window === "undefined") return [];
  return safeJson<QueuedScan[]>(window.localStorage.getItem(SCAN_QUEUE_KEY), []);
}

function writeQueue(items: QueuedScan[]) {
  window.localStorage.setItem(SCAN_QUEUE_KEY, JSON.stringify(items));
}

export function useScanQueue() {
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [syncing, setSyncing] = useState(false);
  const replayInFlight = useRef(false);

  useEffect(() => {
    setQueue(readQueue());
  }, []);

  const persist = useCallback((items: QueuedScan[]) => {
    writeQueue(items);
    setQueue(items);
  }, []);

  const enqueue = useCallback(
    (scan: Omit<QueuedScan, "synced">) => {
      const current = readQueue();
      if (current.some((item) => item.ticketId === scan.ticketId && !item.synced)) {
        return;
      }
      persist([...current, { ...scan, synced: false }]);
    },
    [persist],
  );

  const pending = useMemo(() => queue.filter((item) => !item.synced), [queue]);

  const replay = useCallback(async () => {
    if ((typeof navigator !== "undefined" && !navigator.onLine) || replayInFlight.current) return;
    const unsynced = readQueue().filter((item) => !item.synced);
    if (unsynced.length === 0) return;
    replayInFlight.current = true;
    setSyncing(true);
    const settled = new Set<string>();

    try {
      // Flush server-recorded 403 admissions first. Client-manifest admissions
      // are retried through validate below once WordPress permission is restored.
      try {
        await fetch("/api/scan/wp-sync", { method: "POST" });
      } catch {
        // Keep the scan queue; a later replay will retry.
      }

      for (const item of unsynced) {
        try {
          const res = await fetch("/api/scan/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticketId: item.ticketId,
              eventId: item.eventId,
              deviceId: item.deviceId,
              scannedAt: item.scannedAt,
            }),
          });
          const data = (await res.json().catch(() => null)) as
            | { verdict?: string; wpPermissionDenied?: boolean; wpSyncPending?: boolean }
            | null;
          const remotelySettled =
            res.ok &&
            (data?.verdict === "valid" || data?.verdict === "duplicate") &&
            !data.wpPermissionDenied &&
            !data.wpSyncPending;
          if (remotelySettled) settled.add(`${item.ticketId}\u0000${item.scannedAt}`);
        } catch {
          break;
        }
      }

      // Merge with current localStorage so a scan enqueued mid-replay is not lost.
      const latest = readQueue();
      persist(
        latest.map((item) =>
          settled.has(`${item.ticketId}\u0000${item.scannedAt}`) ? { ...item, synced: true } : item,
        ),
      );
    } finally {
      replayInFlight.current = false;
      setSyncing(false);
    }
  }, [persist]);

  useEffect(() => {
    const onOnline = () => {
      void replay();
    };
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => {
      void replay();
    }, QUEUE_REPLAY_POLL_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [replay]);

  useEffect(() => {
    if (pending.length > 0) void replay();
  }, [pending.length, replay]);

  return { queue, pending, pendingCount: pending.length, enqueue, replay, syncing };
}
