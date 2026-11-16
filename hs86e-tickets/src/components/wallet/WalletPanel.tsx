"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { DepositModal, WithdrawModal, DepositReturnBanner } from "@/components/wallet/WalletModals";

type BalanceResponse = {
  walletEnabled: boolean;
  frozen?: boolean;
  currency?: string;
  availableMinor?: number;
  pendingOutMinor?: number;
  status?: string;
  error?: string;
};

/** Compact wallet card used on the account dashboard. Full experience lives at /wallet. */
function WalletPanelInner() {
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/balance", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as BalanceResponse;
      setBalance(body);
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

  if (!balance?.walletEnabled) {
    return (
      <article className="rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 backdrop-blur-md sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Wallet</p>
        <p className="my-3 text-sm text-ink-muted">The HS86E Wallet is launching soon. Once live you will be able to top up, store value securely, and use it at checkout.</p>
        <a href="/wallet" className="flex min-h-11 w-full items-center justify-center rounded-xl border border-gold/25 px-3 text-sm font-semibold text-gold">Open wallet</a>
      </article>
    );
  }

  const available = balance.availableMinor ?? 0;
  const pending = balance.pendingOutMinor ?? 0;
  const frozen = balance.frozen === true;

  return (
    <>
      <DepositReturnBanner onConfirmed={refresh} />
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
        <a href="/wallet" className="mt-3 block text-center text-xs font-semibold text-ink-muted transition-colors hover:text-ink">View full wallet &amp; history →</a>
      </article>

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} />}
      {modal === "withdraw" && <WithdrawModal onClose={() => setModal(null)} onSuccess={() => void refresh()} />}
    </>
  );
}

export function WalletPanel() {
  return (
    <Suspense fallback={null}>
      <WalletPanelInner />
    </Suspense>
  );
}
