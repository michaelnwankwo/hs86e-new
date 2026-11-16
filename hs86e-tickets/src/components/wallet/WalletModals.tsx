"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export const QUICK_AMOUNTS = [100_000, 500_000, 1_000_000, 2_500_000]; // kobo

/** Client-side preview only — the server computes and books the real fee. */
export function withdrawalFeePreview(amountMinor: number): number {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return 0;
  return amountMinor < 1_000_000 ? 10_000 : 20_000;
}

export function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
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

export function DepositModal({ onClose }: { onClose: () => void }) {
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
      window.location.assign(body.url as string); // hosted checkout — cards never touch our origin
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Add money" onClose={onClose}>
      <p className="text-sm text-ink-muted">Pay securely with Flutterwave. Top-ups are free and usually reflect instantly. Intents expire after 30 minutes.</p>
      <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-gold" htmlFor="deposit-amount">Amount (₦)</label>
      <input id="deposit-amount" type="number" min={100} step={1} inputMode="numeric" placeholder="5,000" value={amount} onChange={(e) => setAmount(e.target.value)}
        className="mt-2 min-h-12 w-full rounded-xl border border-gold/25 bg-[#0b0b0b] px-4 text-lg text-ink outline-none focus:border-gold/60" autoFocus />
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

export function WithdrawModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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

/** Deposit return banner — polls after a Flutterwave redirect back to the wallet. */
export function DepositReturnBanner({ onConfirmed }: { onConfirmed?: () => void }) {
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
        if (body?.status === "completed") { setState("completed"); onConfirmed?.(); clearInterval(timer); }
        else if (body?.status === "expired" || body?.status === "failed") { setState(body.status); clearInterval(timer); }
        else if (attempts > 40) { clearInterval(timer); }
      } catch { /* keep polling */ }
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isReturn, ref, onConfirmed]);

  if (!isReturn) return null;
  const copy = {
    idle: "",
    pending: "Confirming your deposit with Flutterwave…",
    completed: "Deposit confirmed. Your wallet balance is up to date.",
    expired: "That deposit intent expired. You were not charged — try again anytime.",
    failed: "We could not confirm this deposit. If you were debited, contact support with your reference.",
  }[state];
  if (!copy) return null;
  return <p role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${state === "completed" ? "border-gold/40 text-gold" : state === "pending" ? "border-gold/20 text-ink-muted" : "border-danger-bright/40 text-danger-bright"}`}>{copy}</p>;
}
