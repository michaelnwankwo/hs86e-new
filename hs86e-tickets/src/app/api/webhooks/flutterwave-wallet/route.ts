import { NextResponse } from "next/server";
import { walletEnabled } from "@/lib/env";
import { verifyFlutterwaveHash, verifyFlutterwaveTransaction } from "@/services/payments/flutterwave";
import { findDepositIntentByRef, recordProviderEvent, settleDeposit, markProviderEvent } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

/**
 * Wallet deposit webhook. Security pipeline (in order):
 *  1. verif-hash compared with FLW_WEBHOOK_HASH (timing-safe),
 *  2. payload is NOT trusted — transaction is re-fetched from Flutterwave,
 *  3. amount/currency/status verified against server-side deposit intent,
 *  4. event persisted to provider_events inbox BEFORE ack (idempotent),
 *  5. settlement via atomic RPC (row lock, replay-safe).
 * Signature-failing events are recorded (unsigned) and dropped.
 */
export async function POST(request: Request) {
  const hash = request.headers.get("verif-hash");
  const signatureOk = verifyFlutterwaveHash(hash);

  const body = (await request.json().catch(() => null)) as {
    data?: { id?: number; tx_ref?: string; event?: string };
    event?: string;
  } | null;

  const txId = body?.data?.id;
  const candidateEventId = txId ? `flw-${txId}` : null;

  // Always inbox unknown-shape events when a candidate id exists — but only
  // when the signature is valid do we attempt settlement.
  if (!signatureOk) {
    if (candidateEventId) {
      try {
        await recordProviderEvent({ provider: "flutterwave", eventId: candidateEventId, signatureOk: false, payload: body ?? {} });
        await markProviderEvent(candidateEventId, "flutterwave", "ignored", "bad_signature");
      } catch {
        // inbox is best-effort on unsigned traffic
      }
    }
    return NextResponse.json({ error: "Invalid verif-hash" }, { status: 401 });
  }

  if (!txId) return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  const eventId = `flw-${txId}`;

  try {
    // 2. Persist-before-ack (idempotent insert).
    await recordProviderEvent({ provider: "flutterwave", eventId, signatureOk: true, payload: body ?? {} });

    // 3. Server re-fetch — never trust webhook body amounts.
    const verified = await verifyFlutterwaveTransaction(txId);
    const status = String(verified?.status ?? "").toLowerCase();
    const txRef = String(verified?.tx_ref ?? "");
    if (status !== "successful" || !txRef.startsWith("WLT-DEPOSIT-")) {
      await markProviderEvent(eventId, "flutterwave", "ignored", `status:${status}`);
      return NextResponse.json({ received: true, ignored: true });
    }

    const intent = await findDepositIntentByRef(txRef);
    if (!intent) {
      await markProviderEvent(eventId, "flutterwave", "failed", "intent_not_found");
      return NextResponse.json({ error: "Unknown deposit reference" }, { status: 404 });
    }

    // Amount/currency must match the intent — exact, integer kobo.
    const expectedKobo = Math.round(Number(verified.amount) * 100);
    const currencyOk = String(verified.currency ?? "").toUpperCase() === "NGN";
    if (!currencyOk || expectedKobo !== intent.amount_minor) {
      await markProviderEvent(eventId, "flutterwave", "failed", `mismatch:${expectedKobo}vs${intent.amount_minor}:${verified.currency}`);
      return NextResponse.json({ error: "Amount or currency mismatch" }, { status: 400 });
    }

    // 4. Settle (idempotent).
    if (!walletEnabled()) {
      // Webhook can arrive after launch freeze — record, don't move money.
      await markProviderEvent(eventId, "flutterwave", "ignored", "wallet_disabled");
      return NextResponse.json({ received: true, frozen: true });
    }
    const result = await settleDeposit(intent.id, `flw_${verified.id}`);
    if (!result.ok) {
      await markProviderEvent(eventId, "flutterwave", "failed", result.error ?? "settle_failed");
      return NextResponse.json({ error: result.error ?? "Settlement failed" }, { status: 409 });
    }
    await markProviderEvent(eventId, "flutterwave", "processed");
    return NextResponse.json({ received: true, ref: result.ref, duplicate: result.duplicate ?? false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[hs86e] wallet webhook failed:", message);
    try {
      await markProviderEvent(eventId, "flutterwave", "failed", message.slice(0, 200));
    } catch {
      // already acked-with-error above; sweep process retries via provider_events
    }
    return NextResponse.json({ error: "Wallet webhook processing failed" }, { status: 500 });
  }
}
