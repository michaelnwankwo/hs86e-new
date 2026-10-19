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

function queueKey(item: Pick<QueuedScan, "ticketId" | "scannedAt">) {
  return `${item.ticketId}\u0000${item.scannedAt}`;
}

export function useScanQueue() {
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [syncing, setSyncing] = useState(false);
  const replayInFlight = useRef(false);

  useEffect(() => {
    setQueue(readQueue());
    const onStorage = (event: StorageEvent) => {
      if (event.key === SCAN_QUEUE_KEY) setQueue(readQueue());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((items: QueuedScan[]) => {
    writeQueue(items);
    setQueue(items);
  }, []);

  const enqueue = useCallback(
    (scan: Omit<QueuedScan, "synced" | "failed" | "lastError">) => {
      const current = readQueue();
      if (current.some((item) => item.ticketId === scan.ticketId && !item.synced && !item.failed)) {
        return;
      }
      persist([
        ...current,
        { ...scan, synced: false, failed: false, lastError: undefined },
      ]);
    },
    [persist],
  );

  const pending = useMemo(
    () => queue.filter((item) => !item.synced && !item.failed),
    [queue],
  );
  const failed = useMemo(() => queue.filter((item) => !item.synced && item.failed), [queue]);

  /** `includeFailed=true` is the explicit operator retry from Scan History. */
  const replay = useCallback(async (includeFailed = false) => {
    if ((typeof navigator !== "undefined" && !navigator.onLine) || replayInFlight.current) return;
    const unsynced = readQueue().filter(
      (item) => !item.synced && (includeFailed || !item.failed),
    );
    if (unsynced.length === 0) return;

    replayInFlight.current = true;
    setSyncing(true);
    const updates = new Map<string, Partial<QueuedScan>>();

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
            | {
                verdict?: string;
                message?: string;
                error?: string;
                wpPermissionDenied?: boolean;
                wpSyncPending?: boolean;
              }
            | null;
          const key = queueKey(item);
          const remotelySettled =
            res.ok &&
            (data?.verdict === "valid" || data?.verdict === "duplicate") &&
            !data.wpPermissionDenied &&
            !data.wpSyncPending;
          if (remotelySettled) {
            updates.set(key, { synced: true, failed: false, lastError: undefined });
            continue;
          }

          const terminalVerdict =
            data?.verdict === "invalid" ||
            data?.verdict === "canceled" ||
            data?.verdict === "transferred" ||
            data?.verdict === "expired";
          if (res.ok && terminalVerdict && !data?.wpPermissionDenied && !data?.wpSyncPending) {
            updates.set(key, {
              synced: false,
              failed: true,
              lastError: data.message || "Remote validation rejected this scan.",
            });
          }
        } catch {
          break;
        }
      }

      // Merge with current localStorage so a scan enqueued mid-replay is not lost.
      const latest = readQueue();
      persist(
        latest.map((item) => {
          const update = updates.get(queueKey(item));
          return update ? { ...item, ...update } : item;
        }),
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

  return {
    queue,
    pending,
    pendingCount: pending.length,
    failed,
    failedCount: failed.length,
    enqueue,
    replay,
    syncing,
  };
}
