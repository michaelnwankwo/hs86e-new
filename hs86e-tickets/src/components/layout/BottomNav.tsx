"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Gamepad2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom tab bar — EVENTS → GAMES → ACCOUNT.
 * The public SCAN/DOOR tab is retired; staff reach the scanner through the
 * stealth triple-tap on the header logo.
 */
const items = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/dashboard", label: "Account", icon: UserRound },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/20 bg-surface/92 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-3">
        {items.map((item) => {
          const active =
            item.href === "/events"
              ? pathname === "/" || pathname.startsWith("/events") || pathname.startsWith("/checkout")
              : item.href === "/dashboard"
                ? pathname.startsWith("/dashboard") || pathname.startsWith("/account") || pathname.startsWith("/tickets") || pathname.startsWith("/wallet")
                : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-[3.4rem] flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                  active ? "text-gold" : "text-ink-muted",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-gold-champagne")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
