"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Safari/Chrome-style route progress bar.
 * Creeps 0 -> 85% during a navigation, completes to 100% on arrival, fades out.
 * Mounted inside the sticky AppHeader along its bottom border — never blocks input.
 */
export function GoldTopLoader() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<number | null>(null);
  const running = useRef(false);
  const creepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCreep = () => {
    if (creepTimer.current) {
      clearInterval(creepTimer.current);
      creepTimer.current = null;
    }
  };

  const start = () => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }
    if (running.current) return;
    running.current = true;
    setProgress(12);
    creepTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p === null) return p;
        const next = p + Math.max(0.5, (85 - p) * 0.07);
        return Math.min(85, next);
      });
    }, 110);
  };

  const complete = () => {
    if (!running.current) return;
    running.current = false;
    clearCreep();
    setProgress(100);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setProgress(null), 300);
  };

  // Start the creep on any same-origin internal navigation (taps on links).
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      try {
        const url = new URL(href, window.location.href);
        const same = url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash;
        if (!same) start();
      } catch {
        /* malformed href — ignore */
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete when the router actually lands on the new route.
  useEffect(() => {
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Clean timers on unmount.
  useEffect(
    () => () => {
      clearCreep();
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );

  if (progress === null) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-[2.5px] overflow-hidden"
    >
      <div
        className="gold-top-loader relative h-full bg-[linear-gradient(90deg,#F5D68D,#D4AF37,#C5A059)]"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          boxShadow: "0 0 10px rgba(212,175,55,0.85), 0 0 24px rgba(212,175,55,0.35)",
        }}
      >
        <span className="gold-top-stripe absolute inset-y-0 right-0 w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)]" />
      </div>
    </div>
  );
}
