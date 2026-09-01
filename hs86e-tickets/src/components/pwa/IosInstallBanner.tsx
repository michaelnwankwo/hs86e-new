"use client";

import { Share, X } from "lucide-react";
import { useInstallPrompt } from "@/components/pwa/InstallPromptContext";

export function IosInstallBanner() {
  const { standalone, installed, isIOS, iosHintOpen, dismissIosHint } = useInstallPrompt();
  if (standalone || installed || !isIOS || !iosHintOpen) return null;

  return (
    <div
      className="fixed inset-x-4 z-50 rounded-2xl border border-[#DFB260]/40 bg-[#121821]/95 p-4 text-[#F8FAFC] shadow-lg shadow-[#DFB260]/10 backdrop-blur-md"
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-label="Add HS86E to Home Screen"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#DFB260]/40 text-[#DFB260]">
          <Share className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#DFB260]">
            Install HS86E
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#F8FAFC]/90">
            Tap <span className="text-[#F5D68D]">Share</span> then{" "}
            <span className="text-[#F5D68D]">Add to Home Screen</span> to run tickets and the door
            scanner like an app.
          </p>
        </div>
        <button type="button" onClick={dismissIosHint} className="text-[#DFB260]" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
