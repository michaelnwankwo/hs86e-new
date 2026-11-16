"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Gamepad2, Plus, Wallet, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating curved bottom navigation — Games · Events · CREATE (elevated center) · Wallet · Account.
 * The elevated center pill opens the event creation flow. Gold = brand standard (#D4AF37 family).
 */
const items = [
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/create", label: "Create", icon: Plus, center: true },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard", label: "Account", icon: UserRound },
] as const;

function isActive(pathname: string, href: string): boolean {
  switch (href) {
    case "/events":
      return pathname === "/" || pathname.startsWith("/events") || pathname.startsWith("/checkout");
    case "/dashboard":
      return pathname.startsWith("/dashboard") || pathname.startsWith("/account") || pathname.startsWith("/tickets");
    case "/wallet":
      return pathname.startsWith("/wallet");
    case "/create":
      return pathname.startsWith("/create");
    case "/games":
      return pathname.startsWith("/games");
    default:
      return pathname.startsWith(href);
  }
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md px-4">
        <ul
          className={cn(
            "pointer-events-auto relative grid grid-cols-5 items-end",
            "rounded-[1.75rem] border border-gold/25 bg-[#111111]/90 px-2 pb-2 pt-2 shadow-[0_18px_50px_rgba(0,0,0,0.55),0_0_0_1px_rgba(212,175,55,0.08)] backdrop-blur-xl"
          )}
        >
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            if ("center" in item && item.center) {
              return (
                <li key={item.href} className="relative flex flex-col items-center justify-end">
                  <Link
                    href={item.href}
                    aria-label="Create an event"
                    aria-current={active ? "page" : undefined}
                    className="group absolute -top-8 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#F5D68D] via-[#D4AF37] to-[#C5A059] text-[#111111] shadow-[0_0_0_5px_#0B0E14,0_10px_28px_rgba(212,175,55,0.45)] transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline-gold"
                  >
                    <Icon className="h-7 w-7 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.4} aria-hidden />
                  </Link>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-8 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors",
                      active ? "text-gold" : "text-ink-muted"
                    )}
                  >
                    Create
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-semibold uppercase tracking-[0.16em] transition-colors"
                >
                  <Icon className={cn("h-5 w-5 transition-colors", active ? "text-gold" : "text-ink-muted")} aria-hidden />
                  <span className={cn(active ? "text-gold" : "text-ink-muted")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
