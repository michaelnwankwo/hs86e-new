"use client";

import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { useCustomerAccount } from "@/components/account/CustomerAccountContext";
import { AccountTicketStack } from "@/components/account/AccountTicketStack";
import { GuestAccountPanel } from "@/components/account/GuestAccountPanel";

function SigningOutSplash() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-[72dvh] w-full flex-col items-center justify-center gap-4 px-4"
    >
      <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">
        Signing you out…
      </p>
      <Ticket className="h-5 w-5 text-gold/40" aria-hidden />
    </main>
  );
}

export function AccountDashboard() {
  const account = useCustomerAccount();
  const [logoutWarning, setLogoutWarning] = useState("");
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    if (leaving) return;
    setLogoutWarning("");
    setLeaving(true);
    try {
      // Best-effort revoke + cookie clear; never block the exit on it.
      await account.logout();
    } catch {
      setLogoutWarning("Signed out on this device.");
    } finally {
      // Hard navigation: forces the server to re-check the cleared cookie and
      // drops all client/PWA state — the user can never land on a frozen
      // authenticated shell again.
      window.location.assign("/events");
    }
  }

  // While the exit is in flight, show a deliberate splash — never a blank.
  if (leaving) return <SigningOutSplash />;

  // Signed-out visitor who stayed on the page: clean guest fallback.
  if (account.status !== "signed_in") {
    return <GuestAccountPanel notice={logoutWarning || undefined} />;
  }

  const { user, wallet } = account.session;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-gold/20 bg-surface-raised/70 p-5 backdrop-blur-md"><p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Account</p><h1 className="mt-1 font-display text-3xl text-ink">Welcome, {user.name}</h1><p className="mt-1 text-sm text-ink-muted">{user.email}</p></header>
      <article className="rounded-2xl border border-gold/25 bg-[#111111]/85 p-5 shadow-xl shadow-black/20 backdrop-blur-md sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Wallet balance</p>
        {wallet?.status === "ready" ? <p className="my-3 text-3xl font-bold text-ink">{formatMoney(wallet.balanceMinor / 100, wallet.currency)}</p> : <p className="my-3 text-sm text-ink-muted">Wallet setup is pending. No spendable balance is available yet.</p>}
        <div className="flex gap-3"><button disabled className="min-h-11 flex-1 rounded-xl bg-gold px-3 font-semibold text-[#111111] opacity-50">Deposit · Coming soon</button><button disabled className="min-h-11 flex-1 rounded-xl border border-gold/30 px-3 font-semibold text-gold opacity-50">Withdraw · Coming soon</button></div>
      </article>
      <AccountTicketStack />
      {logoutWarning && <p role="alert" className="text-sm text-danger-bright">{logoutWarning}</p>}
      <button type="button" onClick={() => void signOut()} className="min-h-11 w-full rounded-xl border border-gold/20 px-4 text-sm text-ink-muted transition-colors hover:border-gold/40 hover:text-ink sm:w-auto">Sign out</button>
    </section>
  );
}