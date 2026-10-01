import { NextResponse } from "next/server";
import { hasWooCommerce, isDemoMode } from "@/lib/env";
import { getDemoOrderByKey } from "@/services/demo/store";
import { getOrder } from "@/services/wp/woocommerce";

export const dynamic = "force-dynamic";

/**
 * Authoritative order-settlement probe for /checkout/success.
 * Returns the live order status WITHOUT minting or leaking ticket assets.
 * Requires the unguessable order key so status is not enumerable.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = Number((searchParams.get("order") || "").trim());
  const key = (searchParams.get("key") || "").trim();
  if (!Number.isFinite(orderId) || orderId <= 0 || !key) {
    return NextResponse.json({ error: "Missing order reference" }, { status: 400 });
  }

  try {
    if (isDemoMode()) {
      const order = getDemoOrderByKey(orderId, key);
      if (!order) {
        return NextResponse.json({ orderStatus: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ orderStatus: order.status });
    }

    if (!hasWooCommerce()) {
      return NextResponse.json({ error: "Catalog not configured" }, { status: 503 });
    }

    const order = await getOrder(orderId);
    if (String(order.order_key || "") !== key) {
      return NextResponse.json({ orderStatus: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ orderStatus: String(order.status || "pending") });
  } catch {
    // Upstream catalog hiccup — let the gate retry instead of failing hard.
    return NextResponse.json({ orderStatus: "unknown" });
  }
}
