"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QUEUE_REPLAY_POLL_MS, SCAN_QUEUE_KEY } from "@/lib/constants";
import { safeJson } from "@/lib/utils";
import type { QueuedScan } from "@/lib/types";

export interface QueueFlushResult {
  attempted: number;
  synced: number;
  failed: number;
  pending: number;
  offline?: boolean;
}

type ReplayResponse = {
  success?: boolean;
  verdict?: string;
  message?: string;
  error?: string;
  wpPermissionDenied?: boolean;
  wpSyncPending?: boolean;
} | null;

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

function isConfirmedReplay(res: Response, data: ReplayResponse) {
  if (!data || data.wpPermissionDenied || data.wpSyncPending || data.success === false) return false;
  const verdict = String(data.verdict || "").toLowerCase();
  const message = String(data.message || "").toLowerCase();
  const rejectedVerdict = ["invalid", "canceled", "transferred", "expired"].includes(verdict);
  if (rejectedVerdict) return false;

  const alreadyConfirmed =
    verdict === "already_synced" ||
    verdict === "already_checked_in" ||
    (data.success === true && /already checked in|check-in confirmed/.test(message)) ||
    (verdict === "duplicate" && /already checked in|already scanned|check-in confirmed/.test(message)) ||
    (res.status === 409 && /already checked in|check-in confirmed/.test(message));

  if (res.ok) {
    // A bare `duplicate` is not enough evidence to clear local work. The
    // server must say valid/successful or explicitly confirm an already-settled check-in.
    return verdict === "valid" || alreadyConfirmed || data.success === true;
  }
  // Accommodate a legacy 409 only when the response explicitly confirms the
  // idempotent already-checked-in outcome; arbitrary HTTP errors stay pending.
  return res.status === 409 && alreadyConfirmed;
}

export function useScanQueue() {
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const [syncing, setSyncing] = useState(false);
  const replayInFlight = useRef<Promise<QueueFlushResult> | null>(null);

  useEffect(() => {
    setQueue(readQueue());
    const onStorage = (event: StorageEvent) => {
      if (event.key === SCAN_QUEUE_KEY) setQueue(readQueue());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((items: QueuedScan[]) => {
    try {
      writeQueue(items);
      setQueue(items);
      return true;
    } catch (error) {
      console.error("[hs86e] could not persist scan queue", error);
      return false;
    }
  }, []);

  /** Remove only pending rows from this device; this never writes to WordPress. */
  const purgePending = useCallback((): { removed: number; saved: boolean } => {
    const current = readQueue();
    const remaining = current.filter((item) => item.synced);
    const removed = current.length - remaining.length;
    if (removed === 0) return { removed: 0, saved: true };
    const saved = persist(remaining);
    return { removed: saved ? removed : 0, saved };
  }, [persist]);

  const enqueue = useCallback(
    (scan: Omit<QueuedScan, "synced" | "failed" | "lastError">) => {
      const current = readQueue();
      if (current.some((item) => item.ticketId === scan.ticketId && !item.synced)) return;
      persist([
        ...current,
        { ...scan, synced: false, failed: false, lastError: undefined },
      ]);
    },
    [persist],
  );

  const pending = useMemo(() => queue.filter((item) => !item.synced), [queue]);
  const failed = useMemo(() => queue.filter((item) => !item.synced && item.failed), [queue]);

  /** Flush pending localStorage rows sequentially; each confirmed row is saved immediately. */
  const flushOfflineQueue = useCallback((includeFailed = true): Promise<QueueFlushResult> => {
    if (replayInFlight.current) return replayInFlight.current;

    const unsynced = readQueue().filter(
      (item) => !item.synced && (includeFailed || !item.failed),
    );
    const online = typeof navigator === "undefined" || navigator.onLine;
    if (!online) {
      const pendingCount = readQueue().filter((item) => !item.synced).length;
      return Promise.resolve({
        attempted: 0,
        synced: 0,
        failed: pendingCount,
        pending: pendingCount,
        offline: true,
      });
    }
    if (unsynced.length === 0) {
      return Promise.resolve({
        attempted: 0,
        synced: 0,
        failed: 0,
        pending: readQueue().filter((item) => !item.synced).length,
      });
    }

    const task = (async (): Promise<QueueFlushResult> => {
      setSyncing(true);
      let syncedCount = 0;
      let failedCount = 0;

      const updateItem = (key: string, update: Partial<QueuedScan>) => {
        const latest = readQueue();
        let found = false;
        const next = latest.map((item) => {
          if (queueKey(item) !== key) return item;
          found = true;
          return { ...item, ...update };
        });
        // Another tab may already have removed the row; it no longer needs a
        // local status update. Otherwise write each result before continuing.
        return !found || persist(next);
      };

      try {
        // Reconcile server-recorded 403 admissions before replaying local rows.
        // The per-row validation below remains authoritative for this device.
        try {
          await fetch("/api/scan/wp-sync", { method: "POST" });
        } catch {
          // Leave local rows pending; each one is still attempted below.
        }

        for (const item of unsynced) {
          const key = queueKey(item);
          try {
            const res = await fetch("/api/scan/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ticketId: item.ticketId,
                eventId: item.eventId,
                deviceId: item.deviceId,
                scannedAt: item.scannedAt,
                replay: true,
              }),
            });
            const data = (await res.json().catch(() => null)) as ReplayResponse;

            if (isConfirmedReplay(res, data)) {
              const saved = updateItem(key, {
                synced: true,
                failed: false,
                lastError: undefined,
              });
              if (saved) {
                syncedCount += 1;
                continue;
              }
              failedCount += 1;
              continue;
            }

            failedCount += 1;
            updateItem(key, {
              synced: false,
              failed: false,
              lastError:
                data?.message ||
                data?.error ||
                (res.ok ? "Server did not confirm check-in sync." : `HTTP ${res.status}`),
            });
          } catch (error) {
            failedCount += 1;
            updateItem(key, {
              synced: false,
              failed: false,
              lastError: error instanceof Error ? error.message : "Network sync failed.",
            });
          }
        }

        return {
          attempted: unsynced.length,
          synced: syncedCount,
          failed: failedCount,
          pending: readQueue().filter((item) => !item.synced).length,
        };
      } finally {
        setSyncing(false);
      }
    })();

    replayInFlight.current = task;
    void task.then(
      () => {
        if (replayInFlight.current === task) replayInFlight.current = null;
      },
      () => {
        if (replayInFlight.current === task) replayInFlight.current = null;
      },
    );
    return task;
  }, [persist]);

  // Backward-compatible name used by ScannerView. This function now resolves
  // to counts so a manual Flush Queue can report any retained pending rows.
  const replay = flushOfflineQueue;

  useEffect(() => {
    const attemptIfNeeded = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (readQueue().some((item) => !item.synced)) void flushOfflineQueue();
    };
    window.addEventListener("online", attemptIfNeeded);
    const timer = window.setInterval(attemptIfNeeded, QUEUE_REPLAY_POLL_MS);
    return () => {
      window.removeEventListener("online", attemptIfNeeded);
      window.clearInterval(timer);
    };
  }, [flushOfflineQueue]);

  useEffect(() => {
    if (pending.length > 0 && typeof navigator !== "undefined" && navigator.onLine) {
      void flushOfflineQueue();
    }
  }, [pending.length, flushOfflineQueue]);

  return {
    queue,
    pending,
    pendingCount: pending.length,
    failed,
    failedCount: failed.length,
    enqueue,
    replay,
    flushOfflineQueue,
    purgePending,
    syncing,
  };
}
