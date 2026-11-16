"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export type LedgerRow = {
  public_id: string;
  direction: "credit" | "debit";
  kind: string;
  amount_minor: number;
  balance_after_minor: number | null;
  status: string;
  ref: string;
  note: string | null;
  created_at: string;
};

type FilterKey = "all" | "completed" | "pending" | "failed" | "reversed";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "reversed", label: "Reversed" },
];

function kindLabel(kind: string): string {
  switch (kind) {
    case "deposit": return "Wallet top-up";
    case "withdrawal": return "Withdrawal";
    case "ticket_purchase": return "Ticket purchase";
    case "refund": return "Refund";
    case "fee": return "Fee";
    case "reversal": return "Reversal";
    case "adjustment": return "Adjustment";
    default: return kind;
  }
}

export function statusPill(status: string): { label: string; cls: string } {
  switch (status) {
    case "completed": return { label: "Completed", cls: "border-gold/40 text-gold" };
    case "pending": return { label: "Pending", cls: "border-amber-bright/50 text-amber-bright" };
    case "failed": return { label: "Failed", cls: "border-danger-bright/50 text-danger-bright" };
    case "reversed": return { label: "Reversed", cls: "border-ink-dim/50 text-ink-muted" };
    case "disputed": return { label: "Disputed", cls: "border-danger-bright/50 text-danger-bright" };
    default: return { label: status, cls: "border-gold/20 text-ink-muted" };
  }
}

export function WalletHistory({ limit = 25 }: { limit?: number }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (mode: "replace" | "append", before?: string | null) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (filter !== "all") params.set("status", filter);
    if (before) params.set("before", before);
    const res = await fetch(`/api/wallet/transactions?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`history_${res.status}`);
    const body = await res.json().catch(() => ({ rows: [], nextBefore: null }));
    const incoming = Array.isArray(body?.rows) ? (body.rows as LedgerRow[]) : [];
    setRows((prev) => (mode === "replace" ? incoming : [...prev, ...incoming]));
    setNextBefore(typeof body?.nextBefore === "string" ? body.nextBefore : null);
  }, [filter, limit]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load("replace", null)
      .catch(() => { if (!cancelled) setError("Could not load your wallet history. Pull to retry."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  async function loadMore() {
    if (loadingMore || !nextBefore) return;
    setLoadingMore(true);
    try { await load("append", nextBefore); } catch { setError("Could not load more. Try again."); }
    setLoadingMore(false);
  }

  return (
    <section aria-labelledby="wallet-history-title" className="rounded-2xl border border-gold/20 bg-surface-raised/60 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="wallet-history-title" className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Transaction history</p>
        <a href={filter === "all" ? "/api/wallet/transactions?format=csv" : `/api/wallet/transactions?format=csv&status=${filter}`} download className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"><Download className="h-4 w-4" aria-hidden /> Statement (CSV)</a>
      </div>

      <div role="tablist" aria-label="Filter by status" className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button key={f.key} role="tab" aria-selected={active} onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-gold/60 bg-gold/15 text-gold" : "border-gold/15 text-ink-muted hover:text-ink"}`}>
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-8 text-ink-muted"><Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden /><span className="text-sm">Loading history…</span></div>
      ) : error ? (
        <p role="alert" className="py-6 text-sm text-danger-bright">{error}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-sm text-ink-muted">No {filter === "all" ? "" : filter + " "}transactions yet.</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">
                  <th className="pb-2 pr-3 font-semibold">Date</th>
                  <th className="pb-2 pr-3 font-semibold">Type</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Reference</th>
                  <th className="pb-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold/10">
                {rows.map((row) => {
                  const pill = statusPill(row.status);
                  return (
                    <tr key={row.public_id} className="align-middle">
                      <td className="py-3 pr-3 text-xs text-ink-muted">{new Date(row.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-2">
                          {row.direction === "credit"
                            ? <ArrowDownLeft className="h-4 w-4 text-gold" aria-hidden />
                            : <ArrowUpRight className="h-4 w-4 text-ink-muted" aria-hidden />}
                          <span className="text-ink">{kindLabel(row.kind)}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-3"><span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pill.cls}`}>{pill.label}</span></td>
                      <td className="py-3 pr-3 font-mono text-[11px] text-ink-dim">{row.ref}</td>
                      <td className={`py-3 text-right tabular-nums font-semibold ${row.direction === "credit" ? "text-gold" : "text-ink"}`}>{row.direction === "credit" ? "+" : "−"}{formatMoney(row.amount_minor / 100, "NGN")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {nextBefore && (
            <button type="button" onClick={() => void loadMore()} disabled={loadingMore}
              className="mt-4 min-h-11 w-full rounded-xl border border-gold/25 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
