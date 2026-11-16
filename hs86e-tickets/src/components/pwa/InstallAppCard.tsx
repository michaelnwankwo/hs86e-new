"use client";

import { Check, Download, Share } from "lucide-react";
import { useInstallPrompt } from "@/components/pwa/InstallPromptContext";

/**
 * Inline "Install the HS86E app" card — deliberately NOT global.
 * Rendered only inside Account (/dashboard) and Wallet (/wallet).
 * Hidden entirely when the app is already installed/standalone.
 */
export function InstallAppCard() {
  const { standalone, installed, canPrompt, install, isIOS } = useInstallPrompt();
  if (standalone || installed) return null;

  return (
    <section
      aria-label="Install the app"
      className="rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 backdrop-blur-md sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Download className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Install HS86E</p>
            <p className="mt-1 max-w-prose text-sm leading-snug text-ink-muted">
              Full-screen tickets, offline door passes, and the fastest checkout — add the app to your home screen.
            </p>
          </div>
        </div>

        {isIOS ? (
          <div className="shrink-0 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-ink-muted sm:max-w-[240px]">
            <p className="flex items-center gap-2 font-semibold uppercase tracking-wider text-gold"><Share className="h-3.5 w-3.5" aria-hidden /> iPhone</p>
            <p className="mt-1">Tap <span className="text-[#F5D68D]">Share</span> then <span className="text-[#F5D68D]">Add to Home Screen</span>.</p>
          </div>
        ) : canPrompt ? (
          <button
            type="button"
            onClick={() => void install()}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gold px-6 font-semibold text-[#111111] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-gold"
          >
            <Download className="h-4 w-4" aria-hidden /> Install app
          </button>
        ) : (
          <p className="flex shrink-0 items-center gap-2 text-xs text-ink-muted"><Check className="h-4 w-4 text-gold" aria-hidden /> Use your browser menu → Install / Add to Home Screen.</p>
        )}
      </div>
    </section>
  );
}
