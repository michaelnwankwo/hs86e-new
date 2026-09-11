import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { completeDemoOrder } from "@/services/demo/store";
import { verifyFlutterwaveHash, verifyFlutterwaveTransaction } from "@/services/payments/flutterwave";
import { completeOrder, getOrder } from "@/services/wp/woocommerce";
import { ensureIssuedTickets } from "@/services/tickets/issue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error("[hs86e] /api/webhooks/flutterwave recovered from unexpected failure:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

async function handlePost(request: Request) {
  const hash = request.headers.get("verif-hash");
  if (!verifyFlutterwaveHash(hash)) {
    return NextResponse.json({ error: "Invalid verif-hash" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    data?: { id?: number; tx_ref?: string; amount?: number; currency?: string; status?: string };
    event?: string;
  } | null;

  const txId = body?.data?.id;
  if (!txId) {
    return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  }

  const verified = await verifyFlutterwaveTransaction(txId);
  if (!verified || String(verified.status).toLowerCase() !== "successful") {
    return NextResponse.json({ error: "Transaction not successful" }, { status: 400 });
  }

  const orderId = Number(verified.meta?.order_id || String(verified.tx_ref).split("-")[1]);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Unable to resolve order" }, { status: 400 });
  }

  if (isDemoMode()) {
    completeDemoOrder(orderId, `flw_${verified.id}`);
    return NextResponse.json({ received: true, demo: true });
  }

  const order = await getOrder(orderId);
  const expected = Number(order.total);
  if (Number.isFinite(expected) && Math.abs(expected - Number(verified.amount)) > 0.5) {
    return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
  }

  await completeOrder(orderId, `flw_${verified.id}`);
  return NextResponse.json({ received: true });
}
