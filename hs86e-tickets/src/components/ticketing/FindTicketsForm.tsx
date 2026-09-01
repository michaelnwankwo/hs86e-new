"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function FindTicketsForm({
  initialOrder,
  initialEmail,
  initialTicket,
}: {
  initialOrder?: string;
  initialEmail?: string;
  initialTicket?: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [ticket, setTicket] = useState(initialTicket ?? "");
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <form
      className="space-y-3 rounded-2xl border border-[#DFB260]/20 bg-[#161B22] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ticket.trim() && !order.trim() && !email.trim()) {
          setError("Enter a ticket ID, order ID, or email — any one is enough.");
          return;
        }
        setError(null);
        const qs = new URLSearchParams();
        if (ticket.trim()) qs.set("ticketId", ticket.trim());
        if (order.trim()) qs.set("order", order.trim());
        if (email.trim()) qs.set("email", email.trim());
        router.push(`/tickets?${qs.toString()}`);
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DFB260]">
        Find my tickets
      </p>
      <p className="text-xs text-[#DFB260]/70">Any one field works. Combinations refine the match.</p>
      <input
        className="w-full rounded-xl border border-[#DFB260]/20 bg-[#0B0E14] px-3 py-3 text-[#F8FAFC]"
        placeholder="Ticket ID"
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
      />
      <input
        className="w-full rounded-xl border border-[#DFB260]/20 bg-[#0B0E14] px-3 py-3 text-[#F8FAFC]"
        placeholder="Order ID"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
        inputMode="numeric"
      />
      <input
        className="w-full rounded-xl border border-[#DFB260]/20 bg-[#0B0E14] px-3 py-3 text-[#F8FAFC]"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error ? <p className="text-xs text-danger-bright">{error}</p> : null}
      <Button type="submit" variant="gold" block>
        Open wallet
      </Button>

      <div className="mb-6 pt-1">
        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          className="inline-flex items-center gap-1.5 text-xs text-[#DFB260]/80 underline-offset-4 hover:text-[#F5D68D] hover:underline"
          aria-expanded={helpOpen}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
          Where do I find these IDs?
        </button>
        {helpOpen ? (
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#F8FAFC]/70">
            <p>
              <span className="text-[#F5D68D]">Checkout screen</span> — Ticket ID and Order # sit under
              the QR right after payment.
            </p>
            <p>
              <span className="text-[#F5D68D]">Confirmation email</span> — FooEvents sends the Ticket ID
              (e.g. <span className="font-mono text-[#DFB260]">ho…</span>) and order number to the
              address you used at checkout.
            </p>
            <p>
              <span className="text-[#F5D68D]">Payment receipt</span> — Stripe / Flutterwave SMS or email
              carries the order reference.
            </p>
          </div>
        ) : null}
      </div>
    </form>
  );
}
