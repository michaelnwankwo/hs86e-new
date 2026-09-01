"use client";

import { useCallback, useEffect, useState } from "react";
import { MANIFEST_DB, MANIFEST_META_STORE, MANIFEST_STORE } from "@/lib/constants";
import type { ManifestAttendee } from "@/lib/types";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MANIFEST_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MANIFEST_STORE)) {
        const store = db.createObjectStore(MANIFEST_STORE, { keyPath: "ticketId" });
        store.createIndex("eventId", "eventId", { unique: false });
      }
      if (!db.objectStoreNames.contains(MANIFEST_META_STORE)) {
        db.createObjectStore(MANIFEST_META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAll(attendees: ManifestAttendee[], eventId: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([MANIFEST_STORE, MANIFEST_META_STORE], "readwrite");
    const store = tx.objectStore(MANIFEST_STORE);
    attendees.forEach((row) => store.put(row));
    tx.objectStore(MANIFEST_META_STORE).put({
      key: `event:${eventId}`,
      syncedAt: new Date().toISOString(),
      count: attendees.length,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getOne(ticketId: string): Promise<ManifestAttendee | null> {
  const db = await openDb();
  const row = await new Promise<ManifestAttendee | null>((resolve, reject) => {
    const tx = db.transaction(MANIFEST_STORE, "readonly");
    const req = tx.objectStore(MANIFEST_STORE).get(ticketId);
    req.onsuccess = () => resolve((req.result as ManifestAttendee) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row;
}

async function markLocal(ticketId: string, checkedInAt: string) {
  const current = await getOne(ticketId);
  if (!current) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MANIFEST_STORE, "readwrite");
    tx.objectStore(MANIFEST_STORE).put({
      ...current,
      status: "Checked In",
      checkedInAt,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readMeta(eventId: string) {
  const db = await openDb();
  const row = await new Promise<{ syncedAt?: string; count?: number } | null>((resolve, reject) => {
    const tx = db.transaction(MANIFEST_META_STORE, "readonly");
    const req = tx.objectStore(MANIFEST_META_STORE).get(`event:${eventId}`);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row;
}

export function useOfflineManifest(eventId: string) {
  const [count, setCount] = useState(0);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMeta = useCallback(async () => {
    if (!eventId || typeof indexedDB === "undefined") return;
    const meta = await readMeta(eventId);
    setCount(meta?.count ?? 0);
    setSyncedAt(meta?.syncedAt ?? null);
  }, [eventId]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scan/attendees?event=${encodeURIComponent(eventId)}`);
      if (!res.ok) throw new Error("Unable to refresh attendee manifest");
      const data = (await res.json()) as { attendees: ManifestAttendee[]; syncedAt: string };
      await putAll(data.attendees, eventId);
      setCount(data.attendees.length);
      setSyncedAt(data.syncedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manifest refresh failed");
      await refreshMeta();
    } finally {
      setLoading(false);
    }
  }, [eventId, refreshMeta]);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    if (!eventId) return;
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void refresh();
    }
  }, [eventId, refresh]);

  const lookup = useCallback(async (ticketId: string) => getOne(ticketId), []);
  const markCheckedIn = useCallback(
    async (ticketId: string, checkedInAt: string) => markLocal(ticketId, checkedInAt),
    [],
  );

  return { count, syncedAt, loading, error, refresh, lookup, markCheckedIn };
}
