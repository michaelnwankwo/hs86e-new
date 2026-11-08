import { cookies } from "next/headers";
import {
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  parseAccountSession,
  type AccountSession,
} from "@/lib/customer-account-proxy";

export type AccountSessionResult =
  | { ok: true; session: AccountSession }
  | { ok: false; status: 401 | 502 | 503; error: string };

/**
 * Shared server-side authentication for account-scoped API routes.
 * Returns a discriminated union — never throws — so handlers can map failures
 * to the right HTTP status.
 */
export async function requireAccountSession(): Promise<AccountSessionResult> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!token) return { ok: false, status: 401, error: "Sign in required" };

  try {
    const upstream = await callWordPressCustomer("session", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const session = parseAccountSession(upstream);
    if (!session) return { ok: false, status: 502, error: "Account service returned invalid profile data" };
    return { ok: true, session };
  } catch (error) {
    const status = (error as { status?: number })?.status;
    return status === 401
      ? { ok: false, status: 401, error: "Session expired" }
      : { ok: false, status: 503, error: "Account service is temporarily unavailable" };
  }
}

export function sessionUserId(session: AccountSession): number {
  const id = Number(session.user.id);
  return Number.isSafeInteger(id) ? id : 0;
}
