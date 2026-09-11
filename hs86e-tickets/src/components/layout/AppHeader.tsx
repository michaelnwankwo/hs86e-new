"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { GoldParticleField } from "./GoldParticleField";

/** Asset 1 — uploaded gold 3D logo (transparent PNG) in /public. */
const LOGO_SRC = "/logohs86e.png";

/**
 * Stealth scanner trigger — the "Hot Since 86" logo doubles as the staff
 * door. 3 taps inside a strict 1.2s rolling window open /scan (PIN gate).
 */
const STEALTH_TAPS = 3;
const STEALTH_WINDOW_MS = 1200;

type NavItem = {
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

/**
 * Global header navigation.
 *
 * The public DOOR/SCAN tab is retired — staff reach the scanner through the
 * stealth triple-tap on the logo. Tab order: EVENTS → WALLET → GAMES.
 */
const NAV_ITEMS: NavItem[] = [
  {
    label: "Events",
    href: "/events",
    isActive: (p) => p.startsWith("/events") || p.startsWith("/checkout"),
  },
  {
    label: "Wallet",
    href: "/tickets",
    isActive: (p) => p.startsWith("/tickets") || p.startsWith("/wallet"),
  },
  { label: "Games", href: "/games", isActive: (p) => p.startsWith("/games") },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  // Tap timestamps for the rolling stealth window (refs — no re-renders).
  const tapTimes = useRef<number[]>([]);
  const tapResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTapWindow = () => {
    tapTimes.current = [];
    if (tapResetTimer.current) {
      clearTimeout(tapResetTimer.current);
      tapResetTimer.current = null;
    }
  };

  const handleLogoTap = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const now = Date.now();
    // Rolling window — drop taps older than 1.2s before counting this one.
    const recent = tapTimes.current.filter((t) => now - t < STEALTH_WINDOW_MS);
    recent.push(now);
    tapTimes.current = recent;

    // Reset the window timer on every tap; it clears the counter on timeout.
    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    tapResetTimer.current = setTimeout(clearTapWindow, STEALTH_WINDOW_MS);

    if (recent.length >= STEALTH_TAPS) {
      // Validated — swallow the link's default /events hop, open staff door.
      event.preventDefault();
      clearTapWindow();
      router.push("/scan");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#DFB260]/30">
      <div className="relative overflow-hidden bg-[#0A0D14]/90 backdrop-blur-xl">
        {/*
         * Asset 2 — darkened light-burst backdrop.
         * background-size 100% 200% + position top center = only the UPPER ~50%
         * of the image is visible across the header height.
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[position:top_center] bg-no-repeat"
          style={{
            backgroundImage: "url(/images/header-burst.jpg)",
            backgroundSize: "100% 200%",
          }}
        />
        {/* Dark overlay so the burst sits dark behind the logo + nav for max legibility */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black/60"
        />

        {/* Asset 2b — ambient gold dust drifting out of the burst light source */}
        <GoldParticleField className="pointer-events-none absolute inset-0 z-[1] h-full w-full" />

        {/* Flex layout — logo far left, horizontal nav far right */}
        <div className="relative z-10 flex items-center justify-between px-4 py-2 md:px-8 lg:py-3">
          {/*
           * Asset 1 — “HOT SINCE 86 ENTERTAINMENT” gold logo.
           * h-[43px] mobile (h-9 +20%) → h-12 tablet → h-16/h-20 laptop & desktop, exact aspect ratio.
           *
           * Stealth trigger: select-none + touch-manipulation stop rapid tapping
           * from highlighting text or firing mobile double-tap zoom.
           */}
          <Link
            href="/events"
            aria-label="Hot Since 86 Entertainment"
            onClick={handleLogoTap}
            className="shrink-0 select-none touch-manipulation [-webkit-tap-highlight-color:transparent]"
          >
            <span className="relative inline-flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LOGO_SRC}
                alt="Hot Since 86 Entertainment"
                className="relative z-[1] h-[43px] w-auto object-contain drop-shadow-[0_2px_8px_rgba(223,178,96,0.2)] md:h-12 lg:h-16 xl:h-20"
              />
              {/* Metallic glitter sheen — masked to the gold logo pixels */}
              <span aria-hidden="true" className="logo-sheen" />
            </span>
          </Link>

          <nav aria-label="HS86E primary">
            <ul className="flex items-center gap-4 md:gap-6">
              {NAV_ITEMS.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        // Uppercase, semibold, tracking-wider — small on mobile,
                        // scaled up at md:/lg: for crisp desktop/tablet legibility.
                        "flex items-center whitespace-nowrap border-b-2 px-0.5 pb-1 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 md:text-sm lg:text-base",
                        active
                          ? // Active — ONLY gold text + clean thin gold underline (no box, no glow)
                            "border-[#DFB260] text-[#DFB260]"
                          : // Inactive — simple muted text, no background (transparent border keeps alignment stable)
                            "border-transparent text-slate-300 hover:text-[#F5D68D]",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
