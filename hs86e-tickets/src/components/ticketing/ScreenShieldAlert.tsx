"use client";

import { cn } from "@/lib/utils";

/**
 * RSG-ENG-SEC-006 Phase 3 — persistent iOS screenshot alert.
 *
 * Opened by the native ScreenShield plugin's `screenshotDetected` event
 * (Android never fires it — FLAG_SECURE blocks captures at the OS level).
 * The modal is persistent by design: it does not auto-dismiss; the holder
 * must explicitly acknowledge it, so a captured screen shows the warning
 * instead of a usable pass.
 */
export function ScreenShieldAlert({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Screenshot detected"
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center bg-[#0B0E14]/90 px-6 transition-opacity duration-200",
        open ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#C5A059]/50 bg-[#10141C] p-6 text-center shadow-[0_0_40px_rgba(212,175,55,0.15)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C5A059]">
          Screen capture detected
        </p>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-[#F8FAFC]">
          Screenshots and recordings are strictly prohibited and invalid for
          entry. You must present the live app at the gate.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#0B0E14] transition hover:bg-[#DFB260]"
        >
          I understand — show live pass
        </button>
      </div>
    </div>
  );
}
