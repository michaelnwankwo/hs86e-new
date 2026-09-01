"use client";

import { useState } from "react";
import { Delete, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { DEMO_PIN_HINT } from "@/lib/constants";

export function StaffPinGate({
  onUnlocked,
  demoHint,
}: {
  onUnlocked: () => void;
  demoHint?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function press(digit: string) {
    setError(null);
    setPin((current) => (current.length >= 8 ? current : current + digit));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scan/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Incorrect PIN");
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect PIN");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      <div className="flex flex-col items-center">
        <h1 className="font-display text-3xl text-ink">Door staff</h1>
        <p className="mt-2 text-center text-sm text-ink-muted">
          Enter the staff PIN. WordPress credentials never leave the server.
        </p>
      </div>
      <div className="mt-8 flex justify-center gap-2" aria-hidden>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-gold-champagne" : "bg-gold/20"}`}
          />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
          if (key === "") return <span key="blank" />;
          if (key === "del") {
            return (
              <button
                key="del"
                type="button"
                className="flex min-h-14 items-center justify-center rounded-xl border border-gold/20 text-gold"
                onClick={() => setPin((v) => v.slice(0, -1))}
                aria-label="Delete"
              >
                <Delete className="h-5 w-5" />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              className="min-h-14 rounded-xl border border-gold/20 bg-surface-raised text-xl font-semibold text-ink"
              onClick={() => press(key)}
            >
              {key}
            </button>
          );
        })}
      </div>
      {error ? (
        <StatusBanner tone="danger" className="mt-4">
          {error}
        </StatusBanner>
      ) : null}
      {demoHint ? (
        <p className="mt-4 text-center text-xs text-ink-dim">Demo PIN {DEMO_PIN_HINT}</p>
      ) : null}
      <Button className="mt-5" variant="primary" block disabled={busy || pin.length < 4} onClick={() => void submit()}>
        <Fingerprint className="h-4 w-4" />
        {busy ? "Unlocking…" : "Unlock scanner"}
      </Button>
    </div>
  );
}
