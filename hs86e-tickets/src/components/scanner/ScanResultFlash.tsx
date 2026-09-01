"use client";

import { cn } from "@/lib/utils";
import type { ScanVerdict } from "@/lib/types";

export function ScanResultFlash({ verdict }: { verdict: ScanVerdict | null }) {
  if (!verdict) return null;
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-50 animate-flash-in",
        verdict === "valid" && "bg-emerald-bright/80",
        verdict === "duplicate" && "bg-amber-bright/75",
        (verdict === "invalid" || verdict === "canceled" || verdict === "transferred") &&
          "bg-danger-bright/80",
      )}
      aria-hidden
    />
  );
}
