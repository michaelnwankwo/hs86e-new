# Phase 1 Wallet Auth — Direct File Creation Manifest

Create each file at the exact path shown. These are complete file contents (Unix LF line endings); no `git apply` step is required. The routes expect the WordPress REST contract documented in `phase1-wallet-auth-wordpress-checklist.md`.

## `src/lib/customer-account-proxy.ts`

```typescript
import { z } from "zod";
import { getEnvSafe } from "@/lib/env";

export const CUSTOMER_SESSION_COOKIE = "hs86e_customer_session";
export const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const userSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().max(120),
  email: z.string().email(),
});
const walletSchema = z.union([
  z.object({
    status: z.literal("ready"),
    currency: z.string().length(3),
    balanceMinor: z.number().int().nonnegative().safe(),
  }),
  z.object({ status: z.literal("not_configured") }),
]);
export const accountSessionSchema = z.object({ user: userSchema, wallet: walletSchema.nullable() });
export type AccountSession = z.infer<typeof accountSessionSchema>;

export class AccountProxyError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function wpCustomerUrl(resource: "login" | "register" | "session") {
  const base = getEnvSafe().WP_BASE_URL;
  if (!base) throw new AccountProxyError(503, "WordPress account service is not configured");
  return new URL(`/wp-json/hs86e-wallet/v1/customer/${resource}`, `${base.replace(/\/$/, "")}/`).toString();
}

export async function callWordPressCustomer(
  resource: "login" | "register" | "session",
  init: RequestInit = {},
) {
  let response: Response;
  try {
    response = await fetch(wpCustomerUrl(resource), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json", ...init.headers },
    });
  } catch {
    throw new AccountProxyError(503, "Account service is temporarily unavailable");
  }
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) {
    const message = response.status === 401
      ? "Email or password is incorrect"
      : response.status === 409
        ? "An account already uses that email"
        : response.status === 429
          ? "Too many attempts. Wait and try again"
          : "Account service could not complete the request";
    throw new AccountProxyError(response.status, message);
  }
  return body;
}

export function validSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export function sameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function parseAccountSession(value: unknown): AccountSession | null {
  const parsed = accountSessionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function noStoreHeaders() {
  return { "Cache-Control": "private, no-store, max-age=0" };
}
```

## `src/app/api/account/login/route.ts`

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AccountProxyError,
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  noStoreHeaders,
  parseAccountSession,
  sameOriginRequest,
  validSessionToken,
} from "@/lib/customer-account-proxy";

const schema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
  try {
    const result = await callWordPressCustomer("login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    }) as { sessionToken?: unknown; user?: unknown; wallet?: unknown } | null;
    if (!validSessionToken(result?.sessionToken)) {
      return NextResponse.json({ error: "Account service returned an invalid session" }, { status: 502 });
    }
    const session = parseAccountSession({ user: result.user, wallet: result.wallet ?? null });
    if (!session) return NextResponse.json({ error: "Account service returned invalid profile data" }, { status: 502 });
    const response = NextResponse.json(session, { headers: noStoreHeaders() });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CUSTOMER_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    const status = error instanceof AccountProxyError ? (error.status >= 500 ? 503 : error.status) : 503;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account service unavailable" }, { status, headers: noStoreHeaders() });
  }
}
```

## `src/app/api/account/logout/route.ts`

```typescript
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AccountProxyError,
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  noStoreHeaders,
  sameOriginRequest,
} from "@/lib/customer-account-proxy";

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  let revoked = !token;
  if (token) {
    try {
      await callWordPressCustomer("session", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      revoked = true;
    } catch (error) {
      // Always clear the browser cookie; never claim server revocation if WP was unavailable.
      revoked = error instanceof AccountProxyError && error.status === 401;
    }
  }
  const response = NextResponse.json({ ok: true, serverSessionRevoked: revoked }, { headers: noStoreHeaders() });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
```

## `src/app/api/account/register/route.ts`

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AccountProxyError,
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_MAX_AGE,
  noStoreHeaders,
  parseAccountSession,
  sameOriginRequest,
  validSessionToken,
} from "@/lib/customer-account-proxy";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name, valid email, and password of at least 12 characters" }, { status: 400 });
  try {
    const result = await callWordPressCustomer("register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    }) as { sessionToken?: unknown; user?: unknown; wallet?: unknown } | null;
    if (!validSessionToken(result?.sessionToken)) {
      return NextResponse.json({ error: "Account service returned an invalid session" }, { status: 502 });
    }
    const session = parseAccountSession({ user: result.user, wallet: result.wallet ?? null });
    if (!session) return NextResponse.json({ error: "Account service returned invalid profile data" }, { status: 502 });
    const response = NextResponse.json(session, { status: 201, headers: noStoreHeaders() });
    response.cookies.set(CUSTOMER_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CUSTOMER_SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    const status = error instanceof AccountProxyError ? (error.status >= 500 ? 503 : error.status) : 503;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Account service unavailable" }, { status, headers: noStoreHeaders() });
  }
}
```

## `src/app/api/account/session/route.ts`

```typescript
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  noStoreHeaders,
  parseAccountSession,
} from "@/lib/customer-account-proxy";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: noStoreHeaders() });
  try {
    const result = await callWordPressCustomer("session", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const session = parseAccountSession(result);
    if (!session) return NextResponse.json({ error: "Account service returned invalid profile data" }, { status: 502, headers: noStoreHeaders() });
    return NextResponse.json(session, { headers: noStoreHeaders() });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const response = NextResponse.json({ error: status === 401 ? "Session expired" : "Account service is temporarily unavailable" }, { status: status === 401 ? 401 : 503, headers: noStoreHeaders() });
    if (status === 401) response.cookies.set(CUSTOMER_SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  }
}
```

## `src/components/account/CustomerAccountContext.tsx`

```typescript
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface CustomerAccountSession {
  user: { id: string; name: string; email: string };
  wallet: null | { status: "ready"; currency: string; balanceMinor: number } | { status: "not_configured" };
}
type State =
  | { status: "loading"; session: null }
  | { status: "signed_out"; session: null }
  | { status: "signed_in"; session: CustomerAccountSession }
  | { status: "error"; session: null; message: string };
type ContextValue = State & {
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Context = createContext<ContextValue | null>(null);

async function parseResponse<T = unknown>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Account request failed");
  return data as T;
}
async function loadSession(): Promise<CustomerAccountSession | null> {
  const response = await fetch("/api/account/session", { cache: "no-store", credentials: "same-origin" });
  if (response.status === 401) return null;
  return await parseResponse<CustomerAccountSession>(response);
}
async function submit<T = unknown>(path: string, body?: unknown): Promise<T> {
  return parseResponse(await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

export function CustomerAccountProvider({ children, initialSession }: { children: ReactNode; initialSession?: CustomerAccountSession }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>(() => initialSession ? { status: "signed_in", session: initialSession } : { status: "loading", session: null });
  const refresh = useCallback(async () => {
    try {
      const session = await loadSession();
      setState(session ? { status: "signed_in", session } : { status: "signed_out", session: null });
    } catch (error) {
      setState({ status: "error", session: null, message: error instanceof Error ? error.message : "Account request failed" });
    }
  }, []);
  useEffect(() => { if (!initialSession) void refresh(); }, [initialSession, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await submit<CustomerAccountSession>("/api/account/login", { email, password });
    setState({ status: "signed_in", session });
  }, []);
  const register = useCallback(async (name: string, email: string, password: string) => {
    const session = await submit<CustomerAccountSession>("/api/account/register", { name, email, password });
    setState({ status: "signed_in", session });
  }, []);
  const logout = useCallback(async () => {
    try {
      const result = await submit<{ serverSessionRevoked?: boolean }>("/api/account/logout");
      if (!result.serverSessionRevoked) throw new Error("Signed out on this device, but the account service did not confirm session revocation. Retry when online.");
    } finally {
      queryClient.removeQueries({ queryKey: ["customer-account"] });
      setState({ status: "signed_out", session: null });
    }
  }, [queryClient]);
  const value = useMemo(() => ({ ...state, refresh, login, register, logout }), [state, refresh, login, register, logout]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCustomerAccount() {
  const context = useContext(Context);
  if (!context) throw new Error("useCustomerAccount must be used within CustomerAccountProvider");
  return context;
}
```

## `src/components/account/AccountForm.tsx`

```typescript
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
```

## `src/components/account/AccountDashboard.tsx`

```typescript
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
    <section className="space-y-5 px-4 py-6">
      <header><p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Account</p><h1 className="mt-1 font-display text-3xl text-ink">Welcome, {user.name}</h1><p className="mt-1 text-sm text-ink-muted">{user.email}</p></header>
      <article className="rounded-2xl border border-gold/30 bg-[#1A1A1A] p-5">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-gold">Wallet balance</p>
        {wallet?.status === "ready" ? <p className="my-3 text-3xl font-bold text-ink">{formatMoney(wallet.balanceMinor / 100, wallet.currency)}</p> : <p className="my-3 text-sm text-ink-muted">Wallet setup is pending. No spendable balance is available yet.</p>}
        <div className="flex gap-3"><button disabled className="min-h-11 flex-1 rounded-xl bg-gold px-3 font-semibold text-[#111111] opacity-50">Deposit · Coming soon</button><button disabled className="min-h-11 flex-1 rounded-xl border border-gold/30 px-3 font-semibold text-gold opacity-50">Withdraw · Coming soon</button></div>
      </article>
      {logoutWarning && <p role="alert" className="text-sm text-danger-bright">{logoutWarning}</p>}
      <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-xl border border-gold/20 px-4 text-sm text-ink-muted">Sign out</button>
    </section>
  );
}
```

## `src/app/login/page.tsx`

```typescript
import Link from "next/link";
import { AccountForm } from "@/components/account/AccountForm";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";

export default function LoginPage() {
  return <CustomerAccountProvider><div className="space-y-4 px-4 py-10"><AccountForm mode="login" /><p className="text-center text-sm text-ink-muted">New here? <Link className="text-gold underline" href="/signup">Create an account</Link></p></div></CustomerAccountProvider>;
}
```

## `src/app/signup/page.tsx`

```typescript
import Link from "next/link";
import { AccountForm } from "@/components/account/AccountForm";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";

export default function SignupPage() {
  return <CustomerAccountProvider><div className="space-y-4 px-4 py-10"><AccountForm mode="signup" /><p className="text-center text-sm text-ink-muted">Already have an account? <Link className="text-gold underline" href="/login">Sign in</Link></p></div></CustomerAccountProvider>;
}
```

## `src/app/dashboard/page.tsx`

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerAccountProvider } from "@/components/account/CustomerAccountContext";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { callWordPressCustomer, CUSTOMER_SESSION_COOKIE, parseAccountSession } from "@/lib/customer-account-proxy";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) redirect("/login");

  let upstream: unknown;
  try {
    upstream = await callWordPressCustomer("session", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    if ((error as { status?: number })?.status === 401) redirect("/login");
    return <div role="alert" className="px-4 py-12 text-center text-ink-muted">Your account service is temporarily unavailable. Please retry shortly.</div>;
  }

  const session = parseAccountSession(upstream);
  if (!session) return <div role="alert" className="px-4 py-12 text-center text-ink-muted">Wallet profile is not available yet. Please retry shortly.</div>;

  return <CustomerAccountProvider initialSession={session}><AccountDashboard /></CustomerAccountProvider>;
}
```
