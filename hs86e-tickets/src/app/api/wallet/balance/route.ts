import { NextResponse } from "next/server";
import { getEnvSafe, walletEnabled } from "@/lib/env";
import { requireAccountSession, sessionUserId } from "@/lib/account-session";
import { getOrCreateWallet } from "@/lib/wallet/store";
import { minorToMajor } from "@/lib/wallet/money";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAccountSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!walletEnabled()) {
    return NextResponse.json({ walletEnabled: false, balanceMinor: 0, currency: "NGN" }, { headers: { "Cache-Control": "no-store" } });
  }
  const id = sessionUserId(auth.session);
  if (!id) return NextResponse.json({ error: "Invalid account session" }, { status: 401 });

  try {
    const w = await getOrCreateWallet(id);
    return NextResponse.json({
      walletEnabled: true,
      frozen: getEnvSafe().WALLET_FREEZE === true,
      currency: w.currency,
      availableMinor: Math.max(0, w.available_minor - w.pending_out_minor),
      pendingOutMinor: w.pending_out_minor,
      availableNGN: minorToMajor(Math.max(0, w.available_minor - w.pending_out_minor)),
      status: w.status,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[hs86e] wallet balance failed:", err);
    return NextResponse.json({ error: "Wallet balance unavailable" }, { status: 503 });
  }
}
