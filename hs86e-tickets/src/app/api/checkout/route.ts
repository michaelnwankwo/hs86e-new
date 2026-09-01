import { NextResponse } from "next/server";
import { z } from "zod";
import { appUrl, hasFlutterwave, hasStripe, hasWooCommerce, isDemoMode } from "@/lib/env";
import { getEvent } from "@/services/catalog";
import { createDemoOrder } from "@/services/demo/store";
import { completeOrder, createPendingOrder } from "@/services/wp/woocommerce";
import { ensureIssuedTickets } from "@/services/tickets/issue";
import { createStripeCheckoutSession } from "@/services/payments/stripe";
import { createFlutterwavePayment } from "@/services/payments/flutterwave";

const bodySchema = z.object({
  eventSlug: z.string().min(1),
  variationId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(24),
  gateway: z.enum(["stripe", "flutterwave"]),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const event = await getEvent(input.eventSlug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const variation = event.variations.find((v) => v.id === input.variationId);
  if (!variation) {
    return NextResponse.json({ error: "Ticket tier not found" }, { status: 404 });
  }
  if (variation.stock !== null && variation.stock < input.quantity) {
    return NextResponse.json({ error: "Not enough tickets remaining" }, { status: 409 });
  }

  const amount = variation.price * input.quantity;
  const description = `${event.name} · ${variation.name} × ${input.quantity}`;

  if (!isDemoMode() && !hasWooCommerce()) {
    return NextResponse.json(
      {
        error:
          "WordPress catalog is live, but WooCommerce REST keys are not in .env.local yet. Add WC_CONSUMER_KEY and WC_CONSUMER_SECRET to create real orders.",
      },
      { status: 503 },
    );
  }

  if (isDemoMode()) {
    const order = createDemoOrder({
      email: input.email,
      name: input.name,
      phone: input.phone,
      eventSlug: event.slug,
      variationId: variation.id,
      quantity: input.quantity,
      gateway: input.gateway,
    });
    const redirectUrl = `${appUrl()}/checkout/simulate?order=${order.id}&key=${order.orderKey}&gateway=${input.gateway}`;
    return NextResponse.json({
      orderId: order.id,
      orderKey: order.orderKey,
      gateway: input.gateway,
      redirectUrl,
      demo: true,
    });
  }

  const order = await createPendingOrder({
    event,
    variationId: variation.id,
    quantity: input.quantity,
    name: input.name,
    email: input.email,
    phone: input.phone,
    gateway: input.gateway,
  });

  if (amount === 0) {
    await completeOrder(order.id, `free_${order.id}`);
    await ensureIssuedTickets(order.id);
    return NextResponse.json({
      orderId: order.id,
      orderKey: order.orderKey,
      gateway: input.gateway,
      redirectUrl: `${appUrl()}/checkout/success?order=${order.id}&key=${order.orderKey}`,
    });
  }

  if (input.gateway === "stripe") {
    if (!hasStripe()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }
    const session = await createStripeCheckoutSession({
      orderId: order.id,
      orderKey: order.orderKey,
      email: input.email,
      name: input.name,
      amount,
      currency: event.currency,
      description,
    });
    return NextResponse.json({
      orderId: order.id,
      orderKey: order.orderKey,
      gateway: "stripe",
      redirectUrl: session.url,
    });
  }

  if (!hasFlutterwave()) {
    return NextResponse.json({ error: "Flutterwave is not configured" }, { status: 503 });
  }
  const payment = await createFlutterwavePayment({
    orderId: order.id,
    orderKey: order.orderKey,
    email: input.email,
    name: input.name,
    phone: input.phone,
    amount,
    currency: event.currency,
    description,
  });
  return NextResponse.json({
    orderId: order.id,
    orderKey: order.orderKey,
    gateway: "flutterwave",
    redirectUrl: payment.url,
  });
}
