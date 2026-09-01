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
  const onScanRef = useRef(onScan);

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
    paused.current = true;
    onScanRef.current(value);
    window.setTimeout(() => {
      paused.current = false;
    }, SCAN_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function start() {
      setError(null);
      try {
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
        setError(
          err instanceof Error
            ? err.message
            : "Camera permission is required to scan tickets.",
        );
        setReady(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
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
  }, [elementId, enabled, handleDecoded]);

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

  return { ready, error, torchOn, torchAvailable, toggleTorch, pause, resume };
}
