import { NextResponse } from "next/server";
import { getEnvIssues, getEnvSafe, hasFooEventsAuth, hasScanSecret, hasWooCommerce, isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getEnvSafe();
  const configIssues = getEnvIssues();
  return NextResponse.json({
    ok: true,
    configOk: configIssues === null,
    configIssues,
    brand: "HS86E",
    demo: isDemoMode(),
    wordpress: Boolean(env.WP_BASE_URL),
    woocommerce: hasWooCommerce(),
    fooevents: hasFooEventsAuth(),
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    flutterwave: Boolean(env.FLW_SECRET_KEY),
    scanAuth: hasScanSecret(),
  });
}
