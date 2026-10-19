"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCAN_DEBOUNCE_MS, SCAN_FPS, SCAN_QRBOX } from "@/lib/constants";

type Html5QrcodeInstance = {
  start: (
    cameraIdOrConfig: string | { facingMode: string },
    config: { fps: number; qrbox: number },
    onSuccess: (decoded: string) => void,
    onError?: (err: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => Promise<void>;
  applyVideoConstraints: (c: MediaTrackConstraints) => Promise<void>;
  getRunningTrackCapabilities?: () => MediaTrackCapabilities;
};

/** Delay before an automatic camera restart after a failure (RSG gate spec). */
const SCANNER_RETRY_MS = 2500;

export function useQrScanner(
  elementId: string,
  onScan: (value: string) => void,
  enabled: boolean,
) {
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const lastValue = useRef<string>("");
  const lastAt = useRef(0);
  const paused = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const onScanRef = useRef(onScan);

  /**
   * Hard reset of the decode loop: clears the error state, unpauses frame
   * handling and remounts the camera. Called automatically after backend
   * failures so the viewfinder never stays locked on an error.
   */
  const reset = useCallback(() => {
    lastValue.current = "";
    lastAt.current = 0;
    paused.current = false;
    setError(null);
    setRestartToken((token) => token + 1);
  }, []);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleDecoded = useCallback((decoded: string) => {
    if (paused.current) return;
    const value = decoded.trim();
    if (!value) return;
    const now = Date.now();
    if (value === lastValue.current && now - lastAt.current < SCAN_DEBOUNCE_MS) return;
    lastValue.current = value;
    lastAt.current = now;
    // Lock frame callbacks until ScannerView explicitly resumes after its
    // minimum three-second result hold. Do not auto-unpause here: a slow API
    // request must not let the same decoded frame enter validation again.
    paused.current = true;
    onScanRef.current(value);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let retryTimer: number | undefined;

    async function start() {
      setError(null);
      try {
        // Release any half-initialized instance first — html5-qrcode throws
        // "already running" if a previous attempt is still attached.
        const previous = scannerRef.current;
        scannerRef.current = null;
        if (previous) {
          await previous
            .stop()
            .then(() => previous.clear())
            .catch(() => undefined);
        }
        const mod = await import("html5-qrcode");
        if (cancelled) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const scanner = new Html5Qrcode(elementId, { verbose: false }) as unknown as Html5QrcodeInstance;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: SCAN_FPS, qrbox: SCAN_QRBOX },
          handleDecoded,
          () => undefined,
        );
        if (cancelled) {
          await scanner.stop().catch(() => undefined);
          return;
        }
        try {
          const caps = scanner.getRunningTrackCapabilities?.();
          setTorchAvailable(Boolean(caps && "torch" in caps));
        } catch {
          setTorchAvailable(false);
        }
        setReady(true);
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : "Camera is unavailable on this device.";
        console.error("[hs86e] camera start failed:", reason);
        setError(
          /permission|denied|notallowed/i.test(reason)
            ? "Camera permission is required to scan tickets. Allow camera access, then reopen /scan."
            : `Camera unavailable — retrying in ${SCANNER_RETRY_MS / 1000}s. (${reason})`,
        );
        setReady(false);
        // Self-healing: a failed start must never leave the gate with a dead
        // viewfinder. Retry on a delay instead of requiring a hard refresh.
        // A permission denial is not retryable from inside the page (the user
        // must grant access), so that case surfaces guidance instead.
        const permissionDenied = /permission|denied|notallowed/i.test(reason);
        if (!permissionDenied && !cancelled) {
          retryTimer = window.setTimeout(() => {
            retryTimer = undefined;
            if (!cancelled) void start();
          }, SCANNER_RETRY_MS);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      setReady(false);
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      }
    };
  }, [elementId, enabled, handleDecoded, restartToken]);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const next = !torchOn;
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }, [torchOn]);

  const pause = useCallback(() => {
    paused.current = true;
  }, []);

  const resume = useCallback(() => {
    paused.current = false;
  }, []);

  return { ready, error, torchOn, torchAvailable, toggleTorch, pause, resume, reset };
}
