import { NextResponse } from "next/server";
import { z } from "zod";
import { walletEnabled, walletFrozen } from "@/lib/env";
import { requireAccountSession, sessionUserId } from "@/lib/account-session";
import { rateLimit } from "@/lib/rate-limit";
import { MIN_WITHDRAWAL_MINOR, withdrawalFeeMinor } from "@/lib/wallet/money";
import { mintWalletRef } from "@/lib/wallet/idempotency";
import { reserveWithdrawal } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

/**
 * Manual-approval withdrawal queue. Reserves funds immediately (double-entry
 * hold); ops reviews and pays externally (Flutterwave transfer in the
 * dashboard) then marks the request paid/reversed via an ops-only path.
 * Launch phase: no automated payouts — see Phase 4 gates before automating.
 */
const BodySchema = z.object({
  amountMinor: z.number().int().min(MIN_WITHDRAWAL_MINOR),
  bankCode: z.string().min(1).max(10),
  bankName: z.string().min(1).max(80),
  accountNumber: z.string().regex(/^\d{10}$/, "NUBAN must be 10 digits"),
  accountName: z.string().min(1).max(120),
});

export async function POST(request: Request) {
  const auth = await requireAccountSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!walletEnabled()) return NextResponse.json({ error: "Wallet is not enabled yet" }, { status: 403 });
  if (walletFrozen()) return NextResponse.json({ error: "Wallet is frozen for maintenance" }, { status: 423 });

  const limited = rateLimit(`wallet:withdraw:${auth.session.user.id}`, 5, 24 * 60 * 60 * 1000);
  if (!limited.ok) {
    const retryAfter = Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000));
    return NextResponse.json({ error: "Daily withdrawal request limit reached" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const id = sessionUserId(auth.session);
  if (!id) return NextResponse.json({ error: "Invalid account session" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid withdrawal request", issues: parsed.error.issues.map(i => i.message) }, { status: 400 });
  }

  const fee = withdrawalFeeMinor(parsed.data.amountMinor);
  const ref = mintWalletRef("WLT-WD");
  try {
    const reserved = await reserveWithdrawal({
      userId: id,
      amountMinor: parsed.data.amountMinor,
      feeMinor: fee,
      bankCode: parsed.data.bankCode,
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      accountName: parsed.data.accountName,
      ref,
    });
    if (!reserved.ok) {
      const status = reserved.error === "insufficient_funds" ? 409 : 400;
      return NextResponse.json({ error: reserved.error, availableMinor: reserved.availableMinor }, { status });
    }
    return NextResponse.json({
      ok: true,
      ref,
      netMinor: reserved.netMinor,
      feeMinor: reserved.feeMinor,
      status: "reserved",
      message: "Withdrawal queued for review. Funds are held and will be paid out or returned within 1–3 business days.",
    });
  } catch (err) {
    console.error("[hs86e] wallet withdrawal failed:", err);
    return NextResponse.json({ error: "Could not reserve withdrawal. Please try again." }, { status: 502 });
  }
}
