import axios from "axios";
import { appUrl, getEnv } from "@/lib/env";

const FLW_API = "https://api.flutterwave.com/v3";

export async function createFlutterwavePayment(input: {
  orderId: number;
  orderKey: string;
  email: string;
  name: string;
  phone: string;
  amount: number;
  currency: string;
  description: string;
}) {
  const secret = getEnv().FLW_SECRET_KEY;
  if (!secret) throw new Error("FLW_SECRET_KEY is not configured");
  const origin = appUrl();
  const txRef = `hs86e-${input.orderId}-${input.orderKey}`;

  const { data } = await axios.post(
    `${FLW_API}/payments`,
    {
      tx_ref: txRef,
      amount: input.amount,
      currency: input.currency,
      redirect_url: `${origin}/checkout/success?order=${input.orderId}&key=${input.orderKey}`,
      customer: {
        email: input.email,
        name: input.name,
        phonenumber: input.phone,
      },
      customizations: {
        title: "HS86E Entertainment",
        description: input.description,
        logo: `${origin}/logohs86e.jpg`,
      },
      meta: {
        order_id: input.orderId,
        order_key: input.orderKey,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      timeout: 18_000,
    },
  );

  const link = data?.data?.link as string | undefined;
  if (!link) throw new Error("Flutterwave did not return a payment link");
  return { txRef, url: link };
}

export function verifyFlutterwaveHash(headerHash: string | null) {
  const expected = getEnv().FLW_WEBHOOK_HASH;
  if (!expected) return false;
  return Boolean(headerHash) && headerHash === expected;
}

export async function verifyFlutterwaveTransaction(id: string | number) {
  const secret = getEnv().FLW_SECRET_KEY;
  if (!secret) throw new Error("FLW_SECRET_KEY is not configured");
  const { data } = await axios.get(`${FLW_API}/transactions/${id}/verify`, {
    headers: { Authorization: `Bearer ${secret}` },
    timeout: 18_000,
  });
  return data?.data as {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    meta?: { order_id?: string | number; order_key?: string };
  };
}
