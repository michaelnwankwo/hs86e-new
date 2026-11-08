import Link from "next/link";
import { CalendarDays, LogIn, Ticket, UserPlus } from "lucide-react";

/**
 * Luxury guest fallback for /dashboard.
 * Rendered when there is no verified customer session (direct visit, expired
 * cookie, or right after signing out) instead of a blank/frozen shell.
 * Presentational + server-safe: no client hooks, no data fetching.
 */
export function GuestAccountPanel({ notice }: { notice?: string }) {
  return (
    <main className="flex min-h-[72dvh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gold/25 bg-[#111111]/80 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
        <span
          aria-hidden
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gold/30 bg-gold/10"
        >
          <Ticket className="h-8 w-8 text-gold" />
        </span>

        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
          Hot Since 86 · Account
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">
          Your tickets, your wallet.
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
          Sign in or register to view your tickets and wallet details in one place.
        </p>

        {notice ? (
          <p
            role="status"
            className="mx-auto mt-4 max-w-xs rounded-xl border border-gold/20 bg-surface px-3 py-2 text-xs text-gold/90"
          >
            {notice}
          </p>
        ) : null}

        <div className="mt-6 space-y-2">
          <Link
            href="/login"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-[#1a1408] transition-colors hover:bg-gold-champagne"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 px-5 text-sm font-semibold text-gold transition-colors hover:border-gold/50 hover:bg-gold/10"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Create an account
          </Link>
          <Link
            href="/events"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 text-xs font-semibold text-ink-muted underline underline-offset-4 transition-colors hover:text-ink"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Browse events
          </Link>
        </div>
      </div>
    </main>
  );
}