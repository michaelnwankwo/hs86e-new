"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

function SimulateInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const order = params.get("order");
    const key = params.get("key");
    if (!order || !key) {
      setError("Missing order reference");
      setBusy(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/demo/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: Number(order), orderKey: key }),
      });
      const data = (await res.json()) as { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error || "Demo settlement failed");
        setBusy(false);
        return;
      }
      router.replace(`/checkout/success?order=${order}&key=${key}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="px-4 py-16 text-center">
      {error ? (
        <div className="mx-auto max-w-md">
          <StatusBanner tone="danger">{error}</StatusBanner>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Confirming payment and minting your pass.</p>
      )}
      <LoadingOverlay isLoading={busy && !error} />
    </div>
  );
}

export default function SimulateCheckoutPage() {
  return (
    <Suspense fallback={<LoadingOverlay isLoading />}>
      <SimulateInner />
    </Suspense>
  );
}
