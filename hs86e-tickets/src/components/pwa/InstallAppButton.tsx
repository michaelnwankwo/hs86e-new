"use client";

import { Download } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallAppButton() {
  const { canInstall, install } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#DFB260]/40 bg-[#0B0E14] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#DFB260] transition hover:border-[#F5D68D] hover:text-[#F5D68D] hover:shadow-[0_0_16px_rgba(223,178,96,0.25)]"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      Install
    </button>
  );
}
