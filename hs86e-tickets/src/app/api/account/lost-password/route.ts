import { NextResponse } from "next/server";
import { getEnvSafe } from "@/lib/env";

/** Redirect to WordPress core's rate-limited native password-recovery form. */
export async function GET() {
  const base = getEnvSafe().WP_BASE_URL;
  if (!base) {
    return NextResponse.json(
      { error: "Password recovery is not configured. Contact support for help." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const wordpress = new URL(`${base.replace(/\/+$/, "")}/`);
    const reset = new URL("wp-login.php?action=lostpassword", wordpress);
    return NextResponse.redirect(reset, {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Password recovery is temporarily unavailable. Try again later." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
