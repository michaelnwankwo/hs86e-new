import { z } from "zod";
import { getEnvSafe, emailVerificationRequired } from "@/lib/env";

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
  constructor(public readonly status: number, message: string, public readonly code?: string) {
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
    // WordPress may answer with { code: "email_unverified" } (403) when the
    // activation plugin blocks an unverified customer. Surface the code so the
    // login route can return the dedicated verify-your-email message — but
    // only when the Next.js flag is active.
    const wpCode = typeof body?.code === "string" ? body.code : undefined;
    const emailUnverified =
      response.status === 403 && wpCode === "email_unverified" && emailVerificationRequired();
    const message = emailUnverified
      ? "Confirm your email — we sent you a link."
      : response.status === 401
        ? "Incorrect email or password. Please try again."
        : response.status === 403
          ? "Sign-in was blocked. Refresh the page and try again."
        : response.status === 409
          ? "An account already uses that email"
          : response.status === 429
            ? "Too many attempts. Wait and try again"
            : "Account service could not complete the request";
    throw new AccountProxyError(response.status, message, emailUnverified ? "email_unverified" : wpCode);
  }
  return body;
}

export function validSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

/**
 * Same-origin guard for cookie-setting POST routes.
 *
 * The naive `new URL(request.url).origin` comparison breaks on Netlify: the
 * Next.js runtime may hand the function an internal URL (different scheme and
 * host than the public site), so the check rejected EVERY browser login —
 * login/register both returned 403 "We could not verify this sign-in request".
 *
 * Fix: compare the browser's Origin against the ORIGINAL request coordinates,
 * taken from the forwarding headers Netlify sets (x-forwarded-proto/host),
 * falling back to the Host header, then to request.url. Scheme must match when
 * determinable (https on Netlify); the host must always match. Cross-site POSTs
 * still carry the attacker's origin and are rejected.
 */
export function sameOriginRequest(request: Request) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return false;
  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }

  const stripDefaultPort = (host: string, proto?: string) =>
    host.replace(/:443$/, proto === "https" || proto === undefined ? "" : ":443").replace(/:80$/, proto === "http" || proto === undefined ? "" : ":80");

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase().replace(/:+$/, "") || undefined;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim().toLowerCase() || undefined;
  const hostHeader = request.headers.get("host")?.trim().toLowerCase() || undefined;
  const forwardedSsl = request.headers.get("x-forwarded-ssl")?.trim().toLowerCase();

  let url: URL | null = null;
  try {
    url = new URL(request.url);
  } catch {
    url = null;
  }
  const urlHost = url?.host?.toLowerCase() || undefined;
  const urlProto = url?.protocol ? url.protocol.replace(":", "").toLowerCase() : undefined;

  const host = forwardedHost ?? hostHeader ?? urlHost;
  const proto = forwardedProto ?? (forwardedSsl === "on" ? "https" : undefined) ?? urlProto;
  if (!host) return false;

  const originProto = origin.protocol.replace(":", "").toLowerCase();
  if (proto && originProto !== proto) return false;
  return stripDefaultPort(origin.host.toLowerCase(), proto ?? originProto) === stripDefaultPort(host, proto);
}

export function parseAccountSession(value: unknown): AccountSession | null {
  const parsed = accountSessionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function noStoreHeaders() {
  return { "Cache-Control": "private, no-store, max-age=0" };
}