import Stripe from "stripe";
import { appUrl, getEnv } from "@/lib/env";

export function getStripe() {
  const key = getEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
}

export async function createStripeCheckoutSession(input: {
  orderId: number;
  orderKey: string;
  email: string;
  name: string;
  amount: number;
  currency: string;
  description: string;
}) {
  const stripe = getStripe();
  const origin = appUrl();
  const unitAmount = Math.round(input.amount * (input.currency.toUpperCase() === "NGN" ? 100 : 100));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: String(input.orderId),
    metadata: {
      order_id: String(input.orderId),
      order_key: input.orderKey,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: unitAmount,
          product_data: {
            name: input.description,
            description: `HS86E order #${input.orderId}`,
          },
        },
      },
    ],
    success_url: `${origin}/checkout/success?order=${input.orderId}&key=${input.orderKey}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancelled?order=${input.orderId}`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { id: session.id, url: session.url };
}

export function constructStripeEvent(rawBody: string, signature: string) {
  const secret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
