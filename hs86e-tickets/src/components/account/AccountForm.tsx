<<<<<<< HEAD
﻿"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
=======
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
>>>>>>> 0fc5387 (Fix build dependencies and ticket issue service)
import { useCustomerAccount } from "@/components/account/CustomerAccountContext";

export function AccountForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const account = useCustomerAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
<<<<<<< HEAD
  const [showPassword, setShowPassword] = useState(false);
=======
>>>>>>> 0fc5387 (Fix build dependencies and ticket issue service)
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
<<<<<<< HEAD
      const message = problem instanceof Error ? problem.message : "Unable to sign in. Please try again.";
      setError(/^forbidden$/i.test(message)
        ? "We couldn't verify your sign-in request. Refresh the page and try again."
        : message);
=======
      setError(problem instanceof Error ? problem.message : "Unable to sign in");
>>>>>>> 0fc5387 (Fix build dependencies and ticket issue service)
    } finally {
      setBusy(false);
    }
  }

<<<<<<< HEAD
  const passwordId = `account-password-${mode}`;

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-gold/25 bg-[#111111]/80 p-5 shadow-2xl shadow-black/40 backdrop-blur-md">
      <div>
        <h1 className="font-display text-3xl text-ink">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your account keeps your profile and wallet details together.
        </p>
      </div>

      {mode === "signup" ? (
        <label className="block text-sm text-ink-muted" htmlFor="account-name">
          Name
          <input id="account-name" required autoComplete="name" minLength={2} maxLength={80}
            value={name} onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" />
        </label>
      ) : null}

      <label className="block text-sm text-ink-muted" htmlFor="account-email">
        Email
        <input id="account-email" required type="email" autoComplete="email" maxLength={254}
          value={email} onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" />
      </label>

      <div>
        <label className="block text-sm text-ink-muted" htmlFor={passwordId}>Password</label>
        <div className="relative mt-2">
          <input id={passwordId} required type={showPassword ? "text" : "password"}
            minLength={mode === "signup" ? 12 : 1} maxLength={mode === "signup" ? 128 : 256}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password} onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 pr-12 text-ink" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-gold/80 hover:text-gold"
            aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
            {showPassword
              ? <EyeOff className="h-5 w-5" aria-hidden />
              : <Eye className="h-5 w-5" aria-hidden />}
          </button>
        </div>
        {mode === "login" ? (
          <div className="mt-2 text-right">
            <Link href="/api/account/lost-password" className="text-xs text-gold underline underline-offset-4">
              Forgot password?
            </Link>
          </div>
        ) : null}
      </div>

      {error ? <p role="alert" aria-live="polite" className="text-sm text-danger-bright">{error}</p> : null}
      <button type="submit" disabled={busy}
        className="min-h-12 w-full rounded-xl bg-gold px-4 font-semibold text-[#111111] disabled:opacity-60">
        {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
      </button>
=======
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-gold/20 bg-surface-raised p-5">
      <div><h1 className="font-display text-3xl text-ink">{mode === "signup" ? "Create your account" : "Welcome back"}</h1><p className="mt-2 text-sm text-ink-muted">Your account keeps your profile and wallet details together.</p></div>
      {mode === "signup" && <label className="block text-sm text-ink-muted">Name<input required autoComplete="name" minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" /></label>}
      <label className="block text-sm text-ink-muted">Email<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" /></label>
      <label className="block text-sm text-ink-muted">Password<input required type="password" minLength={mode === "signup" ? 12 : 1} maxLength={mode === "signup" ? 128 : 256} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink" /></label>
      {error && <p role="alert" className="text-sm text-danger-bright">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-gold px-4 font-semibold text-[#111111] disabled:opacity-60">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
>>>>>>> 0fc5387 (Fix build dependencies and ticket issue service)
    </form>
  );
}
