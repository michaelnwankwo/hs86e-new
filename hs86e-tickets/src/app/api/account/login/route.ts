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
  if (!sameOriginRequest(request)) return NextResponse.json({ error: "We could not verify this sign-in request. Refresh the page and try again." }, { status: 403 });
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