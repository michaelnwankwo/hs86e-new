"use client";

import { useEffect, useState } from "react";
import { Check, Download, Share, X } from "lucide-react";
import { useInstallPrompt } from "@/components/pwa/InstallPromptContext";

const DISMISS_KEY = "hs86e:pwa-dismissed";

/**
 * Inline "Install the HS86E app" card for Account (/dashboard) and Wallet (/wallet).
 * Collapsible via the X — choice persists in localStorage (hs86e:pwa-dismissed).
 * Collapsed state leaves a minimal pill that re-opens the card (or installs directly).
 * Hidden entirely when the app is already installed / running standalone.
 */
export function InstallAppCard() {
  const { standalone, installed, canPrompt, install, isIOS } = useInstallPrompt();
  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = resolving (SSR-safe)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (standalone || installed) return null;
  if (dismissed === null) return null; // avoid hydration flash

  const collapse = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable — session-only collapse */
    }
    setDismissed(true);
  };
  const expand = () => {
    try {
      window.localStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    setDismissed(false);
  };

  if (dismissed) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => (canPrompt ? void install() : expand())}
          aria-label="Install HS86E app"
          title={canPrompt ? "Install HS86E" : "Add HS86E to your home screen"}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#111111]/80 px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37] backdrop-blur-md transition-colors hover:border-[#D4AF37]/60 hover:text-[#F5D68D]"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Install HS86E
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Install the app"
      className="relative rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 backdrop-blur-md sm:p-6"
    >
      <button
        type="button"
        onClick={collapse}
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 rounded-full p-2 text-ink-muted transition-colors hover:bg-gold/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-center sm:justify-between sm:pr-10">
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
          <div className="shrink-0 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-ink-muted sm:max-w-[230px]">
            <p className="flex items-center gap-2 font-semibold uppercase tracking-wider text-gold">
              <Share className="h-3.5 w-3.5" aria-hidden /> iPhone
            </p>
            <p className="mt-1">
              Tap <span className="text-[#F5D68D]">Share</span> then{" "}
              <span className="text-[#F5D68D]">Add to Home Screen</span>.
            </p>
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
          <p className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
            <Check className="h-4 w-4 text-gold" aria-hidden /> Use your browser menu → Install / Add to Home Screen.
          </p>
        )}
      </div>
    </section>
  );
}
