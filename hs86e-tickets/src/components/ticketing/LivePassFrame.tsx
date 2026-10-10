"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TOTP_STEP_SECONDS, totpCounter } from "@/lib/pass-security";
import { impactHaptic, useScreenShield } from "@/lib/native-shield";
import { ScreenShieldAlert } from "./ScreenShieldAlert";
import type { IssuedTicket } from "@/lib/types";

/**
 * RSG-ENG-SEC-006 Phase 1 — visual anti-spoof frame around the live QR.
 *
 *  - 1,000 ms HH:mm:ss liveness clock in brand gold (tabular-nums)
 *  - 1.5 s looping GPU gradient sweep bar across the top of the QR frame
 *  - tap-to-flip 180° card revealing tier/order details, with feature-detected
 *    haptic tick (navigator.vibrate)
 *  - background protection: pass is blurred/concealed whenever the tab loses
 *    visibility or window focus, so backgrounded captures show nothing usable
 *
 * Degrades safely under prefers-reduced-motion: sweep animation and flip
 * transition are disabled and the clock pauses (static readout).
 */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

function useConcealed() {
  const [concealed, setConcealed] = useState(false);
  useEffect(() => {
    const update = () => setConcealed(document.hidden || !document.hasFocus());
    document.addEventListener("visibilitychange", update);
    window.addEventListener("blur", update);
    window.addEventListener("focus", update);
    update();
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("blur", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return concealed;
}

/* RSG-ENG-SEC-006 Phase 2 — 30 s countdown ring around the QR (#D4AF37).
   Ticks every 1,000 ms with a 1 s linear stroke-dashoffset transition; the
   arc group is re-mounted on each counter increment so the reset snaps
   cleanly back to full instead of animating backwards. */
const TOTP_RING_R = 126;
const TOTP_RING_C = 2 * Math.PI * TOTP_RING_R;

function TotpRing() {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const counter = totpCounter(nowMs);
  const elapsed = ((nowMs / 1000) % TOTP_STEP_SECONDS) / TOTP_STEP_SECONDS;
  return (
    <svg
      viewBox="0 0 264 264"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 m-auto h-[264px] w-[264px]"
    >
      <g key={counter} transform="rotate(-90 132 132)">
        <circle
          cx={132}
          cy={132}
          r={TOTP_RING_R}
          fill="none"
          stroke="rgba(212,175,55,0.16)"
          strokeWidth={3}
        />
        <circle
          cx={132}
          cy={132}
          r={TOTP_RING_R}
          fill="none"
          stroke="#D4AF37"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={TOTP_RING_C}
          strokeDashoffset={TOTP_RING_C * elapsed}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </g>
    </svg>
  );
}

function GateClock({ paused }: { paused: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (paused) return; // reduced motion: graceful static readout
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [paused]);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span
      aria-hidden="true"
      className="gate-clock text-sm font-semibold text-[#D4AF37]"
    >
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  );
}

export function LivePassFrame({
  ticket,
  children,
}: {
  ticket: IssuedTicket;
  children: React.ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const concealed = useConcealed();
  const [flipped, setFlipped] = useState(false);
  const { alertOpen, dismissAlert } = useScreenShield();

  const flip = () => {
    // RSG-ENG-SEC-006 Phase 3: @capacitor/haptics on native shells,
    // feature-detected navigator.vibrate fallback on web.
    void impactHaptic();
    setFlipped((f) => !f);
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "gate-flip-scene mx-auto w-fit transition-[filter] duration-200",
          concealed && "blur-xl",
        )}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label="Tap to flip pass and verify liveness"
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            flip();
          }
        }}
      >
        <div className={cn("gate-flip", flipped && "gate-flip--on")}>
          {/* FRONT — sweep bar + live clock + QR */}
          <div className="gate-face gate-face--front">
            <span aria-hidden="true" className="gate-sweep mb-2" />
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#C5A059]">
                Live pass
              </span>
              <GateClock paused={reduced} />
            </div>
            <div className="relative mx-auto w-fit">
              {children}
              {Boolean(ticket.totpSeed && ticket.qrToken) && <TotpRing />}
            </div>
          </div>

          {/* BACK — tier / order details (tap-discriminator vs recorded video) */}
          <div className="gate-face gate-face--back rounded-2xl border border-[#C5A059]/40 bg-[#0B0E14] px-4 py-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C5A059]">
              Pass details
            </p>
            <p className="mt-2 text-sm font-semibold text-[#F8FAFC]">
              {ticket.eventName}
            </p>
            <p className="mt-1 text-xs text-[#DFB260]">Tier · {ticket.tier}</p>
            <p className="mt-1 text-xs text-[#DFB260]/80">
              Pass {ticket.passIndex ?? 1} of {ticket.passTotal ?? 1} · Order #
              {ticket.orderId}
            </p>
            <p className="mt-2 break-all font-mono text-[11px] tracking-[0.12em] text-[#F5D68D]">
              {ticket.ticketId}
            </p>
            <p className="mt-3 text-[10px] text-[#DFB260]/60">
              Tap to return to the live QR.
            </p>
          </div>
        </div>
      </div>

      {/* Background protection — conceal whenever tab is hidden / unfocused */}
      <div
        aria-hidden={!concealed}
        className={cn(
          "pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-[#0B0E14]/60 transition-opacity duration-200",
          concealed ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="px-4 text-center text-[11px] uppercase tracking-[0.18em] text-[#DFB260]">
          Pass hidden — return to the app to reveal
        </p>
      </div>

      {/* Phase 3 — persistent iOS screenshot warning (native shells only) */}
      <ScreenShieldAlert open={alertOpen} onDismiss={dismissAlert} />
    </div>
  );
}
