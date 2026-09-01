import Link from "next/link";
import { StatusBanner } from "@/components/ui/StatusBanner";

export default function CheckoutCancelledPage() {
  return (
    <div className="px-4 py-10 text-center">
      <h1 className="font-display text-3xl text-ink">Payment cancelled</h1>
      <div className="mx-auto mt-4 max-w-md">
        <StatusBanner tone="warn">
          No ticket was issued. The pending order remains on hold and will auto-cancel with WooCommerce
          stock hold.
        </StatusBanner>
      </div>
      <Link
        href="/events"
        className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-emerald px-5 text-sm font-semibold"
      >
        Return to events
      </Link>
    </div>
  );
}
