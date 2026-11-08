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

/**
 * Purge every client-side session/account artifact. httpOnly cookies are
 * cleared by the /api/account/logout route — this covers everything JS can
 * reach. The device wallet and scan identity are PRESERVED on purpose.
 */
const STORAGE_PRESERVE = new Set([
  "hs86e_saved_tickets",
  "hs86e_wallet_v1",
  "hs86e_active_ticket",
  "hs86e_device_id",
]);
export const SIGNOUT_SIGNAL_KEY = "hs86e:signout-at";

function purgeClientSessionArtifacts() {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && !STORAGE_PRESERVE.has(key)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
    window.sessionStorage.clear();
    window.localStorage.setItem(SIGNOUT_SIGNAL_KEY, String(Date.now()));
    if ("caches" in window) {
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => /(^|-)(pages|default|documents?)(-|$)/i.test(key) || key.includes("pages"))
            .map((key) => caches.delete(key)),
        ),
      ).catch(() => undefined);
    }
  } catch {
    // Storage unavailable (private mode); navigation still proceeds.
  }
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

  // Another tab signed out: drop this tab's cached session immediately.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIGNOUT_SIGNAL_KEY) {
        queryClient.clear();
        setState({ status: "signed_out", session: null });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

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
      queryClient.clear();
      purgeClientSessionArtifacts();
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