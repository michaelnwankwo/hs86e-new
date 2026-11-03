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