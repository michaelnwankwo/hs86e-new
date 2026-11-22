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
import { emailVerificationRequired } from "@/lib/env";

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
    }) as { sessionToken?: unknown; user?: unknown; wallet?: unknown; pendingVerification?: unknown } | null;
    /**
     * Flag-gated email activation flow. When verification is required and
     * WordPress answers with pendingVerification: true (no usable session yet),
     * acknowledge the signup WITHOUT setting a session cookie — the client
     * shows the "Check your inbox to activate" panel instead of routing to the
     * dashboard. When the flag is unset/false this branch never runs and
     * existing behaviour is byte-for-byte unchanged.
     */
    if (emailVerificationRequired() && result?.pendingVerification === true) {
      return NextResponse.json({ ok: true, pendingVerification: true }, { status: 201, headers: noStoreHeaders() });
    }
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