"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2, Wallet, X, ArrowDownLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type BalanceResponse = {
  walletEnabled: boolean;
  frozen?: boolean;
  currency?: string;
  availableMinor?: number;
  pendingOutMinor?: number;
  status?: string;
  error?: string;
};

type LedgerRow = {
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

const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 2_500_000]; // kobo: ₦1,000 / ₦5,000 / ₦10,000 / ₦25,000

function withdrawalFeePreview(amountMinor: number): number {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return 0;
  return amountMinor < 1_000_000 ? 10_000 : 20_000;
}

function DepositModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const amountMinor = Math.round(Number(amount || 0) * 100);
  const valid = Number.isInteger(amountMinor) && amountMinor >= 10_000 && amountMinor <= 500_000_000;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMinor }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error ?? "Could not start deposit. Please try again.");
        setBusy(false);
        return;
      }
      // Hand off to Flutterwave hosted checkout — money never touches our origin.
      window.location.assign(body.url as string);
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Add money" onClose={onClose}>
      <p className="text-sm text-ink-muted">Pay securely with Flutterwave. Top-ups are free and usually reflect instantly. Intents expire after 30 minutes.</p>
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-gold" htmlFor="deposit-amount">Amount (₦)</label>
      <input
        id="deposit-amount"
        type="number"
        min={100}
        step={1}
        inputMode="numeric"
        placeholder="5,000"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mt-2 min-h-12 w-full rounded-xl border border-gold/25 bg-[#0b0b0b] px-4 text-lg text-ink outline-none focus:border-gold/60"
        autoFocus
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((q) => (
          <button key={q} type="button" onClick={() => setAmount(String(q / 100))}
            className="rounded-full border border-gold/30 px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10">
            ₦{(q / 100).toLocaleString("en-NG")}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger-bright">{error}</p>}
      <button type="button" disabled={!valid || busy} onClick={() => void submit()}
        className="mt-5 min-h-12 w-full rounded-xl bg-gold font-semibold text-[#111111] transition-opacity disabled:opacity-40">
        {busy ? "Contacting Flutterwave…" : valid ? `Pay ${formatMoney(amountMinor / 100, "NGN")}` : "Enter at least ₦100"}
      </button>
    </ModalShell>
  );
}

function WithdrawModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneRef, setDoneRef] = useState("");

  const amountMinor = Math.round(Number(amount || 0) * 100);
  const fee = withdrawalFeePreview(amountMinor);
  const nubanOk = /^\d{10}$/.test(accountNumber);
  const valid = Number.isInteger(amountMinor) && amountMinor >= 50_000 && nubanOk && bankName.trim() && bankCode.trim() && accountName.trim();

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMinor, bankCode: bankCode.trim(), bankName: bankName.trim(), accountNumber, accountName: accountName.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error === "insufficient_funds" ? "Not enough available balance." : body?.error ?? "Could not request withdrawal.");
        setBusy(false);
        return;
      }
      setDoneRef(body.ref ?? "");
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  if (doneRef) {
    return (
      <ModalShell title="Withdrawal queued" onClose={onClose}>
        <div className="flex flex-col items-center py-4 text-center">
          <ShieldCheck className="h-12 w-12 text-gold" aria-hidden />
          <p className="mt-3 font-semibold text-ink">Your request is in the review queue.</p>
          <p className="mt-2 text-sm text-ink-muted">Reference <span className="font-mono text-gold">{doneRef}</span>. Funds are held now and will be paid to your bank or returned within 1–3 business days.</p>
          <button type="button" onClick={onClose} className="mt-5 min-h-12 w-full rounded-xl bg-gold font-semibold text-[#111111]">Done</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Withdraw" onClose={onClose}>
      <p className="text-sm text-ink-muted">Manual review for every payout. Fee is ₦100 under ₦10,000, ₦200 above. Withdrawals are paid within 1–3 business days.</p>
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-gold" htmlFor="withdraw-amount">Amount (₦)</label>
      <input id="withdraw-amount" type="number" min={500} step={1} inputMode="numeric" placeholder="10,000" value={amount} onChange={(e) => setAmount(e.target.value)}
        className="mt-2 min-h-12 w-full rounded-xl border border-gold/25 bg-[#0b0b0b] px-4 text-lg text-ink outline-none focus:border-gold/60" autoFocus />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Bank name" value={bankName} onChange={setBankName} placeholder="GTBank" />
        <Field label="Bank code" value={bankCode} onChange={setBankCode} placeholder="058" mono />
      </div>
      <Field label="Account number (NUBAN)" value={accountNumber} onChange={(v) => setAccountNumber(v.replace(/\D/g, "").slice(0, 10))} placeholder="0000000000" mono className="mt-3" inputMode="numeric" />
      <Field label="Account name" value={accountName} onChange={setAccountName} placeholder="Name shown by your bank" className="mt-3" />
      {amountMinor > 0 && (
        <p className="mt-3 text-xs text-ink-muted">Fee {formatMoney(fee / 100, "NGN")} · You receive <span className="font-semibold text-ink">{formatMoney(Math.max(0, amountMinor - fee) / 100, "NGN")}</span></p>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger-bright">{error}</p>}
      <button type="button" disabled={!valid || busy} onClick={() => void submit()}
        className="mt-5 min-h-12 w-full rounded-xl bg-gold font-semibold text-[#111111] transition-opacity disabled:opacity-40">
        {busy ? "Reserving funds…" : "Request withdrawal"}
      </button>
    </ModalShell>
  );
}

function Field({ label, value, onChange, placeholder, mono, className, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; className?: string; inputMode?: "numeric" | "text";
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-gold">{label}</label>
      <input type="text" value={value} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`mt-2 min-h-12 w-full rounded-xl border border-gold/25 bg-[#0b0b0b] px-4 text-ink outline-none focus:border-gold/60 ${mono ? "font-mono tracking-wider" : ""}`} />
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-gold/25 bg-[#141414] p-5 sm:rounded-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-full p-2 text-ink-muted transition-colors hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function DepositReturnBanner() {
  const params = useSearchParams();
  const [state, setState] = useState<"idle" | "pending" | "completed" | "expired" | "failed">("idle");
  const ref = params.get("ref");
  const isReturn = params.get("wallet") === "deposit" && ref;

  useEffect(() => {
    if (!isReturn || !ref) return;
    let cancelled = false;
    let attempts = 0;
    setState("pending");
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/wallet/deposits/${encodeURIComponent(ref)}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (body?.status === "completed") { setState("completed"); clearInterval(timer); }
        else if (body?.status === "expired" || body?.status === "failed") { setState(body.status); clearInterval(timer); }
        else if (attempts > 40) { clearInterval(timer); } // ~2 min, stop polling
      } catch { /* keep polling */ }
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isReturn, ref]);

  if (!isReturn) return null;
  const copy = {
    idle: "", pending: "Confirming your deposit with Flutterwave…",
    completed: "Deposit confirmed. Your wallet balance is up to date.",
    expired: "That deposit intent expired. You were not charged — try again anytime.",
    failed: "We could not confirm this deposit. If you were debited, contact support with your reference.",
  }[state];
  if (!copy) return null;
  return <p role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${state === "completed" ? "border-gold/40 text-gold" : state === "pending" ? "border-gold/20 text-ink-muted" : "border-danger-bright/40 text-danger-bright"}`}>{copy}</p>;
}

function WalletPanelInner() {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balance", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as BalanceResponse;
      setBalance(body);
      if (body.walletEnabled) {
        const tx = await fetch("/api/wallet/transactions?limit=10", { cache: "no-store" });
        const payload = await tx.json().catch(() => ({ rows: [] }));
        setRows(Array.isArray(payload?.rows) ? payload.rows : []);
      }
    } catch {
      setBalance({ walletEnabled: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return (
      <article className="rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 backdrop-blur-md sm:p-6">
        <div className="flex items-center gap-3 text-ink-muted"><Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden /><span className="text-sm">Loading your wallet…</span></div>
      </article>
    );
  }

  // Feature flag off (or wallet unreachable) — fail-closed explainer, never a dead button.
  if (!balance?.walletEnabled) {
    return (
      <article className="rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 backdrop-blur-md sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Wallet</p>
        <p className="my-3 text-sm text-ink-muted">The HS86E Wallet is launching soon. Once live you will be able to top up, store value securely, and use it at checkout.</p>
        <button disabled className="min-h-11 w-full cursor-not-allowed rounded-xl bg-gold/40 px-3 font-semibold text-[#111111]/70">Deposits &amp; withdrawals coming soon</button>
      </article>
    );
  }

  const available = balance.availableMinor ?? 0;
  const pending = balance.pendingOutMinor ?? 0;
  const frozen = balance.frozen === true;

  return (
    <>
      <DepositReturnBanner />
      <article className="rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 shadow-xl shadow-black/20 backdrop-blur-md sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Wallet balance</p>
          <Wallet className="h-5 w-5 text-gold/70" aria-hidden />
        </div>
        <p className="my-3 text-3xl font-bold text-ink">{formatMoney(available / 100, balance.currency ?? "NGN")}</p>
        {pending > 0 && <p className="-mt-2 mb-2 text-xs text-ink-muted">{formatMoney(pending / 100, "NGN")} held for pending withdrawals</p>}
        {frozen && <p role="status" className="mb-2 rounded-lg border border-gold/30 px-3 py-2 text-xs text-gold">Wallet is temporarily frozen for maintenance. Money moves are paused; balances are safe.</p>}
        <div className="flex gap-3">
          <button type="button" disabled={frozen} onClick={() => setModal("deposit")}
            className="min-h-11 flex-1 rounded-xl bg-gold px-3 font-semibold text-[#111111] transition-opacity disabled:opacity-40">Add money</button>
          <button type="button" disabled={frozen} onClick={() => setModal("withdraw")}
            className="min-h-11 flex-1 rounded-xl border border-gold/30 px-3 font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-40">Withdraw</button>
        </div>
      </article>

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} />}
      {modal === "withdraw" && <WithdrawModal onClose={() => setModal(null)} onSuccess={() => void refresh()} />}

      <article className="rounded-2xl border border-gold/20 bg-surface-raised/60 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Recent activity</p>
          <a href="/api/wallet/transactions?format=csv" download className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"><Download className="h-4 w-4" aria-hidden /> Statement (CSV)</a>
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No wallet activity yet. Your first top-up will appear here with a receipt reference.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gold/10">
            {rows.map((row) => (
              <li key={row.public_id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {row.direction === "credit"
                    ? <ArrowDownLeft className="h-5 w-5 shrink-0 text-gold" aria-hidden />
                    : <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{kindLabel(row.kind)}{row.status === "pending" ? " · pending" : row.status === "reversed" ? " · reversed" : ""}</p>
                    <p className="truncate text-[11px] text-ink-muted">{new Date(row.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })} · {row.ref}</p>
                  </div>
                </div>
                <p className={`shrink-0 text-sm font-semibold tabular-nums ${row.direction === "credit" ? "text-gold" : "text-ink"}`}>{row.direction === "credit" ? "+" : "−"}{formatMoney(row.amount_minor / 100, "NGN")}</p>
              </li>
            ))}
          </ul>
        )}
      </article>
    </>
  );
}

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

export function WalletPanel() {
  return (
    <Suspense fallback={null}>
      <WalletPanelInner />
    </Suspense>
  );
}
