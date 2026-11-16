"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { DepositModal, WithdrawModal, DepositReturnBanner } from "@/components/wallet/WalletModals";
import { WalletHistory } from "@/components/wallet/WalletHistory";
import { InstallAppCard } from "@/components/pwa/InstallAppCard";

type BalanceResponse = {
  walletEnabled: boolean;
  frozen?: boolean;
  currency?: string;
  availableMinor?: number;
  pendingOutMinor?: number;
  status?: string;
  error?: string;
};

function WalletScreenInner() {
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

  const available = balance?.availableMinor ?? 0;
  const pending = balance?.pendingOutMinor ?? 0;
  const frozen = balance?.frozen === true;
  const enabled = balance?.walletEnabled === true;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <DepositReturnBanner onConfirmed={refresh} />

      <header className="overflow-hidden rounded-3xl border border-gold/25 bg-[#111111]/85 shadow-xl shadow-black/30 backdrop-blur-md">
        <div aria-hidden className="pointer-events-none h-24 bg-gradient-to-br from-[#F5D68D]/25 via-[#D4AF37]/15 to-transparent" />
        <div className="-mt-12 px-5 pb-6 sm:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-gold"><Wallet className="h-4 w-4" aria-hidden /> HS86E Wallet</p>
          {loading ? (
            <div className="mt-4 flex items-center gap-3 text-ink-muted"><Loader2 className="h-6 w-6 animate-spin text-gold" aria-hidden /><span className="text-sm">Loading your wallet…</span></div>
          ) : !enabled ? (
            <>
              <p className="mt-2 font-display text-4xl text-ink sm:text-5xl">Coming soon</p>
              <p className="mt-3 max-w-prose text-sm text-ink-muted">The HS86E Wallet is in final testing. Once live you will top up in NGN, hold gift-worthy value securely, and pay for tickets and experiences without leaving your account.</p>
              <button disabled className="mt-5 min-h-12 w-full cursor-not-allowed rounded-xl bg-gold/40 px-4 font-semibold text-[#111111]/70 sm:w-auto">Deposits &amp; withdrawals launching soon</button>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-4xl text-ink sm:text-5xl">{formatMoney(available / 100, balance?.currency ?? "NGN")}</p>
              {pending > 0 && <p className="mt-1 text-xs text-ink-muted">{formatMoney(pending / 100, "NGN")} held for pending withdrawals</p>}
              {frozen && <p role="status" className="mt-3 rounded-lg border border-gold/30 px-3 py-2 text-xs text-gold">Wallet is frozen for maintenance. Balances are safe; money moves are paused.</p>}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button type="button" disabled={frozen} onClick={() => setModal("deposit")}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 font-semibold text-[#111111] transition-opacity disabled:opacity-40"><ArrowDownLeft className="h-5 w-5" aria-hidden /> Add money</button>
                <button type="button" disabled={frozen} onClick={() => setModal("withdraw")}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-gold/30 px-4 font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"><ArrowUpRight className="h-5 w-5" aria-hidden /> Withdraw</button>
              </div>
            </>
          )}
        </div>
      </header>

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} />}
      {modal === "withdraw" && <WithdrawModal onClose={() => setModal(null)} onSuccess={() => void refresh()} />}

      {enabled && <WalletHistory limit={25} />}
      <InstallAppCard />
    </section>
  );
}

export function WalletScreen() {
  return (
    <Suspense fallback={null}>
      <WalletScreenInner />
    </Suspense>
  );
}
