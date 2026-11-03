"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAccount } from "@/components/account/CustomerAccountContext";

export function AccountForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const account = useCustomerAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await account.register(name, email, password);
      else await account.login(email, password);
      router.replace("/dashboard");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-gold/20 bg-surface-raised p-5">
      <div><h1 className="font-display text-3xl text-ink">{mode === "signup" ? "Create your account" : "Welcome back"}</h1><p className="mt-2 text-sm text-ink-muted">Your account keeps your profile and wallet details together.</p></div>
      {mode === "signup" && <label className="block text-sm text-ink-muted">Name<input required autoComplete="name" minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" /></label>}
      <label className="block text-sm text-ink-muted">Email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" /></label>
      <label className="block text-sm text-ink-muted">Password<input required type="password" minLength={mode === "signup" ? 12 : 1} maxLength={mode === "signup" ? 128 : 256} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" /></label>
      {error && <p role="alert" className="text-sm text-danger-bright">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-gold px-4 font-semibold text-[#111111] disabled:opacity-60">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
    </form>
  );
}