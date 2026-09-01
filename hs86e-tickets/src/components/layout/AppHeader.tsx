import Link from "next/link";
import { Logo } from "@/components/branding/Logo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gold/20 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4">
        <Link href="/events" className="flex items-center gap-3" aria-label="HS86E events">
          <Logo size="sm" />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-gold sm:block">
            HS86E
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
          <Link href="/events" className="rounded-lg px-3 py-2 hover:text-gold">
            Events
          </Link>
          <Link href="/tickets" className="rounded-lg px-3 py-2 hover:text-gold">
            Wallet
          </Link>
          <Link href="/scan" className="rounded-lg px-3 py-2 text-gold hover:text-gold-champagne">
            Door
          </Link>
        </nav>
      </div>
    </header>
  );
}
