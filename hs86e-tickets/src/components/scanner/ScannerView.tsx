"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Flashlight, History, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { useOfflineManifest, type ManifestAdmission } from "@/hooks/useOfflineManifest";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useQrScanner } from "@/hooks/useQrScanner";
import { useScanQueue } from "@/hooks/useScanQueue";
import { useScanSounds } from "@/hooks/useScanSounds";
import { SCAN_DEBOUNCE_MS, SCAN_FLASH_MS, SCAN_LOCAL_SET_KEY, TRANSFER_VOID_MESSAGE, TRANSFER_VOID_STATUS } from "@/lib/constants";
import { decodeTicketPayload, parseTicketPayload } from "@/lib/ticket-payload";
import { getOrCreateDeviceId, safeJson } from "@/lib/utils";
import type { EventProduct, ScanValidateResponse, ScanVerdict } from "@/lib/types";
import { AttendeeResultCard } from "./AttendeeResultCard";
import { CameraFeed } from "./CameraFeed";
import { OfflineQueueBadge } from "./OfflineQueueBadge";
import { ScanResultFlash } from "./ScanResultFlash";
import { ScreenShieldAlert } from "@/components/ticketing/ScreenShieldAlert";
import { useScreenShield } from "@/lib/native-shield";

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
  // RSG-ENG-SEC-006 Phase 3 — Android FLAG_SECURE + iOS screenshot alert
  // on the gate surface (attendee data must not be capturable).
  const { alertOpen, dismissAlert } = useScreenShield();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [flash, setFlash] = useState<ScanVerdict | null>(null);
  const [result, setResult] = useState<ScanValidateResponse | null>(null);
  const online = useOnlineStatus();
  const { play, unlock } = useScanSounds();
  const { pendingCount, enqueue, replay, syncing } = useScanQueue();
  const manifest = useOfflineManifest(eventId);
  const deviceId = useMemo(() => (typeof window === "undefined" ? "door" : getOrCreateDeviceId()), []);
  // Late-bound camera controls let the callback pause frame processing before
  // any async work starts, then resume after the result has been held on screen.
  const resetRef = useRef<(() => void) | null>(null);
  const cameraControlsRef = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const isProcessingScanRef = useRef(false);
  const scanSequenceRef = useRef(0);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  const applyFeedback = useCallback(
    async (next: ScanValidateResponse) => {
      setResult(next);
      setFlash(next.verdict);
      if (next.verdict === "valid") await play("success");
      else if (next.verdict === "duplicate" || next.verdict === "expired") await play("warn");
      else {
        await play("fail");
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
      }
      window.setTimeout(() => setFlash(null), SCAN_FLASH_MS);
    },
    [play],
  );

  const processScan = useCallback(
    async (raw: string) => {
      // Audio unlock must never block or kill a scan (iOS can stall resume()).
      try {
        await unlock();
      } catch (err) {
        console.warn("[hs86e] scan sound unlock failed (continuing):", err);
      }
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
          checkedInAt: cached?.checkedInAt || scannedAt,
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
            checkedInAt: attendee.checkedInAt || scannedAt,
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
        if (!res.ok) {
          const failure = new Error(data.error || "Validate failed") as Error & {
            status?: number;
          };
          failure.status = res.status;
          throw failure;
        }

        // FooEvents 403 is a permission refusal, not a ticket verdict. Admit
        // only when this scanner's existing IndexedDB manifest independently
        // confirms an unused attendee for the selected event. Unknown IDs are
        // still denied; no arbitrary ticketId is trusted on a 403.
        if (data.wpPermissionDenied && data.verdict === "invalid") {
          const scannedPayload = parseTicketPayload(raw);
          if (scannedPayload.signature && !data.signatureVerified) {
            await applyFeedback({
              verdict: "invalid",
              ticketId,
              message: "QR signature is not valid — admission denied.",
            });
            return;
          }

          let localAdmission: ManifestAdmission;
          try {
            localAdmission = await manifest.admitCached(ticketId, eventId, nonce, scannedAt);
          } catch (manifestError) {
            console.warn("[hs86e] 403 fallback could not read/commit the local manifest:", manifestError);
            await applyFeedback({
              ...data,
              message: "WordPress refused check-in (403), and the trusted local manifest could not be read — admission denied.",
            });
            return;
          }
          if (localAdmission.outcome === "admitted" && localAdmission.attendee) {
            const attendee = localAdmission.attendee;
            rememberLocal(ticketId);
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
              message: "Checked in locally — FooEvents refused the write (403). Remote sync is queued.",
              wpSyncPending: true,
              signatureVerified: data.signatureVerified,
            });
            return;
          }

          if (localAdmission.outcome === "duplicate") {
            const attendee = localAdmission.attendee;
            await applyFeedback({
              verdict: "duplicate",
              ticketId,
              attendeeName: attendee?.attendeeName,
              tier: attendee?.tier,
              eventName: attendee?.eventName,
              checkedInAt: attendee?.checkedInAt || scannedAt,
              message: "ALREADY SCANNED / ADMISSION DENIED",
            });
            return;
          }
          if (localAdmission.outcome === "canceled") {
            await applyFeedback({
              verdict: "canceled",
              ticketId,
              attendeeName: localAdmission.attendee?.attendeeName,
              message: "Ticket canceled or unpaid — admission denied.",
            });
            return;
          }
          if (localAdmission.outcome === "transferred") {
            await applyFeedback({
              verdict: "transferred",
              revoked: true,
              ticketId,
              attendeeName: localAdmission.attendee?.attendeeName,
              tier: localAdmission.attendee?.tier,
              eventName: localAdmission.attendee?.eventName,
              message: TRANSFER_VOID_MESSAGE,
              statusLabel: TRANSFER_VOID_STATUS,
            });
            return;
          }
          if (localAdmission.outcome === "wrong-event") {
            await applyFeedback({
              verdict: "invalid",
              ticketId,
              attendeeName: localAdmission.attendee?.attendeeName,
              tier: localAdmission.attendee?.tier,
              eventName: localAdmission.attendee?.eventName,
              message: "Wrong event — admission denied.",
            });
            return;
          }

          await applyFeedback({
            ...data,
            message: "WordPress refused check-in (403), and this ticket is not in the trusted local manifest — admission denied.",
          });
          return;
        }

        if (data.verdict === "valid" || data.verdict === "duplicate") rememberLocal(ticketId);
        if (data.verdict === "valid") await manifest.markCheckedIn(ticketId, scannedAt);
        if (data.wpSyncPending) enqueue({ ticketId: raw, eventId, scannedAt, deviceId });
        await applyFeedback(
          data.verdict === "duplicate" && !data.checkedInAt
            ? { ...data, checkedInAt: scannedAt }
            : data,
        );
      } catch (err) {
        // Backend error / 401 / 5xx: queue the scan, keep actionable feedback,
        // and auto-reset the decode loop so the viewfinder never locks up.
        const status = (err as { status?: number })?.status ?? 0;
        console.error("[hs86e] /api/scan/validate failed", { status, error: String(err) });
        const reason =
          status === 401
            ? "Scanner session expired — lock the screen and re-enter the PIN"
            : status >= 500
              ? "Verification service error — scan queued for replay"
              : "Network error — scan queued for replay";
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
            message: `${reason} (manifest: ${attendee.status})`,
            offline: true,
          });
        } else {
          await applyFeedback({
            verdict: "invalid",
            ticketId,
            message: status === 401 ? reason : "Network error and ticket not in manifest",
          });
        }
        // 2.5 s auto-reset (gate spec): resume QR frame scanning cleanly,
        // no hard page refresh required.
        window.setTimeout(() => {
          if (resetRef.current) resetRef.current();
        }, 2500);
      }
    },
    [applyFeedback, deviceId, enqueue, eventId, manifest, online, unlock],
  );

  const handleScan = useCallback(
    async (raw: string) => {
      // The QR hook already pauses decoded frames; this ref is the second line
      // of defense against a second callback racing the async validator.
      if (isProcessingScanRef.current) return;
      isProcessingScanRef.current = true;
      const scanSequence = ++scanSequenceRef.current;
      const startedAt = Date.now();
      setIsProcessingScan(true);
      cameraControlsRef.current?.pause();

      try {
        await processScan(raw);
      } catch (error) {
        console.error("[hs86e] unexpected scan processing error", error);
        try {
          await applyFeedback({
            verdict: "invalid",
            ticketId: decodeTicketPayload(raw),
            message: "Scan could not be completed. Please retry.",
          });
        } catch (feedbackError) {
          console.error("[hs86e] could not show scan error feedback", feedbackError);
        }
      } finally {
        const remainingLockMs = Math.max(0, SCAN_DEBOUNCE_MS - (Date.now() - startedAt));
        window.setTimeout(() => {
          if (scanSequenceRef.current !== scanSequence) return;
          isProcessingScanRef.current = false;
          setIsProcessingScan(false);
          cameraControlsRef.current?.resume();
        }, remainingLockMs);
        window.setTimeout(() => {
          if (scanSequenceRef.current === scanSequence) setResult(null);
        }, SCAN_DEBOUNCE_MS);
      }
    },
    [applyFeedback, processScan],
  );

  const scanner = useQrScanner(CAMERA_ID, handleScan, Boolean(eventId));
  resetRef.current = scanner.reset;
  cameraControlsRef.current = { pause: scanner.pause, resume: scanner.resume };

  async function logout() {
    await fetch("/api/scan/auth", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-4">
      <ScanResultFlash verdict={flash} />
      <ScreenShieldAlert open={alertOpen} onDismiss={dismissAlert} />
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

      <CameraFeed elementId={CAMERA_ID} isProcessingScan={isProcessingScan} />

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
