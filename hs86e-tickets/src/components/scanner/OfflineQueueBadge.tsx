"use client";

import { WifiOff } from "lucide-react";

export function OfflineQueueBadge({
  pending,
  online,
  syncing,
}: {
  pending: number;
  online: boolean;
  syncing?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-gold/25 bg-surface/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
      {!online ? <WifiOff className="h-3.5 w-3.5" /> : null}
      {syncing ? "Syncing…" : pending > 0 ? `${pending} pending sync` : online ? "Online" : "Offline ready"}
    </div>
  );
}
