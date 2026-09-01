"use client";

import { useEffect, useState } from "react";
import { SPLASH_SEEN_KEY } from "@/lib/constants";
import { Logo } from "./Logo";

export function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SPLASH_SEEN_KEY)) return;
    setVisible(true);
    const hide = window.setTimeout(() => {
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
      setVisible(false);
    }, 2200);
    return () => window.clearTimeout(hide);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-surface"
      role="dialog"
      aria-label="Hot Since 86 Entertainment"
    >
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="pointer-events-none absolute inset-0 animate-pulse-glow bg-[radial-gradient(circle_at_center,rgba(223,178,96,0.18),transparent_46%)]" />
      <Logo size="splash" priority />
      <p className="relative mt-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-gold">
        Entertainment
      </p>
    </div>
  );
}
