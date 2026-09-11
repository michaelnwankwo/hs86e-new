import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_RATE_MAX, AUTH_RATE_WINDOW_MS, STAFF_COOKIE } from "@/lib/constants";
import { signStaffToken, staffCookieOptions, verifyStaffPin } from "@/lib/auth";
import { hasScanSecret } from "@/lib/env";
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

  // Fail closed with a clear JSON message when the signing secret is missing,
  // instead of throwing an opaque server error at the door.
  if (!hasScanSecret()) {
    return NextResponse.json(
      { error: "Scanner sign-in is not configured on the server. Set SCAN_JWT_SECRET (24+ characters)." },
      { status: 503 },
    );
  }

  const ok = await verifyStaffPin(parsed.data.pin);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  try {
    const token = await signStaffToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(STAFF_COOKIE, token, staffCookieOptions());
    return response;
  } catch (err) {
    console.error("[hs86e] Staff token signing failed:", err);
    return NextResponse.json(
      { error: "Scanner sign-in is temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, "", { ...staffCookieOptions(), maxAge: 0 });
  return response;
}
