import { CANCELLED_STATUSES } from "@/lib/checkout-status";
import {
  CheckoutSuccessGate,
  PaymentCancelledPanel,
} from "@/components/ticketing/CheckoutSuccessGate";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    order?: string;
    key?: string;
    email?: string;
    status?: string;
    tx_ref?: string;
    transaction_id?: string;
  }>;
}) {
  const q = await searchParams;
  // Gateways append status / tx_ref / transaction_id on redirect. A terminal
  // failure status short-circuits to the retry screen BEFORE any wallet
  // lookup or pass rendering; everything else is settled server-side by the
  // gate via /api/checkout/verify.
  const status = (q.status ?? "").toLowerCase();
  if (CANCELLED_STATUSES.has(status)) {
    return <PaymentCancelledPanel />;
  }
  return (
    <div className="px-4 py-6">
      <CheckoutSuccessGate
        order={q.order ?? ""}
        orderKey={q.key}
        email={q.email}
        initialStatus={status}
      />
    </div>
  );
}
