"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import type { EventProduct, PaymentGateway } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the attendee name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().min(7, "Enter a phone number"),
  quantity: z.coerce.number().int().min(1).max(10),
  variationId: z.string().min(1),
  gateway: z.enum(["stripe", "flutterwave"]),
});

export function BuyTicketForm({ event }: { event: EventProduct }) {
  const [variationId, setVariationId] = useState(event.variations[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gateway, setGateway] = useState<PaymentGateway>("flutterwave");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const variation = useMemo(
    () => event.variations.find((v) => v.id === variationId) ?? event.variations[0],
    [event.variations, variationId],
  );
  const total = (variation?.price ?? 0) * quantity;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({
      name,
      email,
      phone,
      quantity,
      variationId,
      gateway,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check the form");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: event.slug,
          ...parsed.data,
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || "Checkout failed");
      }
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="gold-border space-y-4 rounded-2xl bg-surface-raised p-4">
      <LoadingOverlay isLoading={busy} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Ticket tier</p>
        <div className="mt-2 grid gap-2">
          {event.variations.map((item) => {
            const active = item.id === variationId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setVariationId(item.id)}
                className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left ${
                  active
                    ? "border-gold-champagne bg-gold/10 shadow-[0_0_0_1px_#F5D68D]"
                    : "border-gold/20 bg-surface"
                }`}
              >
                <span>
                  <span className="block font-semibold text-ink">{item.name}</span>
                  <span className="text-xs text-ink-muted">
                    {item.stock === null ? "Available" : `${item.stock} remaining`}
                  </span>
                </span>
                <span className="text-gold">{formatMoney(item.price, item.currency)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Quantity</span>
        <select
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        >
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
          Attendee name
        </span>
        <input
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Email</span>
        <input
          type="email"
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Phone</span>
        <input
          type="tel"
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
        />
      </label>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Pay with</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setGateway("flutterwave")}
            className={`rounded-xl border px-3 py-3 text-sm ${
              gateway === "flutterwave"
                ? "border-gold-champagne bg-gold/10 text-gold"
                : "border-gold/20 text-ink-muted"
            }`}
          >
            Flutterwave
            <span className="mt-1 block text-[10px] uppercase tracking-wider">NGN · USSD</span>
          </button>
          <button
            type="button"
            onClick={() => setGateway("stripe")}
            className={`rounded-xl border px-3 py-3 text-sm ${
              gateway === "stripe"
                ? "border-gold-champagne bg-gold/10 text-gold"
                : "border-gold/20 text-ink-muted"
            }`}
          >
            Stripe
            <span className="mt-1 block text-[10px] uppercase tracking-wider">Cards</span>
          </button>
        </div>
      </div>

      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <Button type="submit" variant="primary" block disabled={busy}>
        {busy
          ? "Opening checkout…"
          : total === 0
            ? "Join the waitlist"
            : `Pay ${formatMoney(total, event.currency)}`}
      </Button>
      <p className="text-center text-[11px] text-ink-dim">
        Guest checkout. Email is your ticket identity. Payment is confirmed by webhook — never on redirect.
      </p>
    </form>
  );
}
