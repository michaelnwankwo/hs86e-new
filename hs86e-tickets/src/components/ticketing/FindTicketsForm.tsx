"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function FindTicketsForm({
  initialOrder,
  initialOrderKey,
  initialTicket,
}: {
  initialOrder?: string;
  initialOrderKey?: string;
  initialTicket?: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder ?? "");
  const [orderKey, setOrderKey] = useState(initialOrderKey ?? "");
  const [ticket, setTicket] = useState(initialTicket ?? "");
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <form
      className="space-y-4 rounded-2xl border border-gold/20 bg-surface-raised/90 p-5 shadow-lg shadow-black/20 backdrop-blur-md"
      onSubmit={(event) => {
        event.preventDefault();
        const hasTicket = Boolean(ticket.trim());
        const hasOrder = Boolean(order.trim());
        if (hasTicket === hasOrder) {
          setError("Enter either a Ticket ID or an Order ID, not both.");
          return;
        }
        if (hasOrder && !orderKey.trim()) {
          setError("Enter the order key from your checkout confirmation link with the Order ID.");
          return;
        }
        setError(null);
        const params = new URLSearchParams();
        if (hasTicket) params.set("ticketId", ticket.trim());
        if (hasOrder) {
          params.set("order", order.trim());
          params.set("key", orderKey.trim());
        }
        router.push(`/tickets?${params.toString()}`);
      }}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Find my tickets</p>
        <p className="mt-1 text-xs text-ink-muted">Look up by Ticket ID, or by Order ID and its checkout key.</p>
      </div>
      <label className="block text-sm text-ink-muted">
        Ticket ID
        <input
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink"
          placeholder="Enter Ticket ID"
          value={ticket}
          onChange={(event) => setTicket(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="block text-sm text-ink-muted">
        Order ID
        <input
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink"
          placeholder="Enter Order ID"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          inputMode="numeric"
          autoComplete="off"
        />
      </label>
      <label className="block text-sm text-ink-muted">
        Order key <span className="text-ink-dim">(required with Order ID)</span>
        <input
          className="mt-2 w-full rounded-xl border border-gold/20 bg-surface px-3 py-3 text-ink"
          placeholder="From your checkout confirmation link"
          value={orderKey}
          onChange={(event) => setOrderKey(event.target.value)}
          autoComplete="off"
        />
      </label>
      {error ? <p role="alert" className="text-sm text-danger-bright">{error}</p> : null}
      <Button type="submit" variant="gold" block>Open wallet</Button>

      <div className="pt-1">
        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          className="inline-flex items-center gap-1.5 text-xs text-gold/80 underline-offset-4 hover:text-[#F5D68D] hover:underline"
          aria-expanded={helpOpen}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
          Where do I find these IDs?
        </button>
        {helpOpen ? (
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-ink-muted">
            <p><span className="text-[#F5D68D]">Checkout screen</span> — Ticket ID and Order ID appear under the QR after payment.</p>
            <p><span className="text-[#F5D68D]">Confirmation email</span> — FooEvents sends the Ticket ID and order number to the address used at checkout. The checkout confirmation link contains the order key.</p>
            <p><span className="text-[#F5D68D]">Payment receipt</span> — Stripe or Flutterwave receipts include the order reference.</p>
          </div>
        ) : null}
      </div>
    </form>
  );
}
