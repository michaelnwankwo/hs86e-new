"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const current = readQueue();
    const unsynced = current.filter((item) => !item.synced);
    if (unsynced.length === 0) return;
    setSyncing(true);
    const next = [...current];
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
        if (res.ok || res.status === 409) {
          const idx = next.findIndex(
            (row) => row.ticketId === item.ticketId && row.scannedAt === item.scannedAt,
          );
          if (idx >= 0) next[idx] = { ...next[idx], synced: true };
        }
      } catch {
        break;
      }
    }
    persist(next);
    setSyncing(false);
  }, [persist]);

  useEffect(() => {
    const onOnline = () => {
      void replay();
    };
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => {
      void replay();
    }, QUEUE_REPLAY_POLL_MS);
    void replay();
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [replay]);

  return { queue, pending, pendingCount: pending.length, enqueue, replay, syncing };
}
