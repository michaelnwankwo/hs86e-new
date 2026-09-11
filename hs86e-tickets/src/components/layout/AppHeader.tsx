"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Asset 1 — uploaded gold 3D logo (transparent PNG) in /public. */
const LOGO_SRC = "/logohs86e.png";

type NavItem = {
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

/**
 * Global header navigation.
 *
 * Mapping uses only the app's EXISTING routes (no route changes):
 *  - EVENTS → /events    (also highlighted on /checkout, matching BottomNav grouping)
 *  - WALLET → /tickets   (the /wallet alias redirects here)
 *  - DOOR   → /scan
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
  { label: "Door", href: "/scan", isActive: (p) => p.startsWith("/scan") },
];

export function AppHeader() {
  const pathname = usePathname();

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

        {/* Flex layout — logo far left, horizontal nav far right */}
        <div className="relative z-10 flex items-center justify-between px-4 py-2 md:px-8 lg:py-3">
          {/*
           * Asset 1 — “HOT SINCE 86 ENTERTAINMENT” gold logo.
           * h-[43px] mobile (h-9 +20%) → h-12 tablet → h-16/h-20 laptop & desktop, exact aspect ratio.
           */}
          <Link
            href="/events"
            aria-label="Hot Since 86 Entertainment"
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_SRC}
              alt="Hot Since 86 Entertainment"
              className="h-[43px] w-auto object-contain drop-shadow-[0_2px_8px_rgba(223,178,96,0.2)] md:h-12 lg:h-16 xl:h-20"
            />
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
