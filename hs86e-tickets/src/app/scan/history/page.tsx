"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SCAN_QUEUE_KEY } from "@/lib/constants";
import { safeJson } from "@/lib/utils";
import type { QueuedScan } from "@/lib/types";

export default function ScanHistoryPage() {
  const [rows, setRows] = useState<QueuedScan[]>([]);

  useEffect(() => {
    setRows(safeJson<QueuedScan[]>(localStorage.getItem(SCAN_QUEUE_KEY), []));
  }, []);

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink">This device</h1>
        <p className="mt-1 text-sm text-ink-muted">Local scan log and sync status</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-ink-muted">No scans on this phone yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows
            .slice()
            .reverse()
            .map((row) => (
              <li
                key={`${row.ticketId}-${row.scannedAt}`}
                className="gold-border flex items-center justify-between rounded-xl bg-surface-raised px-3 py-3"
              >
                <div>
                  <p className="font-mono text-sm text-gold-champagne">{row.ticketId}</p>
                  <p className="text-xs text-ink-dim">{new Date(row.scannedAt).toLocaleString()}</p>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    row.synced ? "text-emerald-bright" : "text-gold"
                  }`}
                >
                  {row.synced ? "Synced" : "Pending"}
                </span>
              </li>
            ))}
        </ul>
      )}
      <Link href="/scan" className="mt-6 block text-center text-sm text-gold">
        Back to scanner
      </Link>
    </div>
  );
}
