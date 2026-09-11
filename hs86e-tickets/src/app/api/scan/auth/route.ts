import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_RATE_MAX, AUTH_RATE_WINDOW_MS, STAFF_COOKIE } from "@/lib/constants";
import { signStaffToken, staffCookieOptions, verifyStaffPin } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  pin: z.string().min(4).max(12),
});

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = rateLimit(`scan-auth:${ip}`, AUTH_RATE_MAX, AUTH_RATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many PIN attempts. Wait and try again." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const ok = await verifyStaffPin(parsed.data.pin);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const token = await signStaffToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, token, staffCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, "", { ...staffCookieOptions(), maxAge: 0 });
  return response;
}
