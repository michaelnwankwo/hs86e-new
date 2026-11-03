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