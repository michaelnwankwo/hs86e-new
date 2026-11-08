import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AccountProxyError,
  callWordPressCustomer,
  CUSTOMER_SESSION_COOKIE,
  noStoreHeaders,
} from "@/lib/customer-account-proxy";

/**
 * Sign-out must NEVER leave the browser holding a usable session cookie.
 * Mismatched Origin -> 403 (cookie untouched). Missing Origin (WebViews):
 * allowed — worst case is a forced logout, never a data exposure.
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
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

const COOKIE_CLEAR = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

/** Expire every auth cookie name that can exist on THIS origin. WP-domain cookies die via the backend DELETE. */
const LEGACY_COOKIE_NAMES = ["hs86e_customer_session", "hs86e_session", "wp_jwt_auth", "auth_token"];

export async function POST(request: Request) {
  if (!signOutOriginOk(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jar = await cookies();
  const token = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  let revoked = !token;

  if (token) {
    try {
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
  for (const name of LEGACY_COOKIE_NAMES) { response.cookies.set(name, "", COOKIE_CLEAR); }
  return response;
}