"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IssuingWallet } from "@/components/ticketing/IssuingWallet";
import { CANCELLED_STATUSES, SETTLED_STATUSES } from "@/lib/checkout-status";

/**
 * Payment-cancellation guard for /checkout/success.
 *
 * Gateway redirects (Flutterwave/Stripe) can land here with a terminal
 * failure status — or with no status at all while the order is still
 * "pending". Pass assets must only render after the SERVER confirms the
 * order is settled; a cancelled/failed payment gets the retry screen and
 * never touches IssuingWallet (so nothing is minted or saved client-side).
 */

export function PaymentCancelledPanel({
  title = "Payment cancelled",
  message = "Your payment was not completed and the order is still pending — no pass was issued.",
  showRefresh = false,
}: {
  title?: string;
  message?: string;
  showRefresh?: boolean;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="font-display text-3xl text-ink">{title}</h1>
      <p className="mt-3 text-sm text-ink-muted">{message}</p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {showRefresh ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gold/30 px-6 text-sm font-semibold text-gold"
          >
            Check again
          </button>
        ) : null}
        <Link
          href="/events"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gold px-6 text-sm font-bold uppercase tracking-wider text-[#0B0E14]"
        >
          Retry Payment
        </Link>
      </div>
    </div>
  );
}

type Verdict = "confirming" | "settled" | "cancelled" | "timeout";

export function CheckoutSuccessGate({
  order,
  orderKey,
  email,
  initialStatus = "",
}: {
  order: string;
  orderKey?: string;
  email?: string;
  initialStatus?: string;
}) {
  const [verdict, setVerdict] = useState<Verdict>(() => {
    const s = initialStatus.toLowerCase();
    if (CANCELLED_STATUSES.has(s)) return "cancelled";
    if (SETTLED_STATUSES.has(s)) return "settled";
    if (!order || !orderKey) return "settled"; // no order ref → wallet's own lookup UX applies
    return "confirming";
  });

  // Server-side settlement check — poll /api/checkout/verify until the order
  // leaves "pending" (webhook latency) or the retry budget is spent.
  useEffect(() => {
    if (verdict !== "confirming") return;
    let stop = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/checkout/verify?order=${encodeURIComponent(order)}&key=${encodeURIComponent(orderKey ?? "")}`,
          { cache: "no-store" },
        );
        if (res.status === 404) {
          if (!stop) setVerdict("cancelled");
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { orderStatus?: string };
          const st = String(data.orderStatus || "").toLowerCase();
          if (stop) return;
          if (SETTLED_STATUSES.has(st)) return setVerdict("settled");
          if (CANCELLED_STATUSES.has(st)) return setVerdict("cancelled");
        }
      } catch {
        // network blip — fall through to retry
      }
      if (stop) return;
      tries += 1;
      if (tries >= 8) return setVerdict("timeout");
      timer = setTimeout(poll, 2500);
    };

    poll();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [verdict, order, orderKey]);

  if (verdict === "cancelled") return <PaymentCancelledPanel />;

  if (verdict === "timeout") {
    return (
      <PaymentCancelledPanel
        title="Still confirming your payment"
        message="The payment provider has not settled this order yet. If you just paid, check again in a few seconds — otherwise retry the payment."
        showRefresh
      />
    );
  }

  if (verdict === "confirming") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-ink">Confirming payment…</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Waiting for the payment provider to settle this order. Your pass
          appears the moment it clears.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl text-ink">You&apos;re on the list</h1>
        <p className="mt-2 max-w-md mx-auto text-sm text-ink-muted">
          Your QR pass is below. Save it to this device — it also lives in Wallet.
        </p>
      </div>
      <IssuingWallet order={order} orderKey={orderKey} email={email} />
    </>
  );
}
