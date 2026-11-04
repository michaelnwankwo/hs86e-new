"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { useCustomerAccount } from "@/components/account/CustomerAccountContext";

export function AccountDashboard() {
  const account = useCustomerAccount();
  const router = useRouter();
  const [logoutWarning, setLogoutWarning] = useState("");
  if (account.status !== "signed_in") return <div role={logoutWarning ? "alert" : undefined} className="px-4 py-12 text-center text-ink-muted">{logoutWarning || "Account session unavailable. Please sign in again."}</div>;
  const { user, wallet } = account.session;

  async function signOut() {
    setLogoutWarning("");
    try { await account.logout(); router.replace("/login"); }
    catch (error) { setLogoutWarning(error instanceof Error ? error.message : "Server-side sign-out could not be confirmed"); }
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-gold/20 bg-surface-raised/70 p-5 backdrop-blur-md"><p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Account</p><h1 className="mt-1 font-display text-3xl text-ink">Welcome, {user.name}</h1><p className="mt-1 text-sm text-ink-muted">{user.email}</p></header>
      <article className="rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 shadow-xl shadow-black/20 backdrop-blur-md sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Wallet balance</p>
        {wallet?.status === "ready" ? <p className="my-3 text-3xl font-bold text-ink">{formatMoney(wallet.balanceMinor / 100, wallet.currency)}</p> : <p className="my-3 text-sm text-ink-muted">Wallet setup is pending. No spendable balance is available yet.</p>}
        <div className="flex gap-3"><button disabled className="min-h-11 flex-1 rounded-xl bg-gold px-3 font-semibold text-[#111111] opacity-50">Deposit · Coming soon</button><button disabled className="min-h-11 flex-1 rounded-xl border border-gold/30 px-3 font-semibold text-gold opacity-50">Withdraw · Coming soon</button></div>
      </article>
      {logoutWarning && <p role="alert" className="text-sm text-danger-bright">{logoutWarning}</p>}
      <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-xl border border-gold/20 px-4 text-sm text-ink-muted">Sign out</button>
    </section>
  );
}
