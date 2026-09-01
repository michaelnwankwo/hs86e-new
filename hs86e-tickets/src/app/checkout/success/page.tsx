import { IssuingWallet } from "@/components/ticketing/IssuingWallet";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; key?: string; email?: string }>;
}) {
  const q = await searchParams;
  return (
    <div className="px-4 py-6">
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl text-ink">You&apos;re on the list</h1>
        <p className="mt-2 max-w-md mx-auto text-sm text-ink-muted">
          Your QR pass is below. Save it to this device — it also lives in Wallet.
        </p>
      </div>
      <IssuingWallet order={q.order ?? ""} orderKey={q.key} email={q.email} />
    </div>
  );
}
