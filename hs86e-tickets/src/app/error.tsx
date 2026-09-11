"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

/**
 * App-wide error boundary. Any unexpected Server/Client Component failure
 * degrades to this branded Gold/Slate fallback (with retry) instead of the
 * generic production digest screen.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[hs86e] Route error boundary captured:", error);
  }, [error]);

  return (
    <div className="px-4 py-16">
      <div className="relative overflow-hidden rounded-3xl border border-gold/20 bg-surface-raised px-6 py-10 text-center shadow-gold">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="relative flex flex-col items-center">
          <TriangleAlert className="h-10 w-10 text-gold" aria-hidden />
          <h1 className="mt-4 font-display text-3xl text-ink">Something went wrong</h1>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            We hit an unexpected snag loading this page. It has been logged — please try again.
          </p>
          {error.digest ? (
            <p className="mt-2 text-xs text-ink-dim">Reference: {error.digest}</p>
          ) : null}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-surface transition hover:bg-gold-champagne"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Try again
            </button>
            <Link href="/events" className="text-sm text-gold">
              Back to events
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
