import { NextResponse } from "next/server";
import { getEnv, hasFooEventsAuth, hasWooCommerce, isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getEnv();
  return NextResponse.json({
    ok: true,
    brand: "HS86E",
    demo: isDemoMode(),
    wordpress: Boolean(env.WP_BASE_URL),
    woocommerce: hasWooCommerce(),
    fooevents: hasFooEventsAuth(),
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    flutterwave: Boolean(env.FLW_SECRET_KEY),
  });
}
