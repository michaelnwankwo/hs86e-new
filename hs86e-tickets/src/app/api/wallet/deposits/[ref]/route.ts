import { NextResponse } from "next/server";
import { walletEnabled } from "@/lib/env";
import { requireAccountSession, sessionUserId } from "@/lib/account-session";
import { findDepositIntentByRef, findCompletedDepositByRef, getOrCreateWallet } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

/**
 * Status poll for a deposit intent owned by the signed-in customer.
 * Answers: pending | completed (+ receipt) | expired | failed | not found.
 */
export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const auth = await requireAccountSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!walletEnabled()) return NextResponse.json({ error: "Wallet is not enabled yet" }, { status: 403 });

  const id = sessionUserId(auth.session);
  if (!id) return NextResponse.json({ error: "Invalid account session" }, { status: 401 });

  const { ref } = await context.params;
  if (!/^WLT-DEPOSIT-[A-Z0-9]{6,40}$/.test(ref)) {
    return NextResponse.json({ error: "Invalid deposit reference" }, { status: 400 });
  }

  try {
    const intent = await findDepositIntentByRef(ref);
    if (!intent) return NextResponse.json({ error: "Deposit not found" }, { status: 404 });

    // Ownership check: intent's wallet must belong to this user.
    const w = await getOrCreateWallet(id);
    if (intent.wallet_id !== w.id) return NextResponse.json({ error: "Deposit not found" }, { status: 404 });

    if (intent.status === "completed") {
      const receipt = await findCompletedDepositByRef(ref);
      return NextResponse.json({
        ref,
        status: "completed",
        amountMinor: intent.amount_minor,
        gatewayRef: intent.gateway_ref,
        receiptId: receipt?.public_id ?? null,
        balanceAfterMinor: receipt?.balance_after_minor ?? null,
      });
    }
    if (intent.expires_at && new Date(intent.expires_at).getTime() < Date.now() && intent.status === "pending") {
      return NextResponse.json({ ref, status: "expired", amountMinor: intent.amount_minor });
    }
    return NextResponse.json({ ref, status: intent.status, amountMinor: intent.amount_minor });
  } catch (err) {
    console.error("[hs86e] deposit status failed:", err);
    return NextResponse.json({ error: "Wallet deposit lookup unavailable" }, { status: 503 });
  }
}
