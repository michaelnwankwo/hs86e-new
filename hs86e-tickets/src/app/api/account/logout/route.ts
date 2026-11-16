import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AccountProxyError,
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  noStoreHeaders,
  sameOriginRequest,
} from "@/lib/customer-account-proxy";

/**
 * Sign-out must NEVER leave the browser holding a usable session cookie.
 *
 * Same-origin policy is enforced the same way as login when an Origin header
 * is present (mismatch -> 403, cookie untouched). When no Origin header is
 * available (some WebViews/embedded shells strip it), the request is allowed:
 * worst case is a forced logout, which leaks nothing. CSRF-style silent
 * logout is a nuisance, never a data exposure — availability of sign-out
 * wins over strictness here.
 */
function signOutOriginOk(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    const fetchSite = request.headers.get("sec-fetch-site");
    return (
      fetchSite === null ||
      fetchSite === "same-origin" ||
      fetchSite === "same-site" ||
      fetchSite === "none"
    );
  }
  return sameOriginRequest(request);
}

const COOKIE_CLEAR = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

/**
 * Legacy/auth cookie names this app has used across iterations, plus the
 * typical WP JWT names. Anything the browser might still hold under a `path=/`
 * scope gets expired defensively. NOTE: `wordpress_logged_in_*` /
 * `wp_woocommerce_session_*` cookies are scoped to the WordPress domain
 * (hotsince86ent.com), not to this Netlify app — they are invalidated by the
 * backend DELETE call above, never by Set-Cookie here. We clear the exact
 * names that can exist on THIS origin.
 */
const LEGACY_COOKIE_NAMES = [
  "hs86e_customer_session",
  "hs86e_session",
  "wp_jwt_auth",
  "auth_token",
];

export async function POST(request: Request) {
  if (!signOutOriginOk(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  let revoked = !token;

  if (token) {
    try {
      // Backend termination: revoke the WP session server-side. Best-effort —
      // the browser cookie is cleared regardless of the outcome.
      await callWordPressCustomer("session", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      revoked = true;
    } catch (error) {
      revoked = error instanceof AccountProxyError && error.status === 401;
    }
  }

  const response = NextResponse.json(
    { ok: true, serverSessionRevoked: revoked },
    { headers: noStoreHeaders() },
  );
  // Belt and braces: clear the cookie even if anything above threw.
  for (const name of LEGACY_COOKIE_NAMES) {
    response.cookies.set(name, "", COOKIE_CLEAR);
  }
  return response;
}
