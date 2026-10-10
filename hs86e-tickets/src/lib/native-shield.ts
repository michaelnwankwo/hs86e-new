"use client";

/**
 * RSG-ENG-SEC-006 Phase 3 — native screen-shield + haptics bridge.
 *
 * Web/PWA behaviour (this repo's default build):
 *   - screen-shield calls are no-ops (no native bridge present)
 *   - haptics fall back to feature-detected `navigator.vibrate`
 *
 * Capacitor shell behaviour (see native/README.md):
 *   - Android: the local `ScreenShield` plugin sets FLAG_SECURE on the
 *     activity window → OS blocks screenshots and screen recordings.
 *   - iOS: the plugin observes UIApplication.userDidTakeScreenshotNotification
 *     and emits `screenshotDetected`, which opens the persistent
 *     ScreenShieldAlert modal (no public iOS API can prevent captures).
 *   - Haptics use @capacitor/haptics (ImpactStyle.Light) for cross-platform
 *     parity with the web vibrate fallback.
 *
 * All Capacitor packages are imported dynamically and defensively so the
 * web bundle never hard-depends on the native bridge at runtime.
 */

import { useEffect, useState } from "react";

type CapacitorCore = typeof import("@capacitor/core");
type HapticsModule = typeof import("@capacitor/haptics");

interface ScreenShieldPlugin {
  /** Android: set FLAG_SECURE. iOS: no-op (resolves). */
  enableSecureFlag(): Promise<void>;
  addListener(
    event: "screenshotDetected",
    callback: (data: { at?: number }) => void,
  ): Promise<{ remove(): Promise<void> }>;
}

let corePromise: Promise<CapacitorCore | null> | null = null;
function loadCore(): Promise<CapacitorCore | null> {
  corePromise ??= import("@capacitor/core").catch(() => null);
  return corePromise;
}

export async function isNativePlatform(): Promise<boolean> {
  const core = await loadCore();
  try {
    return Boolean(core?.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
}

const screenshotListeners = new Set<() => void>();
let shieldStarted: Promise<void> | null = null;

/** Idempotent native shield bootstrap — safe to call from every pass surface. */
function startScreenShield(): Promise<void> {
  shieldStarted ??= (async () => {
    const core = await loadCore();
    const capacitor = core?.Capacitor;
    if (!capacitor?.isNativePlatform()) return; // web/PWA: nothing to shield
    try {
      const shield = core!.registerPlugin<ScreenShieldPlugin>("ScreenShield");
      if (capacitor.getPlatform() === "android") {
        await shield.enableSecureFlag();
      }
      await shield.addListener("screenshotDetected", () => {
        screenshotListeners.forEach((listener) => listener());
      });
    } catch {
      // Plugin not compiled into this shell — degrade silently (web build).
    }
  })();
  return shieldStarted;
}

/**
 * Cross-platform haptic tick: @capacitor/haptics on native shells,
 * feature-detected navigator.vibrate elsewhere (iOS Safari: safe no-op).
 */
export async function impactHaptic(): Promise<void> {
  try {
    if (await isNativePlatform()) {
      const haptics: HapticsModule | null = await import("@capacitor/haptics").catch(
        () => null,
      );
      if (haptics) {
        await haptics.Haptics.impact({ style: haptics.ImpactStyle.Light });
        return;
      }
    }
  } catch {
    // fall through to the web fallback
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

/**
 * Mount on any surface that displays pass material (wallet card, /scan).
 * Returns whether the iOS screenshot alert should be showing.
 */
export function useScreenShield() {
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    const listener = () => setAlertOpen(true);
    screenshotListeners.add(listener);
    void startScreenShield();
    return () => {
      screenshotListeners.delete(listener);
    };
  }, []);

  return {
    alertOpen,
    dismissAlert: () => setAlertOpen(false),
  };
}
