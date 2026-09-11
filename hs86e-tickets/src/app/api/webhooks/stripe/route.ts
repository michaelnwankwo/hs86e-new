import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { completeDemoOrder } from "@/services/demo/store";
import { constructStripeEvent } from "@/services/payments/stripe";
import { completeOrder } from "@/services/wp/woocommerce";
import { ensureIssuedTickets } from "@/services/tickets/issue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error("[hs86e] /api/webhooks/stripe recovered from unexpected failure:", err);
    // 200-level acknowledgement is unsafe here: return 500 so Stripe retries.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handlePost(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const raw = await request.text();
  let event;
  try {
    event = constructStripeEvent(raw, signature);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 },
    );
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as {
    metadata?: { order_id?: string };
    amount_total?: number;
    currency?: string;
  };
  const orderId = Number(session.metadata?.order_id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Missing order metadata" }, { status: 400 });
  }

  if (isDemoMode()) {
    completeDemoOrder(orderId, event.id);
    return NextResponse.json({ received: true, demo: true });
  }

  await completeOrder(orderId, event.id);
  await ensureIssuedTickets(orderId);
  return NextResponse.json({ received: true });
}
