"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useScanQueue } from "@/hooks/useScanQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { decodeTicketPayload } from "@/lib/ticket-payload";

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function HistoryClient() {
  const { queue, pendingCount, failedCount, replay, syncing } = useScanQueue();
  const online = useOnlineStatus();
  const flushableCount = pendingCount + failedCount;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5">
        <h1 className="font-display text-3xl text-ink">THIS DEVICE</h1>
        <p className="mt-1 text-sm text-ink-muted">Local queue history and sync status</p>
      </div>

      <section aria-label="Scan summary" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-gold/20 bg-surface-raised px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Queue scans</p>
          <p className="mt-1 text-xl font-bold text-ink">{queue.length}</p>
        </div>
        <div className="rounded-xl border border-gold/20 bg-surface-raised px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Pending sync</p>
          <p className="mt-1 text-xl font-bold text-gold-champagne">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-danger-bright/30 bg-surface-raised px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-dim">Needs review</p>
          <p className="mt-1 text-xl font-bold text-danger-bright">{failedCount}</p>
        </div>
      </section>

      <button
        type="button"
        onClick={() => void replay(true)}
        disabled={syncing || flushableCount === 0 || !online}
        className="mb-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/35 bg-gold/10 px-4 text-sm font-semibold text-gold-champagne transition hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Flushing Queue…" : "Flush Queue"}
      </button>

      {queue.length === 0 ? (
        <p className="rounded-xl border border-gold/15 bg-surface-raised px-4 py-8 text-center text-sm text-ink-muted">
          No scans recorded on this device yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {queue
            .slice()
            .reverse()
            .map((row) => {
              const ticketId = decodeTicketPayload(row.ticketId) || row.ticketId;
              const status = row.synced ? "SYNCED" : row.failed ? "FAILED" : "PENDING";
              const statusClass = row.synced
                ? "border-emerald-300/25 bg-emerald-950/45 text-emerald-200"
                : row.failed
                  ? "border-danger-bright/35 bg-danger/20 text-rose-100"
                  : "border-gold/30 bg-gold/10 text-gold-champagne";

              return (
                <li
                  key={`${row.ticketId}-${row.scannedAt}`}
                  className="gold-border min-w-0 rounded-xl bg-surface-raised px-3 py-3 sm:px-4"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="max-w-full break-all font-mono text-sm text-gold-champagne">
                        {ticketId}
                      </p>
                      <p className="mt-1 text-xs text-ink-dim">{formatTimestamp(row.scannedAt)}</p>
                    </div>
                    <span
                      className={`inline-flex w-fit shrink-0 self-start rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] sm:self-auto ${statusClass}`}
                    >
                      {status}
                    </span>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <Link href="/scan" className="mt-6 block text-center text-sm text-gold">
        Back to scanner
      </Link>
    </div>
  );
}
