"use client";

import { Download } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function FloatingInstallButton() {
  const { canPrompt, install } = useInstallPrompt();
  if (!canPrompt) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="fixed bottom-20 right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#DFB260]/40 bg-[#0B0E14]/80 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#DFB260] shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-[#F5D68D] hover:text-[#F5D68D] hover:shadow-[0_0_22px_rgba(223,178,96,0.28)]"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Install App"
    >
      <Download className="h-4 w-4" aria-hidden />
      Install App
    </button>
  );
}
