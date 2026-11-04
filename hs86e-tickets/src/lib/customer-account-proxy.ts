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
      ? "Incorrect email or password. Please try again."
      : response.status === 403
        ? "Sign-in was blocked. Refresh the page and try again."
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