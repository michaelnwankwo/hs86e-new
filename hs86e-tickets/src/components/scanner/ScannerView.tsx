"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Flashlight, History, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { useOfflineManifest } from "@/hooks/useOfflineManifest";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useQrScanner } from "@/hooks/useQrScanner";
import { useScanQueue } from "@/hooks/useScanQueue";
import { useScanSounds } from "@/hooks/useScanSounds";
import { SCAN_FLASH_MS, SCAN_LOCAL_SET_KEY, TRANSFER_VOID_MESSAGE, TRANSFER_VOID_STATUS } from "@/lib/constants";
import { decodeTicketPayload, parseTicketPayload } from "@/lib/ticket-payload";
import { getOrCreateDeviceId, safeJson } from "@/lib/utils";
import type { EventProduct, ScanValidateResponse, ScanVerdict } from "@/lib/types";
import { AttendeeResultCard } from "./AttendeeResultCard";
import { CameraFeed } from "./CameraFeed";
import { OfflineQueueBadge } from "./OfflineQueueBadge";
import { ScanResultFlash } from "./ScanResultFlash";

const CAMERA_ID = "hs86e-camera";

function localSet(): Set<string> {
  return new Set(safeJson<string[]>(localStorage.getItem(SCAN_LOCAL_SET_KEY), []));
}

function rememberLocal(ticketId: string) {
  const next = localSet();
  next.add(ticketId);
  localStorage.setItem(SCAN_LOCAL_SET_KEY, JSON.stringify(Array.from(next)));
}

export function ScannerView({ events }: { events: EventProduct[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [flash, setFlash] = useState<ScanVerdict | null>(null);
  const [result, setResult] = useState<ScanValidateResponse | null>(null);
  const online = useOnlineStatus();
  const { play, unlock } = useScanSounds();
  const { pendingCount, enqueue, replay, syncing } = useScanQueue();
  const manifest = useOfflineManifest(eventId);
  const deviceId = useMemo(() => (typeof window === "undefined" ? "door" : getOrCreateDeviceId()), []);

  const applyFeedback = useCallback(
    async (next: ScanValidateResponse) => {
      setResult(next);
      setFlash(next.verdict);
      if (next.verdict === "valid") await play("success");
      else if (next.verdict === "duplicate") await play("warn");
      else {
        await play("fail");
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
      }
      window.setTimeout(() => setFlash(null), SCAN_FLASH_MS);
    },
    [play],
  );

  const handleScan = useCallback(
    async (raw: string) => {
      await unlock();
      const ticketId = decodeTicketPayload(raw);
      const scannedAt = new Date().toISOString();
      if (!ticketId) return;
      const nonce = parseTicketPayload(raw).nonce;

      if (localSet().has(ticketId)) {
        const cached = await manifest.lookup(ticketId);
        await applyFeedback({
          verdict: "duplicate",
          ticketId,
          attendeeName: cached?.attendeeName,
          tier: cached?.tier,
          eventName: cached?.eventName,
          checkedInAt: cached?.checkedInAt,
          message: "Already scanned on this device",
          offline: !online,
        });
        return;
      }

      if (!online) {
        const attendee = await manifest.lookup(ticketId);
        if (!attendee) {
          await applyFeedback({
            verdict: "invalid",
            ticketId,
            message: "Not on the offline manifest",
            offline: true,
          });
          return;
        }
        if (attendee.eventId && attendee.eventId !== eventId) {
          await applyFeedback({
            verdict: "invalid",
            ticketId,
            attendeeName: attendee.attendeeName,
            tier: attendee.tier,
            eventName: attendee.eventName,
            message: "Wrong event",
            offline: true,
          });
          return;
        }
        if (attendee.status === "Canceled" || attendee.status === "Unpaid") {
          await applyFeedback({
            verdict: "canceled",
            ticketId,
            attendeeName: attendee.attendeeName,
            tier: attendee.tier,
            message: "Ticket canceled",
            offline: true,
          });
          return;
        }
        if (attendee.status === "Checked In") {
          await applyFeedback({
            verdict: "duplicate",
            ticketId,
            attendeeName: attendee.attendeeName,
            tier: attendee.tier,
            checkedInAt: attendee.checkedInAt,
            message: "Already checked in",
            offline: true,
          });
          return;
        }
        if (attendee.qrToken && nonce !== attendee.qrToken) {
          await applyFeedback({
            verdict: "transferred",
            ticketId,
            attendeeName: attendee.attendeeName,
            tier: attendee.tier,
            eventName: attendee.eventName,
            message: TRANSFER_VOID_MESSAGE,
            statusLabel: TRANSFER_VOID_STATUS,
            offline: true,
          });
          return;
        }
        rememberLocal(ticketId);
        await manifest.markCheckedIn(ticketId, scannedAt);
        enqueue({ ticketId: raw, eventId, scannedAt, deviceId });
        await applyFeedback({
          verdict: "valid",
          ticketId,
          attendeeName: attendee.attendeeName,
          attendeeEmail: attendee.attendeeEmail,
          attendeePhone: attendee.attendeePhone,
          tier: attendee.tier,
          eventName: attendee.eventName,
          checkedInAt: scannedAt,
          message: "OFFLINE-VERIFIED",
          offline: true,
        });
        return;
      }

      try {
        const res = await fetch("/api/scan/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: raw, eventId, deviceId, scannedAt }),
        });
        const data = (await res.json()) as ScanValidateResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || "Validate failed");
        if (data.verdict === "valid" || data.verdict === "duplicate") rememberLocal(ticketId);
        if (data.verdict === "valid") await manifest.markCheckedIn(ticketId, scannedAt);
        await applyFeedback(data);
      } catch {
        enqueue({ ticketId: raw, eventId, scannedAt, deviceId });
        const attendee = await manifest.lookup(ticketId);
        if (attendee && attendee.status !== "Canceled") {
          rememberLocal(ticketId);
          await applyFeedback({
            verdict: attendee.status === "Checked In" ? "duplicate" : "valid",
            ticketId,
            attendeeName: attendee.attendeeName,
            tier: attendee.tier,
            checkedInAt: attendee.checkedInAt || scannedAt,
            message: "Queued after network error",
            offline: true,
          });
        } else {
          await applyFeedback({
            verdict: "invalid",
            ticketId,
            message: "Network error and ticket not in manifest",
          });
        }
      }
    },
    [applyFeedback, deviceId, enqueue, eventId, manifest, online, unlock],
  );

  const scanner = useQrScanner(CAMERA_ID, handleScan, Boolean(eventId));

  async function logout() {
    await fetch("/api/scan/auth", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-4">
      <ScanResultFlash verdict={flash} />
      <div className="mb-4 flex items-center justify-end gap-3">
        <OfflineQueueBadge pending={pendingCount} online={online} syncing={syncing} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <select
          className="min-h-11 flex-1 rounded-xl border border-gold/20 bg-surface-raised px-3 text-sm text-ink"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-gold/20 px-3 text-xs text-gold"
          onClick={() => void manifest.refresh()}
        >
          <RefreshCw className={`h-4 w-4 ${manifest.loading ? "animate-spin" : ""}`} />
          Manifest
        </button>
      </div>
      <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-ink-dim">
        {manifest.count} attendees cached
        {manifest.syncedAt ? ` · ${new Date(manifest.syncedAt).toLocaleTimeString()}` : ""}
      </p>

      {scanner.error ? <StatusBanner tone="danger">{scanner.error}</StatusBanner> : null}
      {!online ? (
        <StatusBanner tone="offline" className="mb-3">
          Venue Wi-Fi is down. Validating against the cached manifest and queueing sync.
        </StatusBanner>
      ) : null}

      <CameraFeed elementId={CAMERA_ID} />

      <div className="mt-3 flex gap-2">
        {scanner.torchAvailable ? (
          <Button variant="ghost" className="flex-1" onClick={() => void scanner.toggleTorch()}>
            <Flashlight className="h-4 w-4" />
            {scanner.torchOn ? "Torch off" : "Torch"}
          </Button>
        ) : null}
        <Link
          href="/scan/history"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-gold/30 text-sm font-semibold text-gold"
        >
          <History className="h-4 w-4" />
          History
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gold/20 px-4 text-sm text-ink-muted"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {result ? (
        <div className="mt-4">
          <AttendeeResultCard result={result} />
        </div>
      ) : (
        <p className="mt-4 text-center text-sm text-ink-muted">
          Align the QR inside the gold frame. Target loop: under two seconds.
        </p>
      )}

      {pendingCount > 0 ? (
        <Button variant="gold" className="mt-4" block onClick={() => void replay()}>
          Replay {pendingCount} queued scans
        </Button>
      ) : null}
    </div>
  );
}
