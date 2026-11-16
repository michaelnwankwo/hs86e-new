"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Safari/Chrome-style route progress bar — a persistent 2.5px gold line pinned
 * to the AppHeader's bottom border.
 *
 * Behaviour:
 *  • start   — on internal <a> clicks / popstate; rAF-driven ease-out creep
 *              from 0% to 85% over ~1.8s (cubic ease-out, silky & predictable).
 *  • complete — when the App Router lands on the new pathname: instantly
 *              scale to 100%, fade over 200ms, reset silently to 0%.
 *  • transform: scaleX (origin-left) — zero layout thrash, 60fps throughout.
 *  • aria-hidden & pointer-events-none — never blocks input or a11y tree.
 */
const CREEP_MS = 2100;
const MAX_CREEP = 0.9;
const FADE_MS = 200;

export function GoldTopLoader() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const raf = useRef<number | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTs = useRef(0);

  const setScaleX = (p: number) => {
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
  };

  const start = () => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
      if (barRef.current) barRef.current.style.opacity = "1";
    }
    if (running.current) return;
    running.current = true;
    startTs.current = performance.now();
    setScaleX(0.02);
    const tick = (now: number) => {
      if (!running.current) return;
      const t = Math.min(1, (now - startTs.current) / CREEP_MS);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setScaleX(MAX_CREEP * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const complete = () => {
    if (!running.current) return;
    running.current = false;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    setScaleX(1); // instantly complete to 100%
    // Hold for 100ms so the eye registers completion, then fade over 200ms.
    setTimeout(() => {
      if (barRef.current) barRef.current.style.opacity = "0";
    }, 100);
    fadeTimer.current = setTimeout(() => {
      if (barRef.current) {
        barRef.current.style.transition = "none";
        setScaleX(0);
        void barRef.current.offsetWidth; // force reflow so the reset is committed
        barRef.current.style.opacity = "1";
        requestAnimationFrame(() => {
          if (barRef.current) barRef.current.style.transition = "opacity 200ms ease";
        });
      }
      fadeTimer.current = null;
    }, 100 + FADE_MS);
  };

  // Start the creep for same-origin internal navigations (and back/forward).
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
    const onPop = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete the instant the router commits the new route to the tree.
  useEffect(() => {
    complete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Hygiene on unmount.
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-[3px] overflow-hidden">
      <div
        ref={barRef}
        className="relative h-full origin-left bg-[#D4AF37]"
        style={{
          transform: "scaleX(0)",
          opacity: 1,
          transition: "opacity 200ms ease",
          boxShadow: "0 0 10px rgba(212,175,55,0.7), 0 0 22px rgba(212,175,55,0.4)",
        }}
      >
        <span className="gold-top-stripe absolute inset-y-0 right-0 w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)]" />
      </div>
    </div>
  );
}
