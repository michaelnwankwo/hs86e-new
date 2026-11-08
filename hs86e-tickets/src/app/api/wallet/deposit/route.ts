import { NextResponse } from "next/server";
import { z } from "zod";
import axios from "axios";
import { appUrl, getEnv, walletEnabled, walletFrozen } from "@/lib/env";
import { requireAccountSession, sessionUserId } from "@/lib/account-session";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_DEPOSIT_MINOR, MIN_DEPOSIT_MINOR } from "@/lib/wallet/money";
import { mintWalletRef } from "@/lib/wallet/idempotency";
import { createDepositIntent } from "@/lib/wallet/store";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  amountMinor: z.number().int().min(MIN_DEPOSIT_MINOR).max(MAX_DEPOSIT_MINOR),
});

export async function POST(request: Request) {
  const auth = await requireAccountSession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!walletEnabled()) return NextResponse.json({ error: "Wallet is not enabled yet" }, { status: 403 });
  if (walletFrozen()) return NextResponse.json({ error: "Wallet is frozen for maintenance" }, { status: 423 });

  const limited = rateLimit(`wallet:deposit:${auth.session.user.id}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    const retryAfter = Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000));
    return NextResponse.json({ error: "Too many deposit attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const id = sessionUserId(auth.session);
  if (!id) return NextResponse.json({ error: "Invalid account session" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Amount must be between ₦100 and ₦5,000,000", issues: parsed.error.issues.map(i => i.message) }, { status: 400 });
  }

  const ref = mintWalletRef("WLT-DEPOSIT");
  try {
    const intent = await createDepositIntent(id, parsed.data.amountMinor, ref);
    if (!intent.ok) {
      return NextResponse.json({ error: intent.error ?? "Could not create deposit intent" }, { status: 409 });
    }

    const origin = appUrl();
    const secret = getEnv().FLW_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Deposit provider is not configured" }, { status: 503 });
    }
    const { data } = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: ref,
        amount: parsed.data.amountMinor / 100,
        currency: "NGN",
        redirect_url: `${origin}/dashboard?wallet=deposit&ref=${encodeURIComponent(ref)}`,
        customer: {
          email: auth.session.user.email,
          name: auth.session.user.name,
        },
        customizations: {
          title: "HS86E Wallet Top-up",
          description: "Add money to your HS86E Wallet",
          logo: `${origin}/logohs86e.jpg`,
        },
        meta: { wallet: true, intent_id: intent.intentId, user_id: id },
      },
      { headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, timeout: 18_000 },
    );

    const link = data?.data?.link as string | undefined;
    if (!link) throw new Error("Flutterwave did not return a payment link");
    return NextResponse.json({ ok: true, ref, url: link, expiresAt: intent.expiresAt });
  } catch (err) {
    console.error("[hs86e] wallet deposit intent failed:", err);
    return NextResponse.json({ error: "Could not start deposit. Please try again." }, { status: 502 });
  }
}
