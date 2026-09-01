"use client";

import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/components/pwa/InstallPromptContext";

export function PWAInstallButton() {
  const { standalone, installed, canPrompt, install, hint, dismissHint } = useInstallPrompt();
  if (standalone || installed) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {hint ? (
        <div className="max-w-[240px] rounded-xl border border-[#DFB260]/40 bg-[#121821]/95 px-3 py-2 text-[11px] leading-relaxed text-[#F8FAFC] shadow-lg backdrop-blur-md">
          <div className="flex items-start gap-2">
            <p className="flex-1">{hint}</p>
            <button type="button" onClick={dismissHint} className="text-[#DFB260]" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#DFB260]/40 bg-[#121821]/90 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F8FAFC] shadow-lg shadow-[#DFB260]/10 backdrop-blur-md transition hover:border-[#F5D68D] hover:text-[#F5D68D]"
        aria-label="Install App"
      >
        <Download className="h-4 w-4 text-[#DFB260]" aria-hidden />
        <span className="text-[#DFB260]">{canPrompt ? "Install App" : "Install App"}</span>
      </button>
    </div>
  );
}
